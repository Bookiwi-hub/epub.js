import EventEmitter from "event-emitter";
import {
  extend,
  borders,
  uuid,
  isNumber,
  bounds,
  defer,
  createBlobUrl,
  revokeBlobUrl,
} from "../../utils/core";
import EpubCFI from "../../epubcfi";
import Contents from "../../contents";
import { EVENTS } from "../../utils/constants";
import { Pane, Highlight, Underline } from "marks-pane";

/**
 * EPUB 문서의 컨텐츠를 iframe 내에서 렌더링하고 관리하는 뷰 클래스
 *
 * @example
 * // 기본 사용 예시
 * const iframeView = new IframeView(section, {
 *   width: 800,
 *   height: 600,
 *   axis: "horizontal",
 *   allowScriptedContent: true
 * });
 *
 * // 컨텐츠 렌더링
 * iframeView.render(request, true)
 *   .then(() => {
 *     console.log("렌더링 완료");
 *   });
 *
 * // 하이라이트 추가
 * iframeView.highlight("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)", {
 *   color: "yellow",
 *   note: "중요한 내용"
 * });
 *
 * @class
 * @param {Object} section - EPUB 섹션 객체
 * @param {Object} options - 설정 옵션
 * @param {string} [options.ignoreClass] - 무시할 클래스 이름
 * @param {string} [options.axis] - 레이아웃 방향 ("horizontal" 또는 "vertical")
 * @param {string} [options.direction] - 방향 설정
 * @param {number} [options.width] - 뷰 너비
 * @param {number} [options.height] - 뷰 높이
 * @param {Object} [options.layout] - 레이아웃 설정
 * @param {Object} [options.globalLayoutProperties] - 전역 레이아웃 속성
 * @param {string} [options.method] - 렌더링 메소드
 * @param {boolean} [options.forceRight] - 오른쪽 정렬 강제 여부
 * @param {boolean} [options.allowScriptedContent] - 스크립트 허용 여부
 * @param {boolean} [options.allowPopups] - 팝업 허용 여부
 */
class IframeView {
  constructor(section, options) {
    this.settings = extend(
      {
        ignoreClass: "",
        axis: undefined, //options.layout && options.layout.props.flow === "scrolled" ? "vertical" : "horizontal",
        direction: undefined,
        width: 0,
        height: 0,
        layout: undefined,
        globalLayoutProperties: {},
        method: undefined,
        forceRight: false,
        allowScriptedContent: false,
        allowPopups: false,
      },
      options || {}
    );

    this.id = "epubjs-view-" + uuid();
    this.section = section;
    this.index = section.index;

    this.element = this.container(this.settings.axis);

    this.added = false;
    this.displayed = false;
    this.rendered = false;

    // this.width  = this.settings.width;
    // this.height = this.settings.height;

    this.fixedWidth = 0;
    this.fixedHeight = 0;

    // Blank Cfi for Parsing
    this.epubcfi = new EpubCFI();

    this.layout = this.settings.layout;
    // Dom events to listen for
    // this.listenedEvents = ["keydown", "keyup", "keypressed", "mouseup", "mousedown", "click", "touchend", "touchstart"];

    this.pane = undefined;
    this.highlights = {};
    this.underlines = {};
    this.marks = {};
  }

  /**
   * iframe 컨테이너 요소를 생성합니다.
   *
   * @example
   * const container = iframeView.container("horizontal");
   * // 결과: <div class="epub-view" style="flex: none; height: 0px; width: 0px; overflow: hidden; position: relative; display: block;"></div>
   *
   * @param {string} axis - 레이아웃 방향
   * @returns {HTMLElement} 생성된 컨테이너 요소
   */
  container(axis) {
    var element = document.createElement("div");

    element.classList.add("epub-view");

    // this.element.style.minHeight = "100px";
    element.style.height = "0px";
    element.style.width = "0px";
    element.style.overflow = "hidden";
    element.style.position = "relative";
    element.style.display = "block";

    if (axis && axis == "horizontal") {
      element.style.flex = "none";
    } else {
      element.style.flex = "initial";
    }

    return element;
  }

