import EventEmitter from "event-emitter";
import { extend, defer, isFloat } from "./utils/core";
import Hook from "./utils/hook";
import EpubCFI from "./epubcfi";
import Queue from "./utils/queue";
import Layout from "./layout";
// import Mapping from "./mapping";
import Themes from "./themes";
import Contents from "./contents";
import Annotations from "./annotations";
import { EVENTS, DOM_EVENTS } from "./utils/constants";

// Default Views
import IframeView from "./managers/views/iframe";

// Default View Managers
import DefaultViewManager from "./managers/default/index";
import ContinuousViewManager from "./managers/continuous/index";

/**
 * EPUB 문서를 렌더링하고 표시하는 클래스
 * @class
 * @param {Book} book - 렌더링할 EPUB 책 객체
 * @param {object} [options] - 렌더링 옵션
 * @param {number} [options.width] - 렌더링 영역의 너비
 * @param {number} [options.height] - 렌더링 영역의 높이
 * @param {string} [options.ignoreClass] - CFI 파서가 무시할 클래스
 * @param {string|function|object} [options.manager='default'] - 뷰 매니저
 * @param {string|function} [options.view='iframe'] - 뷰 타입
 * @param {string} [options.layout] - 강제 적용할 레이아웃
 * @param {string} [options.spread] - 강제 적용할 스프레드 값
 * @param {number} [options.minSpreadWidth] - 스프레드 사용 최소 너비
 * @param {string} [options.stylesheet] - 주입할 스타일시트 URL
 * @param {boolean} [options.resizeOnOrientationChange] - 방향 변경 시 크기 조정 여부
 * @param {string} [options.script] - 주입할 스크립트 URL
 * @param {boolean|object} [options.snap=false] - 스냅 스크롤링 사용 여부
 * @param {string} [options.defaultDirection='ltr'] - 기본 텍스트 방향
 * @param {boolean} [options.allowScriptedContent=false] - 콘텐츠 내 스크립트 실행 허용 여부
 * @param {boolean} [options.allowPopups=false] - 콘텐츠 내 팝업 허용 여부
 *
 * @example
 * // 기본 설정으로 렌더링
 * const rendition = new Rendition(book);
 *
 * // 커스텀 설정으로 렌더링
 * const rendition = new Rendition(book, {
 *   width: 800,
 *   height: 600,
 *   spread: 'auto',
 *   stylesheet: 'custom.css',
 *   defaultDirection: 'rtl'
 * });
 */
class Rendition {
  constructor(book, options) {
    this.settings = extend(this.settings || {}, {
      width: null,
      height: null,
      ignoreClass: "",
      manager: "default",
      view: "iframe",
      flow: null,
      layout: null,
      spread: null,
      minSpreadWidth: 800,
      stylesheet: null,
      resizeOnOrientationChange: true,
      script: null,
      snap: false,
      defaultDirection: "ltr",
      allowScriptedContent: false,
      allowPopups: false,
    });

    extend(this.settings, options);

    if (typeof this.settings.manager === "object") {
      this.manager = this.settings.manager;
    }

    this.book = book;

    /**
     * Adds Hook methods to the Rendition prototype
     * @member {object} hooks
     * @property {Hook} hooks.content
     * @memberof Rendition
     */
    this.hooks = {};
    this.hooks.display = new Hook(this);
    this.hooks.serialize = new Hook(this);
    this.hooks.content = new Hook(this);
    this.hooks.unloaded = new Hook(this);
    this.hooks.layout = new Hook(this);
    this.hooks.render = new Hook(this);
    this.hooks.show = new Hook(this);

    this.hooks.content.register(this.handleLinks.bind(this));
    this.hooks.content.register(this.passEvents.bind(this));
    this.hooks.content.register(this.adjustImages.bind(this));

    this.book.spine.hooks.content.register(this.injectIdentifier.bind(this));

    if (this.settings.stylesheet) {
      this.book.spine.hooks.content.register(this.injectStylesheet.bind(this));
    }

    if (this.settings.script) {
      this.book.spine.hooks.content.register(this.injectScript.bind(this));
    }

    /**
     * @member {Themes} themes
     * @memberof Rendition
     */
    this.themes = new Themes(this);

    /**
     * @member {Annotations} annotations
     * @memberof Rendition
     */
    this.annotations = new Annotations(this);

    this.epubcfi = new EpubCFI();

    this.q = new Queue(this);

    /**
     * A Rendered Location Range
     * @typedef location
     * @type {Object}
     * @property {object} start
     * @property {string} start.index
     * @property {string} start.href
     * @property {object} start.displayed
     * @property {EpubCFI} start.cfi
     * @property {number} start.location
     * @property {number} start.percentage
     * @property {number} start.displayed.page
     * @property {number} start.displayed.total
     * @property {object} end
     * @property {string} end.index
     * @property {string} end.href
     * @property {object} end.displayed
     * @property {EpubCFI} end.cfi
     * @property {number} end.location
     * @property {number} end.percentage
     * @property {number} end.displayed.page
     * @property {number} end.displayed.total
     * @property {boolean} atStart
     * @property {boolean} atEnd
     * @memberof Rendition
     */
    this.location = undefined;

    // Hold queue until book is opened
    this.q.enqueue(this.book.opened);

    this.starting = new defer();
    /**
     * @member {promise} started returns after the rendition has started
     * @memberof Rendition
     */
    this.started = this.starting.promise;

    // Block the queue until rendering is started
    this.q.enqueue(this.start);
  }

