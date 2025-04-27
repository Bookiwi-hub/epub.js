import {
  qs,
  qsa,
  querySelectorByType,
  filterChildren,
  getParentByTagName,
} from "./utils/core";

/**
 * EPUB 네비게이션 파서 클래스
 *
 * 이 클래스는 EPUB 파일의 목차(Navigation)를 파싱하고 관리하는 역할을 합니다.
 * EPUB 3.0의 Nav 문서나 NCX 문서를 파싱하여 목차 구조를 생성하고,
 * 목차 항목을 ID나 HREF로 검색하는 기능을 제공합니다.
 *
 * @example
 * // EPUB 네비게이션 파싱 예시
 * const navigation = new Navigation(xml);
 *
 * // 목차 항목 검색 예시
 * const item = navigation.get("chapter1.html");
 * console.log(item); // { id: "chapter1", href: "chapter1.html", label: "Chapter 1", subitems: [] }
 *
 * // 랜드마크 검색 예시
 * const landmark = navigation.landmark("cover");
 * console.log(landmark); // { href: "cover.html", label: "Cover", type: "cover" }
 *
 * @class
 * @param {document} xml 네비게이션 HTML/XHTML/NCX 문서
 */
class Navigation {
  constructor(xml) {
    this.toc = [];
    this.tocByHref = {};
    this.tocById = {};

    this.landmarks = [];
    this.landmarksByType = {};

    this.length = 0;
    if (xml) {
      this.parse(xml);
    }
  }

  /**
   * 네비게이션 항목 파싱
   *
   * XML 문서에서 목차와 랜드마크 정보를 파싱합니다.
   * EPUB 3.0의 Nav 문서나 NCX 문서를 지원합니다.
   *
   * @example
   * navigation.parse(xml);
   * console.log(navigation.toc); // 파싱된 목차 구조
   * console.log(navigation.landmarks); // 파싱된 랜드마크 목록
   *
   * @param {document} xml 네비게이션 HTML/XHTML/NCX 문서
   */
  parse(xml) {
    let isXml = xml.nodeType;
    let html;
    let ncx;

    if (isXml) {
      html = qs(xml, "html");
      ncx = qs(xml, "ncx");
    }

    if (!isXml) {
      this.toc = this.load(xml);
    } else if (html) {
      this.toc = this.parseNav(xml);
      this.landmarks = this.parseLandmarks(xml);
    } else if (ncx) {
      this.toc = this.parseNcx(xml);
    }

    this.length = 0;

    this.unpack(this.toc);
  }

  /**
   * 네비게이션 항목 해제
   *
   * 파싱된 목차 구조를 해제하여 ID와 HREF로 빠르게 검색할 수 있도록 합니다.
   *
   * @private
   * @param  {array} toc 목차 배열
   */
  unpack(toc) {
    var item;

    for (var i = 0; i < toc.length; i++) {
      item = toc[i];

      if (item.href) {
        this.tocByHref[item.href] = i;
      }

      if (item.id) {
        this.tocById[item.id] = i;
      }

      this.length++;

      if (item.subitems.length) {
        this.unpack(item.subitems);
      }
    }
  }

  /**
   * 네비게이션 항목 검색
   *
   * ID나 HREF를 사용하여 목차 항목을 검색합니다.
   *
   * @example
   * const item = navigation.get("chapter1.html");
   * console.log(item); // { id: "chapter1", href: "chapter1.html", label: "Chapter 1", subitems: [] }
   *
   * @param  {string} target 검색할 ID 또는 HREF
   * @return {object} 검색된 네비게이션 항목
   */
  get(target) {
    var index;

    if (!target) {
      return this.toc;
    }

    if (target.indexOf("#") === 0) {
      index = this.tocById[target.substring(1)];
    } else if (target in this.tocByHref) {
      index = this.tocByHref[target];
    }

    return this.getByIndex(target, index, this.toc);
  }

  /**
   * 인덱스를 사용하여 네비게이션 항목 검색
   *
   * 재귀적으로 하위 항목을 검색하여 목차 항목을 찾습니다.
   *
   * @param  {string} target 검색할 ID 또는 HREF
   * @param  {number} index 검색할 인덱스
   * @param  {array} navItems 검색할 네비게이션 항목 배열
   * @return {object} 검색된 네비게이션 항목
   */
  getByIndex(target, index, navItems) {
    if (navItems.length === 0) {
      return;
    }

    const item = navItems[index];
    if (item && (target === item.id || target === item.href)) {
      return item;
    } else {
      let result;
      for (let i = 0; i < navItems.length; ++i) {
        result = this.getByIndex(target, index, navItems[i].subitems);
        if (result) {
          break;
        }
      }
      return result;
    }
  }

  /**
   * 랜드마크 검색
   *
   * 랜드마크 타입을 사용하여 랜드마크 항목을 검색합니다.
   * 랜드마크 타입 목록: https://idpf.github.io/epub-vocabs/structure/
   *
   * @example
   * const landmark = navigation.landmark("cover");
   * console.log(landmark); // { href: "cover.html", label: "Cover", type: "cover" }
   *
   * @param  {string} type 검색할 랜드마크 타입
   * @return {object} 검색된 랜드마크 항목
   */
  landmark(type) {
    var index;

    if (!type) {
      return this.landmarks;
    }

    index = this.landmarksByType[type];

    return this.landmarks[index];
  }