  /**
   * iframe 요소를 생성하고 초기화합니다.
   *
   * @example
   * const iframe = iframeView.create();
   * // 결과: <iframe id="epubjs-view-{uuid}" scrolling="no" seamless="seamless" sandbox="allow-same-origin allow-scripts"></iframe>
   *
   * @returns {HTMLIFrameElement} 생성된 iframe 요소
   */
  create() {
    if (this.iframe) {
      return this.iframe;
    }

    if (!this.element) {
      this.element = this.createContainer();
    }

    this.iframe = document.createElement("iframe");
    this.iframe.id = this.id;
    this.iframe.scrolling = "no"; // Might need to be removed: breaks ios width calculations
    this.iframe.style.overflow = "hidden";
    this.iframe.seamless = "seamless";
    // Back up if seamless isn't supported
    this.iframe.style.border = "none";

    // sandbox
    this.iframe.sandbox = "allow-same-origin";
    if (this.settings.allowScriptedContent) {
      this.iframe.sandbox += " allow-scripts";
    }
    if (this.settings.allowPopups) {
      this.iframe.sandbox += " allow-popups";
    }

    this.iframe.setAttribute("enable-annotation", "true");

    this.resizing = true;

    // this.iframe.style.display = "none";
    this.element.style.visibility = "hidden";
    this.iframe.style.visibility = "hidden";

    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this._width = 0;
    this._height = 0;

    this.element.setAttribute("ref", this.index);

    this.added = true;

    this.elementBounds = bounds(this.element);

    // if(width || height){
    //   this.resize(width, height);
    // } else if(this.width && this.height){
    //   this.resize(this.width, this.height);
    // } else {
    //   this.iframeBounds = bounds(this.iframe);
    // }

    if ("srcdoc" in this.iframe) {
      this.supportsSrcdoc = true;
    } else {
      this.supportsSrcdoc = false;
    }

    if (!this.settings.method) {
      this.settings.method = this.supportsSrcdoc ? "srcdoc" : "write";
    }

    return this.iframe;
  }

  /**
   * 컨텐츠를 렌더링하고 iframe에 로드합니다.
   *
   * @example
   * iframeView.render(request, true)
   *   .then(() => {
   *     console.log("렌더링 완료");
   *   });
   *
   * @param {Object} request - 렌더링 요청 객체
   * @param {boolean} show - 렌더링 후 표시 여부
   * @returns {Promise} 렌더링 완료를 나타내는 Promise
   */
  render(request, show) {
    // view.onLayout = this.layout.format.bind(this.layout);
    this.create();

    // Fit to size of the container, apply padding
    this.size();

    if (!this.sectionRender) {
      this.sectionRender = this.section.render(request);
    }

    // Render Chain
    return this.sectionRender
      .then(
        function (contents) {
          return this.load(contents);
        }.bind(this)
      )
      .then(
        function () {
          // find and report the writingMode axis
          let writingMode = this.contents.writingMode();

          // Set the axis based on the flow and writing mode
          let axis;
          if (this.settings.flow === "scrolled") {
            axis =
              writingMode.indexOf("vertical") === 0 ? "horizontal" : "vertical";
          } else {
            axis =
              writingMode.indexOf("vertical") === 0 ? "vertical" : "horizontal";
          }

          if (
            writingMode.indexOf("vertical") === 0 &&
            this.settings.flow === "paginated"
          ) {
            this.layout.delta = this.layout.height;
          }

          this.setAxis(axis);
          this.emit(EVENTS.VIEWS.AXIS, axis);

          this.setWritingMode(writingMode);
          this.emit(EVENTS.VIEWS.WRITING_MODE, writingMode);

          // apply the layout function to the contents
          this.layout.format(this.contents, this.section, this.axis);

          // Listen for events that require an expansion of the iframe
          this.addListeners();

          return new Promise((resolve, reject) => {
            // Expand the iframe to the full size of the content
            this.expand();

            if (this.settings.forceRight) {
              this.element.style.marginLeft = this.width() + "px";
            }
            resolve();
          });
        }.bind(this),
        function (e) {
          this.emit(EVENTS.VIEWS.LOAD_ERROR, e);
          return new Promise((resolve, reject) => {
            reject(e);
          });
        }.bind(this)
      )
      .then(
        function () {
          this.emit(EVENTS.VIEWS.RENDERED, this.section);
        }.bind(this)
      );
  }