  /**
   * 뷰 매니저를 설정합니다.
   * @param {function} manager - 설정할 매니저 함수
   * @returns {void}
   *
   * @example
   * // 커스텀 매니저 설정
   * const customManager = new CustomViewManager();
   * rendition.setManager(customManager);
   */
  setManager(manager) {
    this.manager = manager;
  }

  /**
   * 매니저를 문자열이나 클래스 함수로부터 로드합니다.
   * @param {string|object} manager - 매니저 문자열 또는 클래스 함수
   * @returns {ViewManager} 로드된 뷰 매니저 인스턴스
   *
   * @example
   * // 기본 매니저 로드
   * const defaultManager = rendition.requireManager('default');
   * // 결과: DefaultViewManager 인스턴스
   *
   * // 커스텀 매니저 로드
   * const customManager = rendition.requireManager(CustomManager);
   * // 결과: CustomManager 인스턴스
   */
  requireManager(manager) {
    var viewManager;

    // If manager is a string, try to load from imported managers
    if (typeof manager === "string" && manager === "default") {
      viewManager = DefaultViewManager;
    } else if (typeof manager === "string" && manager === "continuous") {
      viewManager = ContinuousViewManager;
    } else {
      // otherwise, assume we were passed a class function
      viewManager = manager;
    }

    return viewManager;
  }

  /**
   * 뷰를 문자열이나 클래스 함수로부터 로드합니다.
   * @param {string|object} view - 뷰 문자열 또는 클래스 함수
   * @returns {View} 로드된 뷰 인스턴스
   *
   * @example
   * // iframe 뷰 로드
   * const iframeView = rendition.requireView('iframe');
   * // 결과: IframeView 인스턴스
   *
   * // 커스텀 뷰 로드
   * const customView = rendition.requireView(CustomView);
   * // 결과: CustomView 인스턴스
   */
  requireView(view) {
    var View;

    // If view is a string, try to load from imported views,
    if (typeof view == "string" && view === "iframe") {
      View = IframeView;
    } else {
      // otherwise, assume we were passed a class function
      View = view;
    }

    return View;
  }

  /**
   * 렌더링을 시작합니다.
   * @returns {Promise<void>} 렌더링 시작 프로미스
   *
   * @example
   * rendition.start()
   *   .then(() => {
   *     console.log('렌더링이 시작되었습니다.');
   *   })
   *   .catch(error => {
   *     console.error('렌더링 시작 중 오류 발생:', error);
   *   });
   */
  start() {
    if (
      !this.settings.layout &&
      (this.book.package.metadata.layout === "pre-paginated" ||
        this.book.displayOptions.fixedLayout === "true")
    ) {
      this.settings.layout = "pre-paginated";
    }
    switch (this.book.package.metadata.spread) {
      case "none":
        this.settings.spread = "none";
        break;
      case "both":
        this.settings.spread = true;
        break;
    }

    if (!this.manager) {
      this.ViewManager = this.requireManager(this.settings.manager);
      this.View = this.requireView(this.settings.view);

      this.manager = new this.ViewManager({
        view: this.View,
        queue: this.q,
        request: this.book.load.bind(this.book),
        settings: this.settings,
      });
    }

    this.direction(
      this.book.package.metadata.direction || this.settings.defaultDirection
    );

    // Parse metadata to get layout props
    this.settings.globalLayoutProperties = this.determineLayoutProperties(
      this.book.package.metadata
    );

    this.flow(this.settings.globalLayoutProperties.flow);

    this.layout(this.settings.globalLayoutProperties);

    // Listen for displayed views
    this.manager.on(EVENTS.MANAGERS.ADDED, this.afterDisplayed.bind(this));
    this.manager.on(EVENTS.MANAGERS.REMOVED, this.afterRemoved.bind(this));

    // Listen for resizing
    this.manager.on(EVENTS.MANAGERS.RESIZED, this.onResized.bind(this));

    // Listen for rotation
    this.manager.on(
      EVENTS.MANAGERS.ORIENTATION_CHANGE,
      this.onOrientationChange.bind(this)
    );

    // Listen for scroll changes
    this.manager.on(EVENTS.MANAGERS.SCROLLED, this.reportLocation.bind(this));

    /**
     * Emit that rendering has started
     * @event started
     * @memberof Rendition
     */
    this.emit(EVENTS.RENDITION.STARTED);

    // Start processing queue
    this.starting.resolve();
  }

