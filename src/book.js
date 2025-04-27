import EventEmitter from "event-emitter";
import { extend, defer } from "./utils/core";
import Url from "./utils/url";
import Path from "./utils/path";
import Spine from "./spine";
import Locations from "./locations";
import Container from "./container";
import Packaging from "./packaging";
import Navigation from "./navigation";
import Resources from "./resources";
import PageList from "./pagelist";
import Rendition from "./rendition";
import Archive from "./archive";
import request from "./utils/request";
import EpubCFI from "./epubcfi";
import Store from "./store";
import DisplayOptions from "./displayoptions";
import { EPUBJS_VERSION, EVENTS } from "./utils/constants";

const CONTAINER_PATH = "META-INF/container.xml";
const IBOOKS_DISPLAY_OPTIONS_PATH =
  "META-INF/com.apple.ibooks.display-options.xml";

const INPUT_TYPE = {
  BINARY: "binary",
  BASE64: "base64",
  EPUB: "epub",
  OPF: "opf",
  MANIFEST: "json",
  DIRECTORY: "directory",
};

/**
 * An Epub representation with methods for the loading, parsing and manipulation
 * of its contents.
 * @class
 * @param {string} [url]
 * @param {object} [options]
 * @param {method} [options.requestMethod] a request function to use instead of the default
 * @param {boolean} [options.requestCredentials=undefined] send the xhr request withCredentials
 * @param {object} [options.requestHeaders=undefined] send the xhr request headers
 * @param {string} [options.encoding=binary] optional to pass 'binary' or base64' for archived Epubs
 * @param {string} [options.replacements=none] use base64, blobUrl, or none for replacing assets in archived Epubs
 * @param {method} [options.canonical] optional function to determine canonical urls for a path
 * @param {string} [options.openAs] optional string to determine the input type
 * @param {string} [options.store=false] cache the contents in local storage, value should be the name of the reader
 * @returns {Book}
 * @example new Book("/path/to/book.epub", {})
 * @example new Book({ replacements: "blobUrl" })
 */
class Book {
  constructor(url, options) {
    // Allow passing just options to the Book
    if (
      typeof options === "undefined" &&
      typeof url !== "string" &&
      url instanceof Blob === false &&
      url instanceof ArrayBuffer === false
    ) {
      options = url;
      url = undefined;
    }

    this.settings = extend(this.settings || {}, {
      requestMethod: undefined,
      requestCredentials: undefined,
      requestHeaders: undefined,
      encoding: undefined,
      replacements: undefined,
      canonical: undefined,
      openAs: undefined,
      store: undefined,
    });

    extend(this.settings, options);

    // Promises
    this.opening = new defer();
    /**
     * @member {promise} opened returns after the book is loaded
     * @memberof Book
     */
    this.opened = this.opening.promise;
    this.isOpen = false;

    this.loading = {
      manifest: new defer(),
      spine: new defer(),
      metadata: new defer(),
      cover: new defer(),
      navigation: new defer(),
      pageList: new defer(),
      resources: new defer(),
      displayOptions: new defer(),
    };

    this.loaded = {
      manifest: this.loading.manifest.promise,
      spine: this.loading.spine.promise,
      metadata: this.loading.metadata.promise,
      cover: this.loading.cover.promise,
      navigation: this.loading.navigation.promise,
      pageList: this.loading.pageList.promise,
      resources: this.loading.resources.promise,
      displayOptions: this.loading.displayOptions.promise,
    };

    /**
     * @member {promise} ready returns after the book is loaded and parsed
     * @memberof Book
     * @private
     */
    this.ready = Promise.all([
      this.loaded.manifest,
      this.loaded.spine,
      this.loaded.metadata,
      this.loaded.cover,
      this.loaded.navigation,
      this.loaded.resources,
      this.loaded.displayOptions,
    ]);

    // Queue for methods used before opening
    this.isRendered = false;
    // this._q = queue(this);

    /**
     * @member {method} request
     * @memberof Book
     * @private
     */
    this.request = this.settings.requestMethod || request;

    /**
     * @member {Spine} spine
     * @memberof Book
     */
    this.spine = new Spine();

    /**
     * @member {Locations} locations
     * @memberof Book
     */
    this.locations = new Locations(this.spine, this.load.bind(this));

    /**
     * @member {Navigation} navigation
     * @memberof Book
     */
    this.navigation = undefined;

    /**
     * @member {PageList} pagelist
     * @memberof Book
     */
    this.pageList = undefined;

    /**
     * @member {Url} url
     * @memberof Book
     * @private
     */
    this.url = undefined;

    /**
     * @member {Path} path
     * @memberof Book
     * @private
     */
    this.path = undefined;

    /**
     * @member {boolean} archived
     * @memberof Book
     * @private
     */
    this.archived = false;

    /**
     * @member {Archive} archive
     * @memberof Book
     * @private
     */
    this.archive = undefined;

    /**
     * @member {Store} storage
     * @memberof Book
     * @private
     */
    this.storage = undefined;

    /**
     * @member {Resources} resources
     * @memberof Book
     * @private
     */
    this.resources = undefined;

    /**
     * @member {Rendition} rendition
     * @memberof Book
     * @private
     */
    this.rendition = undefined;

    /**
     * @member {Container} container
     * @memberof Book
     * @private
     */
    this.container = undefined;

    /**
     * @member {Packaging} packaging
     * @memberof Book
     * @private
     */
    this.packaging = undefined;

    /**
     * @member {DisplayOptions} displayOptions
     * @memberof DisplayOptions
     * @private
     */
    this.displayOptions = undefined;

    // this.toc = undefined;
    if (this.settings.store) {
      this.store(this.settings.store);
    }

    if (url) {
      this.open(url, this.settings.openAs).catch((error) => {
        var err = new Error("Cannot load book at " + url);
        this.emit(EVENTS.BOOK.OPEN_FAILED, err);
      });
    }
  }