  /**
   * iframe의 크기를 리셋합니다.
   *
   * @example
   * iframeView.reset();
   * // 결과: iframe의 width와 height가 0으로 설정됨
   */
  reset() {
    if (this.iframe) {
      this.iframe.style.width = "0";
      this.iframe.style.height = "0";
      this._width = 0;
      this._height = 0;
      this._textWidth = undefined;
      this._contentWidth = undefined;
      this._textHeight = undefined;
      this._contentHeight = undefined;
    }
    this._needsReframe = true;
  }

  // Determine locks base on settings
  /**
   * 뷰의 크기를 설정합니다.
   *
   * @example
   * iframeView.size(800, 600);
   * // 결과: 뷰의 너비가 800px, 높이가 600px로 설정됨
   *
   * @param {number} [_width] - 설정할 너비
   * @param {number} [_height] - 설정할 높이
   */
  size(_width, _height) {
    var width = _width || this.settings.width;
    var height = _height || this.settings.height;

    if (this.layout.name === "pre-paginated") {
      this.lock("both", width, height);
    } else if (this.settings.axis === "horizontal") {
      this.lock("height", width, height);
    } else {
      this.lock("width", width, height);
    }

    this.settings.width = width;
    this.settings.height = height;
  }

  // Lock an axis to element dimensions, taking borders into account
  /**
   * 특정 축의 크기를 고정합니다.
   *
   * @example
   * iframeView.lock("width", 800, 600);
   * // 결과: 너비가 800px로 고정되고 높이는 600px로 설정됨
   *
   * @param {string} what - 고정할 축 ("width", "height", "both")
   * @param {number} width - 설정할 너비
   * @param {number} height - 설정할 높이
   */
  lock(what, width, height) {
    var elBorders = borders(this.element);
    var iframeBorders;

    if (this.iframe) {
      iframeBorders = borders(this.iframe);
    } else {
      iframeBorders = { width: 0, height: 0 };
    }

    if (what == "width" && isNumber(width)) {
      this.lockedWidth = width - elBorders.width - iframeBorders.width;
      // this.resize(this.lockedWidth, width); //  width keeps ratio correct
    }

    if (what == "height" && isNumber(height)) {
      this.lockedHeight = height - elBorders.height - iframeBorders.height;
      // this.resize(width, this.lockedHeight);
    }

    if (what === "both" && isNumber(width) && isNumber(height)) {
      this.lockedWidth = width - elBorders.width - iframeBorders.width;
      this.lockedHeight = height - elBorders.height - iframeBorders.height;
      // this.resize(this.lockedWidth, this.lockedHeight);
    }

    if (this.displayed && this.iframe) {
      // this.contents.layout();
      this.expand();
    }
  }

  // Resize a single axis based on content dimensions
  /**
   * 컨텐츠의 크기에 맞게 iframe을 확장합니다.
   *
   * @example
   * iframeView.expand();
   * // 결과: 컨텐츠의 크기에 맞게 iframe이 자동으로 확장됨
   *
   * @param {boolean} [force] - 강제 확장 여부
   */
  expand(force) {
    var width = this.lockedWidth;
    var height = this.lockedHeight;
    var columns;

    var textWidth, textHeight;

    if (!this.iframe || this._expanding) return;

    this._expanding = true;

    if (this.layout.name === "pre-paginated") {
      width = this.layout.columnWidth;
      height = this.layout.height;
    }
    // Expand Horizontally
    else if (this.settings.axis === "horizontal") {
      // Get the width of the text
      width = this.contents.textWidth();

      if (width % this.layout.pageWidth > 0) {
        width =
          Math.ceil(width / this.layout.pageWidth) * this.layout.pageWidth;
      }

      if (this.settings.forceEvenPages) {
        columns = width / this.layout.pageWidth;
        if (
          this.layout.divisor > 1 &&
          this.layout.name === "reflowable" &&
          columns % 2 > 0
        ) {
          // add a blank page
          width += this.layout.pageWidth;
        }
      }
    } // Expand Vertically
    else if (this.settings.axis === "vertical") {
      height = this.contents.textHeight();
      if (
        this.settings.flow === "paginated" &&
        height % this.layout.height > 0
      ) {
        height = Math.ceil(height / this.layout.height) * this.layout.height;
      }
    }

    // Only Resize if dimensions have changed or
    // if Frame is still hidden, so needs reframing
    if (this._needsReframe || width != this._width || height != this._height) {
      this.reframe(width, height);
    }

    this._expanding = false;
  }