  /**
   * DOM 요소에 렌더링 컨테이너를 연결합니다.
   * @param {HTMLElement} element - 연결할 DOM 요소
   * @returns {Promise<void>} 연결 프로미스
   *
   * @example
   * const container = document.getElementById('viewer');
   * rendition.attachTo(container)
   *   .then(() => {
   *     console.log('렌더링 컨테이너가 연결되었습니다.');
   *   })
   *   .catch(error => {
   *     console.error('컨테이너 연결 중 오류 발생:', error);
   *   });
   */
  attachTo(element) {
    return this.q.enqueue(
      function () {
        // Start rendering
        this.manager.render(element, {
          width: this.settings.width,
          height: this.settings.height,
        });

        /**
         * Emit that rendering has attached to an element
         * @event attached
         * @memberof Rendition
         */
        this.emit(EVENTS.RENDITION.ATTACHED);
      }.bind(this)
    );
  }

  /**
   * 책의 특정 위치를 표시합니다.
   * @param {string} target - 표시할 위치 (URL 또는 EpubCFI)
   * @returns {Promise<Section>} 표시된 섹션 객체를 포함하는 프로미스
   *
   * @example
   * // CFI로 표시
   * rendition.display('epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)')
   *   .then(section => {
   *     console.log('표시된 섹션:', section);
   *     // 결과: { index: 0, href: 'chapter1.html', ... }
   *   });
   *
   * // URL로 표시
   * rendition.display('chapter1.html')
   *   .then(section => {
   *     console.log('표시된 섹션:', section);
   *     // 결과: { index: 0, href: 'chapter1.html', ... }
   *   });
   */
  display(target) {
    if (this.displaying) {
      this.displaying.resolve();
    }
    return this.q.enqueue(this._display, target);
  }

  /**
   * 매니저에게 즉시 표시할 내용을 알립니다.
   * @private
   * @param {string} target - 표시할 위치 (URL 또는 EpubCFI)
   * @return {Promise} 표시 프로미스
   *
   */
  _display(target) {
    if (!this.book) {
      return;
    }
    var isCfiString = this.epubcfi.isCfiString(target);
    var displaying = new defer();
    var displayed = displaying.promise;
    var section;
    var moveTo;

    this.displaying = displaying;

    // Check if this is a book percentage
    if (this.book.locations.length() && isFloat(target)) {
      target = this.book.locations.cfiFromPercentage(parseFloat(target));
    }

    section = this.book.spine.get(target);

    if (!section) {
      displaying.reject(new Error("No Section Found"));
      return displayed;
    }

    this.manager.display(section, target).then(
      () => {
        displaying.resolve(section);
        this.displaying = undefined;

        /**
         * Emit that a section has been displayed
         * @event displayed
         * @param {Section} section
         * @memberof Rendition
         */
        this.emit(EVENTS.RENDITION.DISPLAYED, section);
        this.reportLocation();
      },
      (err) => {
        /**
         * Emit that has been an error displaying
         * @event displayError
         * @param {Section} section
         * @memberof Rendition
         */
        this.emit(EVENTS.RENDITION.DISPLAY_ERROR, err);
      }
    );

    return displayed;
  }

  /*
	render(view, show) {

		// view.onLayout = this.layout.format.bind(this.layout);
		view.create();

		// Fit to size of the container, apply padding
		this.manager.resizeView(view);

		// Render Chain
		return view.section.render(this.book.request)
			.then(function(contents){
				return view.load(contents);
			}.bind(this))
			.then(function(doc){
				return this.hooks.content.trigger(view, this);
			}.bind(this))
			.then(function(){
				this.layout.format(view.contents);
				return this.hooks.layout.trigger(view, this);
			}.bind(this))
			.then(function(){
				return view.display();
			}.bind(this))
			.then(function(){
				return this.hooks.render.trigger(view, this);
			}.bind(this))
			.then(function(){
				if(show !== false) {
					this.q.enqueue(function(view){
						view.show();
					}, view);
				}
				// this.map = new Map(view, this.layout);
				this.hooks.show.trigger(view, this);
				this.trigger("rendered", view.section);

			}.bind(this))
			.catch(function(e){
				this.trigger("loaderror", e);
			}.bind(this));

	}
	*/