  /**
   * Open a epub or url
   * @param {string | ArrayBuffer} input Url, Path or ArrayBuffer
   * @param {string} [what="binary", "base64", "epub", "opf", "json", "directory"] force opening as a certain type
   * @returns {Promise} of when the book has been loaded
   * @example book.open("/path/to/book.epub")
   */
  open(input, what) {
    var opening;
    var type = what || this.determineType(input);

    if (type === INPUT_TYPE.BINARY) {
      this.archived = true;
      this.url = new Url("/", "");
      opening = this.openEpub(input);
    } else if (type === INPUT_TYPE.BASE64) {
      this.archived = true;
      this.url = new Url("/", "");
      opening = this.openEpub(input, type);
    } else if (type === INPUT_TYPE.EPUB) {
      this.archived = true;
      this.url = new Url("/", "");
      opening = this.request(
        input,
        "binary",
        this.settings.requestCredentials,
        this.settings.requestHeaders
      ).then(this.openEpub.bind(this));
    } else if (type == INPUT_TYPE.OPF) {
      this.url = new Url(input);
      opening = this.openPackaging(this.url.Path.toString());
    } else if (type == INPUT_TYPE.MANIFEST) {
      this.url = new Url(input);
      opening = this.openManifest(this.url.Path.toString());
    } else {
      this.url = new Url(input);
      opening = this.openContainer(CONTAINER_PATH).then(
        this.openPackaging.bind(this)
      );
    }

    return opening;
  }

  /**
   * Open an archived epub
   * @private
   * @param  {binary} data
   * @param  {string} [encoding]
   * @return {Promise}
   */
  openEpub(data, encoding) {
    // unarchive 압축 풀기
    return this.unarchive(data, encoding || this.settings.encoding)
      .then(() => {
        // 컨테이너 파일 로드
        return this.openContainer(CONTAINER_PATH);
      })
      .then((packagePath) => {
        // 패키징 파일 로드
        return this.openPackaging(packagePath);
      });
  }

  /**
   * Open the epub container
   * @private
   * @param  {string} url
   * @return {string} packagePath
   */
  openContainer(url) {
    return this.load(url).then((xml) => {
      this.container = new Container(xml);
      return this.resolve(this.container.packagePath);
    });
  }