  /**
   * iframe의 크기를 재설정합니다.
   *
   * @example
   * iframeView.reframe(800, 600);
   * // 결과: iframe의 크기가 800x600으로 변경됨
   *
   * @param {number} width - 새로운 너비
   * @param {number} height - 새로운 높이
   */
  reframe(width, height) {
    var size;

    if (isNumber(width)) {
      this.element.style.width = width + "px";
      this.iframe.style.width = width + "px";
      this._width = width;
    }

    if (isNumber(height)) {
      this.element.style.height = height + "px";
      this.iframe.style.height = height + "px";
      this._height = height;
    }

    let widthDelta = this.prevBounds ? width - this.prevBounds.width : width;
    let heightDelta = this.prevBounds
      ? height - this.prevBounds.height
      : height;

    size = {
      width: width,
      height: height,
      widthDelta: widthDelta,
      heightDelta: heightDelta,
    };

    this.pane && this.pane.render();

    requestAnimationFrame(() => {
      let mark;
      for (let m in this.marks) {
        if (this.marks.hasOwnProperty(m)) {
          mark = this.marks[m];
          this.placeMark(mark.element, mark.range);
        }
      }
    });

    this.onResize(this, size);

    this.emit(EVENTS.VIEWS.RESIZED, size);

    this.prevBounds = size;

    this.elementBounds = bounds(this.element);
  }

  /**
   * 컨텐츠를 iframe에 로드합니다.
   *
   * @example
   * iframeView.load(contents)
   *   .then(() => {
   *     console.log("로드 완료");
   *   });
   *
   * @param {string} contents - 로드할 HTML 컨텐츠
   * @returns {Promise} 로드 완료를 나타내는 Promise
   */
  load(contents) {
    var loading = new defer();
    var loaded = loading.promise;

    if (!this.iframe) {
      loading.reject(new Error("No Iframe Available"));
      return loaded;
    }

    this.iframe.onload = function (event) {
      this.onLoad(event, loading);
    }.bind(this);

    if (this.settings.method === "blobUrl") {
      this.blobUrl = createBlobUrl(contents, "application/xhtml+xml");
      this.iframe.src = this.blobUrl;
      this.element.appendChild(this.iframe);
    } else if (this.settings.method === "srcdoc") {
      this.iframe.srcdoc = contents;
      this.element.appendChild(this.iframe);
    } else {
      this.element.appendChild(this.iframe);

      this.document = this.iframe.contentDocument;

      if (!this.document) {
        loading.reject(new Error("No Document Available"));
        return loaded;
      }

      this.iframe.contentDocument.open();
      // For Cordova windows platform
      if (window.MSApp && MSApp.execUnsafeLocalFunction) {
        var outerThis = this;
        MSApp.execUnsafeLocalFunction(function () {
          outerThis.iframe.contentDocument.write(contents);
        });
      } else {
        this.iframe.contentDocument.write(contents);
      }
      this.iframe.contentDocument.close();
    }

    return loaded;
  }

  /**
   * iframe 로드 완료 이벤트를 처리합니다.
   *
   * @example
   * iframeView.onLoad(event, promise);
   * // 결과: 컨텐츠가 초기화되고 이벤트 리스너가 설정됨
   *
   * @param {Event} event - 로드 이벤트 객체
   * @param {Object} promise - 완료를 나타내는 Promise 객체
   */
  onLoad(event, promise) {
    this.window = this.iframe.contentWindow;
    this.document = this.iframe.contentDocument;

    this.contents = new Contents(
      this.document,
      this.document.body,
      this.section.cfiBase,
      this.section.index
    );

    this.rendering = false;

    var link = this.document.querySelector("link[rel='canonical']");
    if (link) {
      link.setAttribute("href", this.section.canonical);
    } else {
      link = this.document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", this.section.canonical);
      this.document.querySelector("head").appendChild(link);
    }

    this.contents.on(EVENTS.CONTENTS.EXPAND, () => {
      if (this.displayed && this.iframe) {
        this.expand();
        if (this.contents) {
          this.layout.format(this.contents);
        }
      }
    });

    this.contents.on(EVENTS.CONTENTS.RESIZE, (e) => {
      if (this.displayed && this.iframe) {
        this.expand();
        if (this.contents) {
          this.layout.format(this.contents);
        }
      }
    });

    promise.resolve(this.contents);
  }