  /**
   * 표시된 섹션을 보고합니다.
   * @private
   * @param {*} view - 표시된 뷰
   *
   * @example
   * rendition.afterDisplayed(view);
   */
  afterDisplayed(view) {
    view.on(EVENTS.VIEWS.MARK_CLICKED, (cfiRange, data) =>
      this.triggerMarkEvent(cfiRange, data, view.contents)
    );

    this.hooks.render.trigger(view, this).then(() => {
      if (view.contents) {
        this.hooks.content.trigger(view.contents, this).then(() => {
          /**
           * Emit that a section has been rendered
           * @event rendered
           * @param {Section} section
           * @param {View} view
           * @memberof Rendition
           */
          this.emit(EVENTS.RENDITION.RENDERED, view.section, view);
        });
      } else {
        this.emit(EVENTS.RENDITION.RENDERED, view.section, view);
      }
    });
  }

  /**
   * 제거된 내용을 보고합니다.
   * @private
   * @param {*} view - 제거된 뷰
   *
   * @example
   * rendition.afterRemoved(view);
   */
  afterRemoved(view) {
    this.hooks.unloaded.trigger(view, this).then(() => {
      /**
       * Emit that a section has been removed
       * @event removed
       * @param {Section} section
       * @param {View} view
       * @memberof Rendition
       */
      this.emit(EVENTS.RENDITION.REMOVED, view.section, view);
    });
  }

  /**
   * 크기 조정 이벤트를 보고하고 마지막으로 본 위치를 표시합니다.
   * @private
   *
   * @example
   * rendition.onResized({ width: 800, height: 600 }, 'epubcfi(/6/4[chap01ref])');
   */
  onResized(size, epubcfi) {
    /**
     * Emit that the rendition has been resized
     * @event resized
     * @param {number} width
     * @param {height} height
     * @param {string} epubcfi (optional)
     * @memberof Rendition
     */
    this.emit(
      EVENTS.RENDITION.RESIZED,
      {
        width: size.width,
        height: size.height,
      },
      epubcfi
    );

    if (this.location && this.location.start) {
      this.display(epubcfi || this.location.start.cfi);
    }
  }

  /**
   * 방향 변경 이벤트를 보고하고 마지막으로 본 위치를 표시합니다.
   * @private
   *
   * @example
   * rendition.onOrientationChange('landscape');
   */
  onOrientationChange(orientation) {
    /**
     * Emit that the rendition has been rotated
     * @event orientationchange
     * @param {string} orientation
     * @memberof Rendition
     */
    this.emit(EVENTS.RENDITION.ORIENTATION_CHANGE, orientation);
  }

  /**
   * 렌더링을 특정 오프셋으로 이동합니다.
   * @param {object} offset - 이동할 오프셋
   * @param {number} offset.x - X축 오프셋
   * @param {number} offset.y - Y축 오프셋
   * @returns {void}
   *
   * @example
   * // 특정 위치로 이동
   * rendition.moveTo({ x: 100, y: 200 });
   * // 결과: 뷰포트가 지정된 좌표로 이동
   */
  moveTo(offset) {
    this.manager.moveTo(offset);
  }

  /**
   * 뷰의 크기를 조정합니다.
   * @param {number} [width] - 새로운 너비
   * @param {number} [height] - 새로운 높이
   * @param {string} [epubcfi] - (선택사항) 표시할 위치의 CFI
   * @returns {void}
   *
   * @example
   * // 크기만 조정
   * rendition.resize(800, 600);
   * // 결과: 뷰포트 크기가 800x600으로 변경
   *
   * // 크기 조정 및 특정 위치 표시
   * rendition.resize(800, 600, 'epubcfi(/6/4[chap01ref]!/4[body01])');
   * // 결과: 뷰포트 크기가 800x600으로 변경되고 지정된 위치가 표시됨
   */
  resize(width, height, epubcfi) {
    if (width) {
      this.settings.width = width;
    }
    if (height) {
      this.settings.height = height;
    }
    this.manager.resize(width, height, epubcfi);
  }

  /**
   * 모든 렌더링된 뷰를 지웁니다.
   * @returns {void}
   *
   * @example
   * rendition.clear();
   * // 결과: 모든 렌더링된 뷰가 제거됨
   */
  clear() {
    this.manager.clear();
  }

  /**
   * 렌더링의 다음 "페이지"로 이동합니다.
   * @returns {Promise<void>} 이동 프로미스
   *
   * @example
   * rendition.next()
   *   .then(() => {
   *     console.log('다음 페이지로 이동했습니다.');
   *   })
   *   .catch(error => {
   *     console.error('페이지 이동 중 오류 발생:', error);
   *   });
   */
  next() {
    return this.q
      .enqueue(this.manager.next.bind(this.manager))
      .then(this.reportLocation.bind(this));
  }