  /**
   * EPUB 3.0 Nav 문서에서 목차 파싱
   *
   * @private
   * @param  {document} navHtml Nav 문서
   * @return {array} 파싱된 네비게이션 목록
   */
  parseNav(navHtml) {
    var navElement = querySelectorByType(navHtml, "nav", "toc");
    var list = [];

    if (!navElement) return list;

    let navList = filterChildren(navElement, "ol", true);
    if (!navList) return list;

    list = this.parseNavList(navList);
    return list;
  }

  /**
   * 목차의 리스트 파싱
   *
   * @param  {document} navListHtml 목차 리스트 HTML
   * @param  {string} parent 부모 항목의 ID
   * @return {array} 파싱된 네비게이션 목록
   */
  parseNavList(navListHtml, parent) {
    const result = [];

    if (!navListHtml) return result;
    if (!navListHtml.children) return result;

    for (let i = 0; i < navListHtml.children.length; i++) {
      const item = this.navItem(navListHtml.children[i], parent);

      if (item) {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * 네비게이션 항목 생성
   *
   * @private
   * @param  {element} item HTML 요소
   * @return {object} 생성된 네비게이션 항목
   */
  navItem(item, parent) {
    let id = item.getAttribute("id") || undefined;
    let content =
      filterChildren(item, "a", true) || filterChildren(item, "span", true);

    if (!content) {
      return;
    }

    let src = content.getAttribute("href") || "";

    if (!id) {
      id = src;
    }
    let text = content.textContent || "";

    let subitems = [];
    let nested = filterChildren(item, "ol", true);
    if (nested) {
      subitems = this.parseNavList(nested, id);
    }

    return {
      id: id,
      href: src,
      label: text,
      subitems: subitems,
      parent: parent,
    };
  }

  /**
   * EPUB 3.0 Nav 문서에서 랜드마크 파싱
   *
   * @private
   * @param  {document} navHtml Nav 문서
   * @return {array} 파싱된 랜드마크 목록
   */
  parseLandmarks(navHtml) {
    var navElement = querySelectorByType(navHtml, "nav", "landmarks");
    var navItems = navElement ? qsa(navElement, "li") : [];
    var length = navItems.length;
    var i;
    var list = [];
    var item;

    if (!navItems || length === 0) return list;

    for (i = 0; i < length; ++i) {
      item = this.landmarkItem(navItems[i]);
      if (item) {
        list.push(item);
        this.landmarksByType[item.type] = i;
      }
    }

    return list;
  }

  /**
   * 랜드마크 항목 생성
   *
   * @private
   * @param  {element} item HTML 요소
   * @return {object} 생성된 랜드마크 항목
   */
  landmarkItem(item) {
    let content = filterChildren(item, "a", true);

    if (!content) {
      return;
    }

    let type =
      content.getAttributeNS("http://www.idpf.org/2007/ops", "type") ||
      undefined;
    let href = content.getAttribute("href") || "";
    let text = content.textContent || "";

    return {
      href: href,
      label: text,
      type: type,
    };
  }

  /**
   * EPUB 3.0 NCX 문서 파싱
   *
   * @private
   * @param  {document} tocXml NCX 문서
   * @return {array} 파싱된 네비게이션 목록
   */
  parseNcx(tocXml) {
    var navPoints = qsa(tocXml, "navPoint");
    var length = navPoints.length;
    var i;
    var toc = {};
    var list = [];
    var item, parent;

    if (!navPoints || length === 0) return list;

    for (i = 0; i < length; ++i) {
      item = this.ncxItem(navPoints[i]);
      toc[item.id] = item;
      if (!item.parent) {
        list.push(item);
      } else {
        parent = toc[item.parent];
        parent.subitems.push(item);
      }
    }

    return list;
  }

  /**
   * NCX 항목 생성
   *
   * @private
   * @param  {element} item NCX 요소
   * @return {object} 생성된 NCX 항목
   */
  ncxItem(item) {
    var id = item.getAttribute("id") || false,
      content = qs(item, "content"),
      src = content.getAttribute("src"),
      navLabel = qs(item, "navLabel"),
      text = navLabel.textContent ? navLabel.textContent : "",
      subitems = [],
      parentNode = item.parentNode,
      parent;

    if (
      parentNode &&
      (parentNode.nodeName === "navPoint" ||
        parentNode.nodeName.split(":").slice(-1)[0] === "navPoint")
    ) {
      parent = parentNode.getAttribute("id");
    }

    return {
      id: id,
      href: src,
      label: text,
      subitems: subitems,
      parent: parent,
    };
  }

  /**
   * 스파인 항목 로드
   *
   * JSON 형식의 스파인 항목을 네비게이션 항목으로 변환합니다.
   *
   * @example
   * const items = navigation.load(json);
   * console.log(items); // 변환된 네비게이션 항목 배열
   *
   * @param  {object} json 로드할 항목들
   * @return {Array} 변환된 네비게이션 항목 배열
   */
  load(json) {
    return json.map((item) => {
      item.label = item.title;
      item.subitems = item.children ? this.load(item.children) : [];
      return item;
    });
  }

  /**
   * forEach 메소드 전달
   *
   * 목차 배열에 대해 forEach 메소드를 실행합니다.
   *
   * @example
   * navigation.forEach(item => {
   *   console.log(item.label); // 각 목차 항목의 라벨 출력
   * });
   *
   * @param  {Function} fn 각 항목에 대해 실행할 함수
   * @return {method} forEach 루프
   */
  forEach(fn) {
    return this.toc.forEach(fn);
  }
}

export default Navigation;