  /**
   * Open the Open Packaging Format Xml
   * @private
   * @param  {string} url
   * @return {Promise}
   */
  openPackaging(url) {
    this.path = new Path(url);
    return this.load(url).then((xml) => {
      this.packaging = new Packaging(xml);
      return this.unpack(this.packaging);
    });
  }

  /**
   * Open the manifest JSON
   * @private
   * @param  {string} url
   * @return {Promise}
   */
  openManifest(url) {
    this.path = new Path(url);
    return this.load(url).then((json) => {
      this.packaging = new Packaging();
      this.packaging.load(json);
      return this.unpack(this.packaging);
    });
  }

  /**
   * Book에서 리소스를 로드하는 메소드
   * @param  {string} path - 로드할 리소스의 경로
   * @return {Promise} - 요청된 리소스를 포함하는 Promise 객체
   * @example
   * // 컨테이너 파일 로드
   * book.load('META-INF/container.xml').then((container) => {
   *   console.log(container); // XMLDocument 객체 반환
   *   // 예시 출력:
   *   // <?xml version="1.0" encoding="UTF-8"?>
   *   // <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   *   //   <rootfiles>
   *   //     <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   *   //   </rootfiles>
   *   // </container>
   * });
   *
   * @example
   * // HTML 콘텐츠 로드
   * book.load('OEBPS/chapter1.xhtml').then((content) => {
   *   console.log(content); // Document 객체 반환
   *   // 예시 출력:
   *   // <html xmlns="http://www.w3.org/1999/xhtml">
   *   //   <head>...</head>
   *   //   <body>
   *   //     <h1>Chapter 1</h1>
   *   //     <p>This is the first chapter...</p>
   *   //   </body>
   *   // </html>
   * });
   *
   * @example
   * // 이미지 리소스 로드
   * book.load('OEBPS/images/cover.jpg').then((blob) => {
   *   console.log(blob); // Blob 객체 반환
   *   // 예시 출력:
   *   // Blob {
   *   //   size: 123456,
   *   //   type: "image/jpeg",
   *   //   ...
   *   // }
   *   const imgUrl = URL.createObjectURL(blob);
   *   document.getElementById('cover').src = imgUrl;
   * });
   *
   * @example
   * // CSS 파일 로드
   * book.load('OEBPS/styles/style.css').then((css) => {
   *   console.log(css); // 문자열 반환
   *   // 예시 출력:
   *   // body {
   *   //   font-family: serif;
   *   //   line-height: 1.5;
   *   //   margin: 2em;
   *   // }
   *   // h1 {
   *   //   font-size: 2em;
   *   //   margin-bottom: 1em;
   *   // }
   *   const style = document.createElement('style');
   *   style.textContent = css;
   *   document.head.appendChild(style);
   * });
   */
  load(path) {
    var resolved = this.resolve(path);
    if (this.archived) {
      return this.archive.request(resolved);
    } else {
      return this.request(
        resolved,
        null,
        this.settings.requestCredentials,
        this.settings.requestHeaders
      );
    }
  }

  /**
   * 상대 경로를 절대 경로로 변환하는 메소드
   * @param {string} path - 변환할 상대 경로
   * @param {boolean} [absolute=true] - 절대 URL로 변환할지 여부
   * @returns {string|undefined} 변환된 경로 또는 undefined
   * @example
   * // 상대 경로를 절대 경로로 변환하는 예시
   * const book = new Book();
   * book.path = "OPS/";
   * book.url = "http://example.com/ebook/";
   *
   * // 상대 경로만 변환
   * console.log(book.resolve("chapter1.xhtml", false));
   * // 결과: "OPS/chapter1.xhtml"
   *
   * // 절대 URL로 변환
   * console.log(book.resolve("chapter1.xhtml"));
   * // 결과: "http://example.com/ebook/OPS/chapter1.xhtml"
   *
   * // 이미 절대 URL인 경우
   * console.log(book.resolve("http://example.com/chapter1.xhtml"));
   * // 결과: "http://example.com/chapter1.xhtml"
   *
   * // path가 없는 경우
   * console.log(book.resolve("chapter1.xhtml"));
   * // 결과: "chapter1.xhtml"
   */
  resolve(path, absolute) {
    if (!path) {
      return;
    }
    var resolved = path;
    var isAbsolute = path.indexOf("://") > -1;

    if (isAbsolute) {
      return path;
    }

    if (this.path) {
      resolved = this.path.resolve(path);
    }

    if (absolute != false && this.url) {
      resolved = this.url.resolve(resolved);
    }

    return resolved;
  }