  /**
   * 렌더링의 이전 "페이지"로 이동합니다.
   * @returns {Promise<void>} 이동 프로미스
   *
   * @example
   * rendition.prev()
   *   .then(() => {
   *     console.log('이전 페이지로 이동했습니다.');
   *   })
   *   .catch(error => {
   *     console.error('페이지 이동 중 오류 발생:', error);
   *   });
   */
  prev() {
    return this.q
      .enqueue(this.manager.prev.bind(this.manager))
      .then(this.reportLocation.bind(this));
  }

  //-- http://www.idpf.org/epub/301/spec/epub-publications.html#meta-properties-rendering
  /**
   * 메타데이터와 설정에서 레이아웃 속성을 결정합니다.
   * @private
   * @param {object} metadata - EPUB 메타데이터
   * @return {object} 레이아웃 속성
   *
   * @example
   * const properties = rendition.determineLayoutProperties({
   *   layout: 'reflowable',
   *   spread: 'auto',
   *   orientation: 'auto'
   * });
   */
  determineLayoutProperties(metadata) {
    var properties;
    var layout = this.settings.layout || metadata.layout || "reflowable";
    var spread = this.settings.spread || metadata.spread || "auto";
    var orientation =
      this.settings.orientation || metadata.orientation || "auto";
    var flow = this.settings.flow || metadata.flow || "auto";
    var viewport = metadata.viewport || "";
    var minSpreadWidth =
      this.settings.minSpreadWidth || metadata.minSpreadWidth || 800;
    var direction = this.settings.direction || metadata.direction || "ltr";

    if (
      (this.settings.width === 0 || this.settings.width > 0) &&
      (this.settings.height === 0 || this.settings.height > 0)
    ) {
      // viewport = "width="+this.settings.width+", height="+this.settings.height+"";
    }

    properties = {
      layout: layout,
      spread: spread,
      orientation: orientation,
      flow: flow,
      viewport: viewport,
      minSpreadWidth: minSpreadWidth,
      direction: direction,
    };

    return properties;
  }

  /**
   * 렌더링의 흐름을 페이지화 또는 스크롤로 조정합니다.
   * @param {string} flow - 흐름 설정 ('paginated' 또는 'scrolled')
   * @returns {void}
   *
   * @example
   * // 페이지화된 보기로 설정
   * rendition.flow('paginated');
   * // 결과: 콘텐츠가 페이지 단위로 표시됨
   *
   * // 스크롤 보기로 설정
   * rendition.flow('scrolled');
   * // 결과: 콘텐츠가 연속적으로 스크롤 가능한 형태로 표시됨
   */
  flow(flow) {
    var _flow = flow;
    if (
      flow === "scrolled" ||
      flow === "scrolled-doc" ||
      flow === "scrolled-continuous"
    ) {
      _flow = "scrolled";
    }

    if (flow === "auto" || flow === "paginated") {
      _flow = "paginated";
    }

    this.settings.flow = flow;

    if (this._layout) {
      this._layout.flow(_flow);
    }

    if (this.manager && this._layout) {
      this.manager.applyLayout(this._layout);
    }

    if (this.manager) {
      this.manager.updateFlow(_flow);
    }

    if (this.manager && this.manager.isRendered() && this.location) {
      this.manager.clear();
      this.display(this.location.start.cfi);
    }
  }

  /**
   * 렌더링의 레이아웃을 조정합니다.
   * @param {object} settings - 레이아웃 설정
   * @param {string} settings.layout - 레이아웃 타입 ('reflowable' 또는 'pre-paginated')
   * @param {string} settings.spread - 스프레드 설정 ('none' 또는 'auto')
   * @param {string} settings.orientation - 방향 설정 ('auto', 'portrait', 'landscape')
   * @returns {Layout} 적용된 레이아웃 객체
   *
   * @example
   * rendition.layout({
   *   layout: 'reflowable',
   *   spread: 'auto',
   *   orientation: 'auto'
   * });
   * // 결과: 새로운 레이아웃 설정이 적용되고 Layout 객체가 반환됨
   */
  layout(settings) {
    if (settings) {
      this._layout = new Layout(settings);
      this._layout.spread(settings.spread, this.settings.minSpreadWidth);

      // this.mapping = new Mapping(this._layout.props);

      this._layout.on(EVENTS.LAYOUT.UPDATED, (props, changed) => {
        this.emit(EVENTS.RENDITION.LAYOUT, props, changed);
      });
    }

    if (this.manager && this._layout) {
      this.manager.applyLayout(this._layout);
    }

    return this._layout;
  }