  /**
   * 레이아웃을 설정합니다.
   *
   * @example
   * iframeView.setLayout(layout);
   * // 결과: 새로운 레이아웃이 적용되고 컨텐츠가 재포맷됨
   *
   * @param {Object} layout - 적용할 레이아웃 객체
   */
  setLayout(layout) {
    this.layout = layout;

    if (this.contents) {
      this.layout.format(this.contents);
      this.expand();
    }
  }

  /**
   * 레이아웃 방향을 설정합니다.
   *
   * @example
   * iframeView.setAxis("horizontal");
   * // 결과: 레이아웃이 가로 방향으로 설정됨
   *
   * @param {string} axis - 설정할 방향 ("horizontal" 또는 "vertical")
   */
  setAxis(axis) {
    this.settings.axis = axis;

    if (axis == "horizontal") {
      this.element.style.flex = "none";
    } else {
      this.element.style.flex = "initial";
    }

    this.size();
  }

  /**
   * 쓰기 모드를 설정합니다.
   *
   * @example
   * iframeView.setWritingMode("horizontal-tb");
   * // 결과: 쓰기 모드가 가로 방향으로 설정됨
   *
   * @param {string} mode - 설정할 쓰기 모드
   */
  setWritingMode(mode) {
    // this.element.style.writingMode = writingMode;
    this.writingMode = mode;
  }

  /**
   * 이벤트 리스너를 추가합니다.
   *
   * @example
   * iframeView.addListeners();
   * // 결과: 컨텐츠 확장 관련 이벤트 리스너가 추가됨
   */
  addListeners() {
    //TODO: Add content listeners for expanding
  }

  /**
   * 이벤트 리스너를 제거합니다.
   *
   * @example
   * iframeView.removeListeners();
   * // 결과: 컨텐츠 확장 관련 이벤트 리스너가 제거됨
   *
   * @param {Function} [layoutFunc] - 레이아웃 함수
   */
  removeListeners(layoutFunc) {
    //TODO: remove content listeners for expanding
  }

  /**
   * 뷰를 표시합니다.
   *
   * @example
   * iframeView.display(request)
   *   .then(() => {
   *     console.log("표시 완료");
   *   });
   *
   * @param {Object} request - 표시 요청 객체
   * @returns {Promise} 표시 완료를 나타내는 Promise
   */
  display(request) {
    var displayed = new defer();

    if (!this.displayed) {
      this.render(request).then(
        function () {
          this.emit(EVENTS.VIEWS.DISPLAYED, this);
          this.onDisplayed(this);

          this.displayed = true;
          displayed.resolve(this);
        }.bind(this),
        function (err) {
          displayed.reject(err, this);
        }
      );
    } else {
      displayed.resolve(this);
    }

    return displayed.promise;
  }

  /**
   * 뷰를 보여줍니다.
   *
   * @example
   * iframeView.show();
   * // 결과: 뷰가 화면에 표시됨
   */
  show() {
    this.element.style.visibility = "visible";

    if (this.iframe) {
      this.iframe.style.visibility = "visible";

      // Remind Safari to redraw the iframe
      this.iframe.style.transform = "translateZ(0)";
      this.iframe.offsetWidth;
      this.iframe.style.transform = null;
    }

    this.emit(EVENTS.VIEWS.SHOWN, this);
  }

  /**
   * 뷰를 숨깁니다.
   *
   * @example
   * iframeView.hide();
   * // 결과: 뷰가 화면에서 숨겨짐
   */
  hide() {
    // this.iframe.style.display = "none";
    this.element.style.visibility = "hidden";
    this.iframe.style.visibility = "hidden";

    this.stopExpanding = true;
    this.emit(EVENTS.VIEWS.HIDDEN, this);
  }