  /**
   * Get a canonical link to a path
   * @param  {string} path - The path to convert to a canonical URL
   * @return {string} the canonical path string
   * @example
   * // 기본 사용 예시
   * const book = new Book();
   * book.url = "http://example.com/ebook/";
   *
   * // 상대 경로를 정규화된 URL로 변환
   * console.log(book.canonical("../images/cover.jpg"));
   * // 결과: "http://example.com/ebook/images/cover.jpg"
   *
   * // CSS 파일 경로 변환
   * console.log(book.canonical("styles/main.css"));
   * // 결과: "http://example.com/ebook/styles/main.css"
   *
   * // HTML 파일 경로 변환
   * console.log(book.canonical("chapters/chapter1.xhtml"));
   * // 결과: "http://example.com/ebook/chapters/chapter1.xhtml"
   *
   * // 사용자 정의 canonical 함수 사용 예시
   * book.settings.canonical = (path) => {
   *   return `https://cdn.example.com/books/123/${path}`;
   * };
   * console.log(book.canonical("images/cover.jpg"));
   * // 결과: "https://cdn.example.com/books/123/images/cover.jpg"
   *
   * // 빈 경로 처리
   * console.log(book.canonical(""));
   * // 결과: ""
   */
  canonical(path) {
    var url = path;

    if (!path) {
      return "";
    }

    if (this.settings.canonical) {
      url = this.settings.canonical(path);
    } else {
      url = this.resolve(path, true);
    }

    return url;
  }

  /**
   * Determine the type of they input passed to open
   * @private
   * @param  {string} input
   * @return {string}  binary | directory | epub | opf
   * @example
   * // ePub 파일 경로에서 유형 결정
   * book.determineType("/path/to/book.epub"); // "epub"
   *
   * // OPF 파일에서 유형 결정
   * book.determineType("/path/to/content.opf"); // "opf"
   *
   * // base64 인코딩된 데이터의 유형 결정
   * book.determineType(base64Content); // "base64"
   *
   * // 디렉토리 경로의 유형 결정
   * book.determineType("/path/to/dir/"); // "directory"
   */
  determineType(input) {
    var url;
    var path;
    var extension;

    if (this.settings.encoding === "base64") {
      return INPUT_TYPE.BASE64;
    }

    if (typeof input != "string") {
      return INPUT_TYPE.BINARY;
    }

    url = new Url(input);
    path = url.path();
    extension = path.extension;

    // If there's a search string, remove it before determining type
    if (extension) {
      extension = extension.replace(/\?.*$/, "");
    }

    if (!extension) {
      return INPUT_TYPE.DIRECTORY;
    }

    if (extension === "epub") {
      return INPUT_TYPE.EPUB;
    }

    if (extension === "opf") {
      return INPUT_TYPE.OPF;
    }

    if (extension === "json") {
      return INPUT_TYPE.MANIFEST;
    }
  }