  /**
   * 렌더링의 스프레드 사용 여부를 조정합니다.
   * @param {string} spread - 스프레드 설정 ('none' 또는 'auto')
   * @param {number} [min] - 스프레드 사용 최소 너비
   * @returns {void}
   *
   * @example
   * // 스프레드 비활성화
   * rendition.spread('none');
   * // 결과: 단일 페이지 보기로 변경
   *
   * // 스프레드 활성화 (최소 너비 800px)
   * rendition.spread('auto', 800);
   * // 결과: 화면 너비가 800px 이상일 때 스프레드 보기로 변경
   */
  spread(spread, min) {
    this.settings.spread = spread;

    if (min) {
      this.settings.minSpreadWidth = min;
    }

    if (this._layout) {
      this._layout.spread(spread, min);
    }

    if (this.manager && this.manager.isRendered()) {
      this.manager.updateLayout();
    }
  }

  /**
   * 렌더링의 텍스트 방향을 조정합니다.
   * @param {string} dir - 방향 ('ltr' 또는 'rtl')
   * @returns {void}
   *
   * @example
   * // 왼쪽에서 오른쪽으로
   * rendition.direction('ltr');
   * // 결과: 텍스트가 왼쪽에서 오른쪽으로 표시됨
   *
   * // 오른쪽에서 왼쪽으로
   * rendition.direction('rtl');
   * // 결과: 텍스트가 오른쪽에서 왼쪽으로 표시됨
   */
  direction(dir) {
    this.settings.direction = dir || "ltr";

    if (this.manager) {
      this.manager.direction(this.settings.direction);
    }

    if (this.manager && this.manager.isRendered() && this.location) {
      this.manager.clear();
      this.display(this.location.start.cfi);
    }
  }

  /**
   * 현재 위치를 보고합니다.
   * @fires relocated
   * @fires locationChanged
   * @returns {Promise<void>} 위치 보고 프로미스
   *
   * @example
   * rendition.reportLocation()
   *   .then(() => {
   *     console.log('현재 위치가 보고되었습니다.');
   *   });
   *
   * // 이벤트 리스너 예시
   * rendition.on('relocated', (location) => {
   *   console.log('현재 위치:', location);
   *   // 결과: { start: { cfi: 'epubcfi(...)', ... }, end: { ... } }
   * });
   */
  reportLocation() {
    return this.q.enqueue(
      function reportedLocation() {
        requestAnimationFrame(
          function reportedLocationAfterRAF() {
            var location = this.manager.currentLocation();
            if (
              location &&
              location.then &&
              typeof location.then === "function"
            ) {
              location.then(
                function (result) {
                  let located = this.located(result);

                  if (!located || !located.start || !located.end) {
                    return;
                  }

                  this.location = located;

                  this.emit(EVENTS.RENDITION.LOCATION_CHANGED, {
                    index: this.location.start.index,
                    href: this.location.start.href,
                    start: this.location.start.cfi,
                    end: this.location.end.cfi,
                    percentage: this.location.start.percentage,
                  });

                  this.emit(EVENTS.RENDITION.RELOCATED, this.location);
                }.bind(this)
              );
            } else if (location) {
              let located = this.located(location);

              if (!located || !located.start || !located.end) {
                return;
              }

              this.location = located;

              /**
               * @event locationChanged
               * @deprecated
               * @type {object}
               * @property {number} index
               * @property {string} href
               * @property {EpubCFI} start
               * @property {EpubCFI} end
               * @property {number} percentage
               * @memberof Rendition
               */
              this.emit(EVENTS.RENDITION.LOCATION_CHANGED, {
                index: this.location.start.index,
                href: this.location.start.href,
                start: this.location.start.cfi,
                end: this.location.end.cfi,
                percentage: this.location.start.percentage,
              });

              /**
               * @event relocated
               * @type {displayedLocation}
               * @memberof Rendition
               */
              this.emit(EVENTS.RENDITION.RELOCATED, this.location);
            }
          }.bind(this)
        );
      }.bind(this)
    );
  }

  /**
   * 현재 위치 객체를 가져옵니다.
   * @returns {Promise<displayedLocation>|displayedLocation} 현재 위치 객체 또는 프로미스
   *
   * @example
   * const location = rendition.currentLocation();
   * if (location.then) {
   *   location.then(loc => {
   *     console.log('현재 위치:', loc);
   *     // 결과: { start: { cfi: 'epubcfi(...)', ... }, end: { ... } }
   *   });
   * } else {
   *   console.log('현재 위치:', location);
   * }
   */
  currentLocation() {
    var location = this.manager.currentLocation();
    if (location && location.then && typeof location.then === "function") {
      location.then(
        function (result) {
          let located = this.located(result);
          return located;
        }.bind(this)
      );
    } else if (location) {
      let located = this.located(location);
      return located;
    }
  }