  /**
   * 뷰의 오프셋을 반환합니다.
   *
   * @example
   * const offset = iframeView.offset();
   * // 결과: { top: 100, left: 200 }
   *
   * @returns {Object} 오프셋 객체
   */
  offset() {
    return {
      top: this.element.offsetTop,
      left: this.element.offsetLeft,
    };
  }

  /**
   * 뷰의 너비를 반환합니다.
   *
   * @example
   * const width = iframeView.width();
   * // 결과: 800
   *
   * @returns {number} 뷰의 너비
   */
  width() {
    return this._width;
  }

  /**
   * 뷰의 높이를 반환합니다.
   *
   * @example
   * const height = iframeView.height();
   * // 결과: 600
   *
   * @returns {number} 뷰의 높이
   */
  height() {
    return this._height;
  }

  /**
   * 뷰의 위치를 반환합니다.
   *
   * @example
   * const position = iframeView.position();
   * // 결과: { top: 100, left: 200, right: 1000, bottom: 700, width: 800, height: 600 }
   *
   * @returns {DOMRect} 뷰의 위치 정보
   */
  position() {
    return this.element.getBoundingClientRect();
  }

  /**
   * 특정 요소의 위치를 반환합니다.
   *
   * @example
   * const location = iframeView.locationOf(target);
   * // 결과: { left: 300, top: 400 }
   *
   * @param {HTMLElement} target - 위치를 찾을 요소
   * @returns {Object} 위치 정보 객체
   */
  locationOf(target) {
    var parentPos = this.iframe.getBoundingClientRect();
    var targetPos = this.contents.locationOf(target, this.settings.ignoreClass);

    return {
      left: targetPos.left,
      top: targetPos.top,
    };
  }

  /**
   * 뷰가 표시될 때 호출되는 콜백 함수입니다.
   *
   * @example
   * iframeView.onDisplayed = function(view) {
   *   console.log("뷰가 표시됨:", view);
   * };
   *
   * @param {IframeView} view - 표시된 뷰 객체
   */
  onDisplayed(view) {
    // Stub, override with a custom functions
  }

  /**
   * 뷰의 크기가 변경될 때 호출되는 콜백 함수입니다.
   *
   * @example
   * iframeView.onResize = function(view, e) {
   *   console.log("뷰 크기 변경:", e);
   * };
   *
   * @param {IframeView} view - 크기가 변경된 뷰 객체
   * @param {Object} e - 크기 변경 이벤트 객체
   */
  onResize(view, e) {
    // Stub, override with a custom functions
  }

  /**
   * 뷰의 경계를 반환합니다.
   *
   * @example
   * const bounds = iframeView.bounds();
   * // 결과: { top: 100, left: 200, right: 1000, bottom: 700, width: 800, height: 600 }
   *
   * @param {boolean} [force] - 강제 재계산 여부
   * @returns {Object} 경계 정보 객체
   */
  bounds(force) {
    if (force || !this.elementBounds) {
      this.elementBounds = bounds(this.element);
    }

    return this.elementBounds;
  }

  /**
   * 텍스트에 하이라이트를 추가합니다.
   *
   * @example
   * iframeView.highlight("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)", {
   *   color: "yellow",
   *   note: "중요한 내용"
   * });
   *
   * @param {string} cfiRange - 하이라이트할 범위의 CFI
   * @param {Object} data - 하이라이트 데이터
   * @param {Function} [cb] - 클릭 이벤트 콜백
   * @param {string} [className="epubjs-hl"] - 하이라이트 클래스 이름
   * @param {Object} [styles] - 하이라이트 스타일
   * @returns {Object} 하이라이트 객체
   */
  highlight(cfiRange, data = {}, cb, className = "epubjs-hl", styles = {}) {
    if (!this.contents) {
      return;
    }
    const attributes = Object.assign(
      { fill: "yellow", "fill-opacity": "0.3", "mix-blend-mode": "multiply" },
      styles
    );
    let range = this.contents.range(cfiRange);

    let emitter = () => {
      this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
    };

    data["epubcfi"] = cfiRange;

    if (!this.pane) {
      this.pane = new Pane(this.iframe, this.element);
    }

    let m = new Highlight(range, className, data, attributes);
    let h = this.pane.addMark(m);

    this.highlights[cfiRange] = {
      mark: h,
      element: h.element,
      listeners: [emitter, cb],
    };

    h.element.setAttribute("ref", className);
    h.element.addEventListener("click", emitter);
    h.element.addEventListener("touchstart", emitter);

    if (cb) {
      h.element.addEventListener("click", cb);
      h.element.addEventListener("touchstart", cb);
    }
    return h;
  }