  /**
   * EPUB 패키지의 내용을 해제하고 필요한 정보를 설정
   * @private
   * @param {Packaging} packaging - EPUB 패키징 정보 객체
   * @example
   * // EPUB 패키지 해제 예시
   * const book = new Book();
   * const packaging = new Packaging(packageDocument);
   * book.unpack(packaging);
   * // 결과:
   * // - spine: [{ id: "chapter1", href: "ch1.xhtml", ... }, ...]
   * // - resources: [{ id: "img1", href: "images/1.jpg", ... }, ...]
   * // - navigation: { toc: [{ title: "Chapter 1", href: "ch1.xhtml", ... }, ...] }
   * // - pageList: [{ title: "Page 1", href: "ch1.xhtml#page1", ... }, ...]
   * // - cover: "images/cover.jpg"
   * // - metadata: { title: "책 제목", creator: "작가", ... }
   * // - displayOptions: { layout: "reflowable", orientation: "auto", ... }
   *
   * @description
   * 이 메소드는 다음과 같은 작업을 수행합니다:
   * 1. 패키징 정보에서 메타데이터, 스파인, 매니페스트 정보를 추출
   * 2. 네비게이션과 페이지 목록을 로드
   * 3. 리소스 관리자를 초기화
   * 4. 커버 이미지 경로 설정
   * 5. 디스플레이 옵션 설정
   * 6. 모든 로딩 작업이 완료되면 opened 프로미스를 resolve
   */
  unpack(packaging) {
    this.package = packaging; //TODO: deprecated this

    if (this.packaging.metadata.layout === "") {
      // rendition:layout not set - check display options if book is pre-paginated
      this.load(this.url.resolve(IBOOKS_DISPLAY_OPTIONS_PATH))
        .then((xml) => {
          this.displayOptions = new DisplayOptions(xml);
          this.loading.displayOptions.resolve(this.displayOptions);
        })
        .catch((err) => {
          this.displayOptions = new DisplayOptions();
          this.loading.displayOptions.resolve(this.displayOptions);
        });
    } else {
      this.displayOptions = new DisplayOptions();
      this.loading.displayOptions.resolve(this.displayOptions);
    }

    this.spine.unpack(
      this.packaging,
      this.resolve.bind(this),
      this.canonical.bind(this)
    );

    this.resources = new Resources(this.packaging.manifest, {
      archive: this.archive,
      resolver: this.resolve.bind(this),
      request: this.request.bind(this),
      replacements:
        this.settings.replacements || (this.archived ? "blobUrl" : "base64"),
    });

    this.loadNavigation(this.packaging).then(() => {
      // this.toc = this.navigation.toc;
      this.loading.navigation.resolve(this.navigation);
    });

    if (this.packaging.coverPath) {
      this.cover = this.resolve(this.packaging.coverPath);
    }
    // Resolve promises
    this.loading.manifest.resolve(this.packaging.manifest);
    this.loading.metadata.resolve(this.packaging.metadata);
    this.loading.spine.resolve(this.spine);
    this.loading.cover.resolve(this.cover);
    this.loading.resources.resolve(this.resources);
    this.loading.pageList.resolve(this.pageList);

    this.isOpen = true;

    if (
      this.archived ||
      (this.settings.replacements && this.settings.replacements != "none")
    ) {
      this.replacements()
        .then(() => {
          this.loaded.displayOptions.then(() => {
            this.opening.resolve(this);
          });
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      // Resolve book opened promise
      this.loaded.displayOptions.then(() => {
        this.opening.resolve(this);
      });
    }
  }

  /**
   * Load Navigation and PageList from package
   * @private
   * @param {Packaging} packaging
   */
  loadNavigation(packaging) {
    let navPath = packaging.navPath || packaging.ncxPath;
    let toc = packaging.toc;

    // From json manifest
    if (toc) {
      return new Promise((resolve, reject) => {
        this.navigation = new Navigation(toc);

        if (packaging.pageList) {
          this.pageList = new PageList(packaging.pageList); // TODO: handle page lists from Manifest
        }

        resolve(this.navigation);
      });
    }

    if (!navPath) {
      return new Promise((resolve, reject) => {
        this.navigation = new Navigation();
        this.pageList = new PageList();

        resolve(this.navigation);
      });
    }

    return this.load(navPath, "xml").then((xml) => {
      this.navigation = new Navigation(xml);
      this.pageList = new PageList(xml);
      return this.navigation;
    });
  }

  /**
   * Gets a Section of the Book from the Spine
   * Alias for `book.spine.get`
   * @param {string} target
   * @return {Section}
   */
  section(target) {
    return this.spine.get(target);
  }

  /**
   * Sugar to render a book to an element
   * @param  {element | string} element element or string to add a rendition to
   * @param  {object} [options]
   * @param  {string} [options.width] width of the rendition
   * @param  {string} [options.height] height of the rendition
   * @param  {string} [options.spread] spread setting ('none', 'auto', 'always')
   * @param  {string} [options.minSpreadWidth] minimum width for spreads
   * @param  {boolean} [options.flow] flow mode setting
   * @param  {string} [options.layout] layout setting ('reflowable', 'pre-paginated')
   * @param  {string} [options.orientation] orientation setting ('auto', 'landscape', 'portrait')
   * @param  {string} [options.scroll] scroll setting ('auto', 'paginated')
   * @param  {string} [options.direction] text direction ('ltr', 'rtl')
   * @param  {string} [options.fontSize] font size
   * @param  {string} [options.fontFamily] font family
   * @param  {string} [options.theme] theme setting ('light', 'dark', 'sepia')
   * @return {Rendition}
   * @example
   * // 기본 사용 예시
   * const book = new Book();
   * const element = document.getElementById('viewer');
   * const rendition = book.renderTo(element);
   * // 결과: element 내부에 EPUB 뷰어가 렌더링됨
   *
   * @example
   * // 옵션을 사용한 렌더링
   * const options = {
   *   width: '100%',
   *   height: '600px',
   *   spread: 'auto',
   *   flow: 'paginated',
   *   theme: 'dark',
   *   fontSize: '16px',
   *   fontFamily: 'Georgia, serif'
   * };
   * book.renderTo(element, options);
   * // 결과: 지정된 옵션으로 EPUB 뷰어가 렌더링됨
   *
   * @example
   * // 문자열로 요소 선택
   * book.renderTo('#viewer', {
   *   width: '800px',
   *   height: '600px'
   * });
   * // 결과: '#viewer' 선택자로 찾은 요소에 EPUB 뷰어가 렌더링됨
   *
   * @description
   * 이 메소드는 다음과 같은 작업을 수행합니다:
   * 1. 전달된 요소나 선택자에 Rendition 객체를 생성
   * 2. 지정된 옵션을 적용하여 EPUB 뷰어를 설정
   * 3. 뷰어를 요소에 연결하고 렌더링
   *
   * 주요 옵션 설명:
   * - width/height: 뷰어의 크기 설정
   * - spread: 페이지 스프레드 설정 (none: 단일 페이지, auto: 자동, always: 항상 스프레드)
   * - flow: 페이지 흐름 모드 (paginated: 페이지별, scrolled: 스크롤)
   * - layout: 레이아웃 모드 (reflowable: 리플로우 가능, pre-paginated: 고정 레이아웃)
   * - theme: 테마 설정 (light: 밝은 테마, dark: 어두운 테마, sepia: 세피아)
   * - fontSize/fontFamily: 글꼴 설정
   * - direction: 텍스트 방향 (ltr: 왼쪽에서 오른쪽, rtl: 오른쪽에서 왼쪽)
   */
  renderTo(element, options) {
    this.rendition = new Rendition(this, options);
    this.rendition.attachTo(element);

    return this.rendition;
  }

  /**
   * Set if request should use withCredentials
   * @param {boolean} credentials
   */
  setRequestCredentials(credentials) {
    this.settings.requestCredentials = credentials;
  }

  /**
   * Set headers request should use
   * @param {object} headers
   */
  setRequestHeaders(headers) {
    this.settings.requestHeaders = headers;
  }

  /**
   * Unarchive a zipped epub
   * @private
   * @param  {binary} input epub data
   * @param  {string} [encoding]
   * @return {Archive}
   */
  unarchive(input, encoding) {
    this.archive = new Archive();
    return this.archive.open(input, encoding);
  }

  /**
   * EPUB 책의 내용을 로컬 스토리지에 저장하는 메소드
   *
   * 이 메소드는 EPUB의 내용을 로컬 스토리지에 저장하여 오프라인에서도 책을 읽을 수 있게 합니다.
   * 리소스(이미지, CSS 등)는 Blob URL이나 Base64 형식으로 변환되어 저장됩니다.
   *
   * @param {string} name - 저장소의 이름. 여러 책을 구분하기 위해 사용됩니다.
   * @returns {Store} 생성된 Store 인스턴스
   *
   * @example
   * // 기본 사용 예시
   * const book = new Book("/path/to/book.epub");
   * book.store("my-book");
   * // 결과: "my-book"이라는 이름으로 로컬 스토리지에 책의 내용이 저장됩니다.
   *
   * @example
   * // 오프라인 상태에서의 사용
   * book.store("offline-book");
   * // 결과:
   * // - 리소스들이 Blob URL로 변환되어 저장됨
   * // - 오프라인 상태에서도 저장된 내용에 접근 가능
   * // - 상대 경로를 사용하여 리소스 참조
   *
   * @example
   * // 온라인 상태에서의 사용
   * book.store("online-book");
   * // 결과:
   * // - 원래의 URL을 사용하여 리소스 로드
   * // - 온라인 상태에서는 실시간으로 리소스 업데이트 가능
   */
  store(name) {
    // Use "blobUrl" or "base64" for replacements
    let replacementsSetting =
      this.settings.replacements && this.settings.replacements !== "none";
    // Save original url
    let originalUrl = this.url;
    // Save original request method
    let requester = this.settings.requestMethod || request.bind(this);
    // Create new Store
    this.storage = new Store(name, requester, this.resolve.bind(this));
    // Replace request method to go through store
    this.request = this.storage.request.bind(this.storage);

    this.opened.then(() => {
      if (this.archived) {
        this.storage.requester = this.archive.request.bind(this.archive);
      }
      // Substitute hook
      let substituteResources = (output, section) => {
        section.output = this.resources.substitute(output, section.url);
      };

      // Set to use replacements
      this.resources.settings.replacements = replacementsSetting || "blobUrl";
      // Create replacement urls
      this.resources.replacements().then(() => {
        return this.resources.replaceCss();
      });

      this.storage.on("offline", () => {
        // Remove url to use relative resolving for hrefs
        this.url = new Url("/", "");
        // Add hook to replace resources in contents
        this.spine.hooks.serialize.register(substituteResources);
      });

      this.storage.on("online", () => {
        // Restore original url
        this.url = originalUrl;
        // Remove hook
        this.spine.hooks.serialize.deregister(substituteResources);
      });
    });

    return this.storage;
  }

  /**
   * Get the cover url
   * @return {Promise<?string>} coverUrl
   */
  coverUrl() {
    return this.loaded.cover.then(() => {
      if (!this.cover) {
        return null;
      }

      if (this.archived) {
        return this.archive.createUrl(this.cover);
      } else {
        return this.cover;
      }
    });
  }

  /**
   * EPUB 책의 리소스(이미지, CSS 등)를 대체하는 메소드
   *
   * 이 메소드는 EPUB 책의 리소스를 브라우저에서 올바르게 표시하기 위해 필요한 대체 작업을 수행합니다.
   * 특히 압축된 EPUB 파일이나 리소스 대체가 필요한 경우에 사용됩니다.
   *
   * @private
   * @returns {Promise<void>} 리소스 대체 작업이 완료된 Promise
   *
   * @example
   * // 기본 사용 예시
   * book.replacements().then(() => {
   *   console.log('리소스 대체 완료');
   * });
   *
   * @example
   * // 리소스 대체 후 CSS 처리
   * book.replacements().then(() => {
   *   // CSS 파일의 URL이 대체된 후 추가 작업 수행
   *   return book.resources.replaceCss();
   * });
   *
   * @description
   * 이 메소드는 다음과 같은 작업을 수행합니다:
   * 1. spine의 serialize 훅에 리소스 대체 함수를 등록
   * 2. resources.replacements()를 호출하여 리소스 URL을 대체
   * 3. resources.replaceCss()를 호출하여 CSS 파일의 URL을 대체
   *
   * 리소스 대체는 다음과 같은 경우에 필요합니다:
   * - EPUB 파일이 압축된 경우 (this.archived === true)
   * - settings.replacements가 "none"이 아닌 경우
   *
   * 대체된 리소스는 다음과 같은 형식으로 변환됩니다:
   * - 이미지: base64 또는 blob URL
   * - CSS: 상대 경로가 절대 경로로 변환
   * - 다른 리소스: 적절한 형식으로 변환
   */
  replacements() {
    this.spine.hooks.serialize.register((output, section) => {
      section.output = this.resources.substitute(output, section.url);
    });

    return this.resources.replacements().then(() => {
      return this.resources.replaceCss();
    });
  }

  /**
   * Find a DOM Range for a given CFI Range
   * @param  {EpubCFI} cfiRange a epub cfi range
   * @return {Promise<Range>} A promise that resolves to a DOM Range object
   * @example
   * // 기본 사용 예시
   * const book = new Book();
   * const cfi = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2]";
   * book.getRange(cfi).then((range) => {
   *   console.log(range);
   *   // 결과: Range {
   *   //   startContainer: <p>...</p>,
   *   //   startOffset: 1,
   *   //   endContainer: <p>...</p>,
   *   //   endOffset: 3
   *   // }
   * });
   *
   * @example
   * // 선택된 텍스트 하이라이트 예시
   * book.getRange(cfi).then((range) => {
   *   const highlight = document.createElement('span');
   *   highlight.className = 'highlight';
   *   range.surroundContents(highlight);
   * });
   *
   * @example
   * // CFI를 찾을 수 없는 경우
   * book.getRange('invalid-cfi').catch((error) => {
   *   console.error(error); // "CFI could not be found"
   * });
   *
   * @description
   * 이 메소드는 다음과 같은 작업을 수행합니다:
   * 1. CFI 문자열을 EpubCFI 객체로 파싱
   * 2. CFI의 spine 위치를 사용하여 해당 문서를 로드
   * 3. 로드된 문서에서 CFI에 해당하는 DOM Range 객체를 생성
   *
   * DOM Range는 문서 내의 연속된 콘텐츠 범위를 나타내며, 다음과 같은 용도로 사용됩니다:
   * - 텍스트 선택 및 하이라이트
   * - 주석 추가
   * - 특정 콘텐츠에 대한 작업 수행
   */
  getRange(cfiRange) {
    var cfi = new EpubCFI(cfiRange);
    var item = this.spine.get(cfi.spinePos);
    var _request = this.load.bind(this);
    if (!item) {
      return new Promise((resolve, reject) => {
        reject("CFI could not be found");
      });
    }
    return item.load(_request).then(function (contents) {
      var range = cfi.toRange(item.document);
      return range;
    });
  }

  /**
   * Generates the Book Key using the identifier in the manifest or other string provided
   * @param  {string} [identifier] to use instead of metadata identifier
   * @return {string} key
   */
  key(identifier) {
    var ident =
      identifier || this.packaging.metadata.identifier || this.url.filename;
    return `epubjs:${EPUBJS_VERSION}:${ident}`;
  }

  /**
   * Destroy the Book and all associated objects
   */
  destroy() {
    this.opened = undefined;
    this.loading = undefined;
    this.loaded = undefined;
    this.ready = undefined;

    this.isOpen = false;
    this.isRendered = false;

    this.spine && this.spine.destroy();
    this.locations && this.locations.destroy();
    this.pageList && this.pageList.destroy();
    this.archive && this.archive.destroy();
    this.resources && this.resources.destroy();
    this.container && this.container.destroy();
    this.packaging && this.packaging.destroy();
    this.rendition && this.rendition.destroy();
    this.displayOptions && this.displayOptions.destroy();

    this.spine = undefined;
    this.locations = undefined;
    this.pageList = undefined;
    this.archive = undefined;
    this.resources = undefined;
    this.container = undefined;
    this.packaging = undefined;
    this.rendition = undefined;

    this.navigation = undefined;
    this.url = undefined;
    this.path = undefined;
    this.archived = false;
  }
}

//-- Enable binding events to book
EventEmitter(Book.prototype);

export default Book;