  /**
   * 매니저로부터 전달된 위치로부터 Rendition#locationRange를 생성합니다.
   * @private
   * @returns {displayedLocation}
   *
   * @example
   * const location = rendition.located({
   *   index: 0,
   *   href: 'chapter1.html',
   *   mapping: { start: 'epubcfi(/6/4[chap01ref])', end: 'epubcfi(/6/4[chap01ref]!/4[body01])' }
   * });
   */
  located(location) {
    if (!location.length) {
      return {};
    }
    let start = location[0];
    let end = location[location.length - 1];

    let located = {
      start: {
        index: start.index,
        href: start.href,
        cfi: start.mapping.start,
        displayed: {
          page: start.pages[0] || 1,
          total: start.totalPages,
        },
      },
      end: {
        index: end.index,
        href: end.href,
        cfi: end.mapping.end,
        displayed: {
          page: end.pages[end.pages.length - 1] || 1,
          total: end.totalPages,
        },
      },
    };

    let locationStart = this.book.locations.locationFromCfi(
      start.mapping.start
    );
    let locationEnd = this.book.locations.locationFromCfi(end.mapping.end);

    if (locationStart != null) {
      located.start.location = locationStart;
      located.start.percentage =
        this.book.locations.percentageFromLocation(locationStart);
    }
    if (locationEnd != null) {
      located.end.location = locationEnd;
      located.end.percentage =
        this.book.locations.percentageFromLocation(locationEnd);
    }

    let pageStart = this.book.pageList.pageFromCfi(start.mapping.start);
    let pageEnd = this.book.pageList.pageFromCfi(end.mapping.end);

    if (pageStart != -1) {
      located.start.page = pageStart;
    }
    if (pageEnd != -1) {
      located.end.page = pageEnd;
    }

    if (
      end.index === this.book.spine.last().index &&
      located.end.displayed.page >= located.end.displayed.total
    ) {
      located.atEnd = true;
    }

    if (
      start.index === this.book.spine.first().index &&
      located.start.displayed.page === 1
    ) {
      located.atStart = true;
    }

    return located;
  }

  /**
   * 렌더링을 제거하고 정리합니다.
   * @returns {void}
   *
   * @example
   * rendition.destroy();
   * // 결과: 모든 리소스가 해제되고 이벤트 리스너가 제거됨
   */
  destroy() {
    // Clear the queue
    // this.q.clear();
    // this.q = undefined;

    this.manager && this.manager.destroy();

    this.book = undefined;

    // this.views = null;

    // this.hooks.display.clear();
    // this.hooks.serialize.clear();
    // this.hooks.content.clear();
    // this.hooks.layout.clear();
    // this.hooks.render.clear();
    // this.hooks.show.clear();
    // this.hooks = {};

    // this.themes.destroy();
    // this.themes = undefined;

    // this.epubcfi = undefined;

    // this.starting = undefined;
    // this.started = undefined;
  }

  /**
   * 뷰의 Contents에서 이벤트를 전달합니다.
   * @private
   * @param {Contents} contents - 뷰 콘텐츠
   *
   * @example
   * rendition.passEvents(contents);
   */
  passEvents(contents) {
    DOM_EVENTS.forEach((e) => {
      contents.on(e, (ev) => this.triggerViewEvent(ev, contents));
    });

    contents.on(EVENTS.CONTENTS.SELECTED, (e) =>
      this.triggerSelectedEvent(e, contents)
    );
  }

  /**
   * 뷰로부터 전달된 이벤트를 발생시킵니다.
   * @private
   * @param {event} e - 이벤트 객체
   *
   * @example
   * rendition.triggerViewEvent(new Event('click'), contents);
   */
  triggerViewEvent(e, contents) {
    this.emit(e.type, e, contents);
  }

  /**
   * 뷰로부터 전달된 선택 이벤트의 CFI 범위를 발생시킵니다.
   * @private
   * @param {string} cfirange - CFI 범위
   *
   * @example
   * rendition.triggerSelectedEvent('epubcfi(/6/4[chap01ref]!/4[body01]/10[para05])', contents);
   */
  triggerSelectedEvent(cfirange, contents) {
    /**
     * Emit that a text selection has occurred
     * @event selected
     * @param {string} cfirange
     * @param {Contents} contents
     * @memberof Rendition
     */
    this.emit(EVENTS.RENDITION.SELECTED, cfirange, contents);
  }

  /**
   * 표시된 CFI로부터 범위를 가져옵니다.
   * @param {string} cfi - EpubCfi 문자열
   * @param {string} [ignoreClass] - 무시할 클래스
   * @returns {Range} 선택된 DOM 범위
   *
   * @example
   * const range = rendition.getRange('epubcfi(/6/4[chap01ref]!/4[body01]/10[para05])');
   * // 결과: Range { startContainer: Node, startOffset: 0, ... }
   *
   * // 특정 클래스 무시
   * const range = rendition.getRange('epubcfi(...)', 'ignore-me');
   * // 결과: 'ignore-me' 클래스를 가진 요소를 제외한 Range
   */
  getRange(cfi, ignoreClass) {
    var _cfi = new EpubCFI(cfi);
    var found = this.manager.visible().filter(function (view) {
      if (_cfi.spinePos === view.index) return true;
    });

    // Should only every return 1 item
    if (found.length) {
      return found[0].contents.range(_cfi, ignoreClass);
    }
  }