  /**
   * 텍스트에 밑줄을 추가합니다.
   *
   * @example
   * iframeView.underline("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)", {
   *   color: "red",
   *   note: "중요한 내용"
   * });
   *
   * @param {string} cfiRange - 밑줄을 그을 범위의 CFI
   * @param {Object} data - 밑줄 데이터
   * @param {Function} [cb] - 클릭 이벤트 콜백
   * @param {string} [className="epubjs-ul"] - 밑줄 클래스 이름
   * @param {Object} [styles] - 밑줄 스타일
   * @returns {Object} 밑줄 객체
   */
  underline(cfiRange, data = {}, cb, className = "epubjs-ul", styles = {}) {
    if (!this.contents) {
      return;
    }
    const attributes = Object.assign(
      {
        stroke: "black",
        "stroke-opacity": "0.3",
        "mix-blend-mode": "multiply",
      },
      styles
    );
    let range = this.contents.range(cfiRange);
    let emitter = () => {
      this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
    };

    data["epubcfi"] = cfiRange;

    if (!this.pane) {
      this.pane = new Pane(this.iframe, this.element);
    }

    let m = new Underline(range, className, data, attributes);
    let h = this.pane.addMark(m);

    this.underlines[cfiRange] = {
      mark: h,
      element: h.element,
      listeners: [emitter, cb],
    };

    h.element.setAttribute("ref", className);
    h.element.addEventListener("click", emitter);
    h.element.addEventListener("touchstart", emitter);

    if (cb) {
      h.element.addEventListener("click", cb);
      h.element.addEventListener("touchstart", cb);
    }
    return h;
  }

  /**
   * 텍스트에 마크를 추가합니다.
   *
   * @example
   * iframeView.mark("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)", {
   *   type: "note",
   *   content: "메모 내용"
   * });
   *
   * @param {string} cfiRange - 마크를 추가할 범위의 CFI
   * @param {Object} data - 마크 데이터
   * @param {Function} [cb] - 클릭 이벤트 콜백
   * @returns {HTMLElement} 마크 요소
   */
  mark(cfiRange, data = {}, cb) {
    if (!this.contents) {
      return;
    }

    if (cfiRange in this.marks) {
      let item = this.marks[cfiRange];
      return item;
    }

    let range = this.contents.range(cfiRange);
    if (!range) {
      return;
    }
    let container = range.commonAncestorContainer;
    let parent = container.nodeType === 1 ? container : container.parentNode;

    let emitter = (e) => {
      this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
    };

    if (range.collapsed && container.nodeType === 1) {
      range = new Range();
      range.selectNodeContents(container);
    } else if (range.collapsed) {
      // Webkit doesn't like collapsed ranges
      range = new Range();
      range.selectNodeContents(parent);
    }

    let mark = this.document.createElement("a");
    mark.setAttribute("ref", "epubjs-mk");
    mark.style.position = "absolute";

    mark.dataset["epubcfi"] = cfiRange;

    if (data) {
      Object.keys(data).forEach((key) => {
        mark.dataset[key] = data[key];
      });
    }

    if (cb) {
      mark.addEventListener("click", cb);
      mark.addEventListener("touchstart", cb);
    }

    mark.addEventListener("click", emitter);
    mark.addEventListener("touchstart", emitter);

    this.placeMark(mark, range);

    this.element.appendChild(mark);

    this.marks[cfiRange] = {
      element: mark,
      range: range,
      listeners: [emitter, cb],
    };

    return parent;
  }

  /**
   * 마크 요소를 배치합니다.
   *
   * @example
   * iframeView.placeMark(element, range);
   * // 결과: 마크 요소가 지정된 범위에 배치됨
   *
   * @param {HTMLElement} element - 배치할 마크 요소
   * @param {Range} range - 배치할 범위
   */
  placeMark(element, range) {
    let top, right, left;

    if (
      this.layout.name === "pre-paginated" ||
      this.settings.axis !== "horizontal"
    ) {
      let pos = range.getBoundingClientRect();
      top = pos.top;
      right = pos.right;
    } else {
      // Element might break columns, so find the left most element
      let rects = range.getClientRects();

      let rect;
      for (var i = 0; i != rects.length; i++) {
        rect = rects[i];
        if (!left || rect.left < left) {
          left = rect.left;
          // right = rect.right;
          right =
            Math.ceil(left / this.layout.props.pageWidth) *
              this.layout.props.pageWidth -
            this.layout.gap / 2;
          top = rect.top;
        }
      }
    }

    element.style.top = `${top}px`;
    element.style.left = `${right}px`;
  }

  /**
   * 하이라이트를 제거합니다.
   *
   * @example
   * iframeView.unhighlight("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
   * // 결과: 지정된 CFI의 하이라이트가 제거됨
   *
   * @param {string} cfiRange - 제거할 하이라이트의 CFI
   */
  unhighlight(cfiRange) {
    let item;
    if (cfiRange in this.highlights) {
      item = this.highlights[cfiRange];

      this.pane.removeMark(item.mark);
      item.listeners.forEach((l) => {
        if (l) {
          item.element.removeEventListener("click", l);
          item.element.removeEventListener("touchstart", l);
        }
      });
      delete this.highlights[cfiRange];
    }
  }

  /**
   * 밑줄을 제거합니다.
   *
   * @example
   * iframeView.ununderline("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
   * // 결과: 지정된 CFI의 밑줄이 제거됨
   *
   * @param {string} cfiRange - 제거할 밑줄의 CFI
   */
  ununderline(cfiRange) {
    let item;
    if (cfiRange in this.underlines) {
      item = this.underlines[cfiRange];
      this.pane.removeMark(item.mark);
      item.listeners.forEach((l) => {
        if (l) {
          item.element.removeEventListener("click", l);
          item.element.removeEventListener("touchstart", l);
        }
      });
      delete this.underlines[cfiRange];
    }
  }

  /**
   * 마크를 제거합니다.
   *
   * @example
   * iframeView.unmark("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
   * // 결과: 지정된 CFI의 마크가 제거됨
   *
   * @param {string} cfiRange - 제거할 마크의 CFI
   */
  unmark(cfiRange) {
    let item;
    if (cfiRange in this.marks) {
      item = this.marks[cfiRange];
      this.element.removeChild(item.element);
      item.listeners.forEach((l) => {
        if (l) {
          item.element.removeEventListener("click", l);
          item.element.removeEventListener("touchstart", l);
        }
      });
      delete this.marks[cfiRange];
    }
  }

  /**
   * 뷰를 파괴하고 리소스를 정리합니다.
   *
   * @example
   * iframeView.destroy();
   * // 결과: 모든 하이라이트, 밑줄, 마크가 제거되고 iframe이 파괴됨
   */
  destroy() {
    for (let cfiRange in this.highlights) {
      this.unhighlight(cfiRange);
    }

    for (let cfiRange in this.underlines) {
      this.ununderline(cfiRange);
    }

    for (let cfiRange in this.marks) {
      this.unmark(cfiRange);
    }

    if (this.blobUrl) {
      revokeBlobUrl(this.blobUrl);
    }

    if (this.displayed) {
      this.displayed = false;

      this.removeListeners();
      this.contents.destroy();

      this.stopExpanding = true;
      this.element.removeChild(this.iframe);

      if (this.pane) {
        this.pane.element.remove();
        this.pane = undefined;
      }

      this.iframe = undefined;
      this.contents = undefined;

      this._textWidth = null;
      this._textHeight = null;
      this._width = null;
      this._height = null;
    }

    // this.element.style.height = "0px";
    // this.element.style.width = "0px";
  }
}

EventEmitter(IframeView.prototype);

export default IframeView;