  /**
   * 열에 맞게 이미지 크기를 조정하는 훅입니다.
   * @private
   * @param {Contents} contents - 콘텐츠 객체
   *
   * @example
   * rendition.adjustImages(contents);
   */
  adjustImages(contents) {
    if (this._layout.name === "pre-paginated") {
      return new Promise(function (resolve) {
        resolve();
      });
    }

    let computed = contents.window.getComputedStyle(contents.content, null);
    let height =
      (contents.content.offsetHeight -
        (parseFloat(computed.paddingTop) +
          parseFloat(computed.paddingBottom))) *
      0.95;
    let horizontalPadding =
      parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);

    contents.addStylesheetRules({
      img: {
        "max-width":
          (this._layout.columnWidth
            ? this._layout.columnWidth - horizontalPadding + "px"
            : "100%") + "!important",
        "max-height": height + "px" + "!important",
        "object-fit": "contain",
        "page-break-inside": "avoid",
        "break-inside": "avoid",
        "box-sizing": "border-box",
      },
      svg: {
        "max-width":
          (this._layout.columnWidth
            ? this._layout.columnWidth - horizontalPadding + "px"
            : "100%") + "!important",
        "max-height": height + "px" + "!important",
        "page-break-inside": "avoid",
        "break-inside": "avoid",
      },
    });

    return new Promise(function (resolve, reject) {
      // Wait to apply
      setTimeout(function () {
        resolve();
      }, 1);
    });
  }

  /**
   * 렌더링된 각 뷰의 Contents 객체를 가져옵니다.
   * @returns {Contents[]} 콘텐츠 객체 배열
   *
   * @example
   * const contents = rendition.getContents();
   * contents.forEach(content => {
   *   console.log('콘텐츠:', content);
   *   // 결과: [Contents { window: Window, content: HTMLElement, ... }, ...]
   * });
   */
  getContents() {
    return this.manager ? this.manager.getContents() : [];
  }

  /**
   * 매니저로부터 뷰 멤버를 가져옵니다.
   * @returns {View[]} 뷰 배열
   *
   * @example
   * const views = rendition.views();
   * views.forEach(view => {
   *   console.log('뷰:', view);
   *   // 결과: [View { element: HTMLElement, ... }, ...]
   * });
   */
  views() {
    let views = this.manager ? this.manager.views : undefined;
    return views || [];
  }

  /**
   * 렌더링된 콘텐츠의 링크 클릭을 처리하는 훅입니다.
   * @private
   * @param {Contents} contents - 콘텐츠 객체
   *
   * @example
   * rendition.handleLinks(contents);
   */
  handleLinks(contents) {
    if (contents) {
      contents.on(EVENTS.CONTENTS.LINK_CLICKED, (href) => {
        let relative = this.book.path.relative(href);
        this.display(relative);
      });
    }
  }

  /**
   * 섹션이 직렬화되기 전에 스타일시트를 주입하는 훅입니다.
   * @private
   * @param {document} doc - 문서 객체
   * @param {Section} section - 섹션 객체
   *
   * @example
   * rendition.injectStylesheet(document, section);
   */
  injectStylesheet(doc, section) {
    let style = doc.createElement("link");
    style.setAttribute("type", "text/css");
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("href", this.settings.stylesheet);
    doc.getElementsByTagName("head")[0].appendChild(style);
  }

  /**
   * 섹션이 직렬화되기 전에 스크립트를 주입하는 훅입니다.
   * @private
   * @param {document} doc - 문서 객체
   * @param {Section} section - 섹션 객체
   *
   * @example
   * rendition.injectScript(document, section);
   */
  injectScript(doc, section) {
    let script = doc.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", this.settings.script);
    script.textContent = " "; // Needed to prevent self closing tag
    doc.getElementsByTagName("head")[0].appendChild(script);
  }

  /**
   * 섹션이 직렬화되기 전에 문서 식별자를 주입하는 훅입니다.
   * @private
   * @param {document} doc - 문서 객체
   * @param {Section} section - 섹션 객체
   *
   * @example
   * rendition.injectIdentifier(document, section);
   */
  injectIdentifier(doc, section) {
    let ident = this.book.packaging.metadata.identifier;
    let meta = doc.createElement("meta");
    meta.setAttribute("name", "dc.relation.ispartof");
    if (ident) {
      meta.setAttribute("content", ident);
    }
    doc.getElementsByTagName("head")[0].appendChild(meta);
  }
}

//-- Enable binding events to Renderer
EventEmitter(Rendition.prototype);

export default Rendition;
