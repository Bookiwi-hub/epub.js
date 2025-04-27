import EpubCFI from "./epubcfi";
import {
  qs,
  qsa,
  querySelectorByType,
  indexOfSorted,
  locationOf,
} from "./utils/core";

/**
 * EPUB 페이지 목록 파서 클래스
 *
 * 이 클래스는 EPUB 파일의 페이지 목록을 파싱하고 관리하는 역할을 합니다.
 * EPUB 3.0의 Nav 문서나 NCX 문서에서 페이지 목록을 추출하고,
 * 페이지 번호와 CFI(Canonical Fragment Identifier) 간의 변환을 제공합니다.
 *
 * @example
 * // EPUB 페이지 목록 파싱 예시
 * const pageList = new PageList(xml);
 *
 * // CFI로부터 페이지 번호 검색 예시
 * const page = pageList.pageFromCfi("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
 * console.log(page); // 1
 *
 * // 페이지 번호로부터 CFI 검색 예시
 * const cfi = pageList.cfiFromPage(1);
 * console.log(cfi); // "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)"
 *
 * @class
 * @param {document} [xml] 페이지 목록 XML 문서
 */
class PageList {
  constructor(xml) {
    this.pages = [];
    this.locations = [];
    this.epubcfi = new EpubCFI();

    this.firstPage = 0;
    this.lastPage = 0;
    this.totalPages = 0;

    this.toc = undefined;
    this.ncx = undefined;

    if (xml) {
      this.pageList = this.parse(xml);
    }

    if (this.pageList && this.pageList.length) {
      this.process(this.pageList);
    }
  }

  /**
   * 페이지 목록 XML 파싱
   *
   * XML 문서에서 페이지 목록을 추출합니다.
   * EPUB 3.0의 Nav 문서나 NCX 문서를 지원합니다.
   *
   * @example
   * const list = pageList.parse(xml);
   * console.log(list); // [{ href: "chapter1.html", page: 1 }, ...]
   *
   * @param  {document} xml 페이지 목록 XML 문서
   * @return {PageList.item[]} 파싱된 페이지 목록
   */
  parse(xml) {
    var html = qs(xml, "html");
    var ncx = qs(xml, "ncx");

    if (html) {
      return this.parseNav(xml);
    } else if (ncx) {
      return this.parseNcx(xml);
    }
  }

  /**
   * Nav 문서에서 페이지 목록 파싱
   *
   * @private
   * @param  {node} navHtml Nav 문서
   * @return {PageList.item[]} 파싱된 페이지 목록
   */
  parseNav(navHtml) {
    var navElement = querySelectorByType(navHtml, "nav", "page-list");
    var navItems = navElement ? qsa(navElement, "li") : [];
    var length = navItems.length;
    var i;
    var list = [];
    var item;

    if (!navItems || length === 0) return list;

    for (i = 0; i < length; ++i) {
      item = this.item(navItems[i]);
      list.push(item);
    }

    return list;
  }

  /**
   * NCX 문서에서 페이지 목록 파싱
   *
   * @private
   * @param  {document} navXml NCX 문서
   * @return {PageList.item[]} 파싱된 페이지 목록
   */
  parseNcx(navXml) {
    var list = [];
    var i = 0;
    var item;
    var pageList;
    var pageTargets;
    var length = 0;

    pageList = qs(navXml, "pageList");
    if (!pageList) return list;

    pageTargets = qsa(pageList, "pageTarget");
    length = pageTargets.length;

    if (!pageTargets || pageTargets.length === 0) {
      return list;
    }

    for (i = 0; i < length; ++i) {
      item = this.ncxItem(pageTargets[i]);
      list.push(item);
    }

    return list;
  }

  /**
   * NCX 항목 생성
   *
   * @private
   * @param  {element} item NCX 요소
   * @return {object} 생성된 페이지 항목
   */
  ncxItem(item) {
    var navLabel = qs(item, "navLabel");
    var navLabelText = qs(navLabel, "text");
    var pageText = navLabelText.textContent;
    var content = qs(item, "content");

    var href = content.getAttribute("src");
    var page = parseInt(pageText, 10);

    return {
      href: href,
      page: page,
    };
  }

  /**
   * 페이지 목록 항목 생성
   *
   * @private
   * @param  {node} item HTML 요소
   * @return {object} 생성된 페이지 항목
   */
  item(item) {
    var content = qs(item, "a"),
      href = content.getAttribute("href") || "",
      text = content.textContent || "",
      page = parseInt(text),
      isCfi = href.indexOf("epubcfi"),
      split,
      packageUrl,
      cfi;

    if (isCfi != -1) {
      split = href.split("#");
      packageUrl = split[0];
      cfi = split.length > 1 ? split[1] : false;
      return {
        cfi: cfi,
        href: href,
        packageUrl: packageUrl,
        page: page,
      };
    } else {
      return {
        href: href,
        page: page,
      };
    }
  }

  /**
   * 페이지 목록 항목 처리
   *
   * 파싱된 페이지 목록을 처리하여 페이지 번호와 CFI를 저장합니다.
   *
   * @private
   * @param  {array} pageList 페이지 목록
   */
  process(pageList) {
    pageList.forEach(function (item) {
      this.pages.push(item.page);
      if (item.cfi) {
        this.locations.push(item.cfi);
      }
    }, this);
    this.firstPage = parseInt(this.pages[0]);
    this.lastPage = parseInt(this.pages[this.pages.length - 1]);
    this.totalPages = this.lastPage - this.firstPage;
  }

  /**
   * CFI로부터 페이지 번호 검색
   *
   * @example
   * const page = pageList.pageFromCfi("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
   * console.log(page); // 1
   *
   * @param  {string} cfi EpubCFI 문자열
   * @return {number} 페이지 번호
   */
  pageFromCfi(cfi) {
    var pg = -1;

    // Check if the pageList has not been set yet
    if (this.locations.length === 0) {
      return -1;
    }

    // TODO: check if CFI is valid?

    // check if the cfi is in the location list
    // var index = this.locations.indexOf(cfi);
    var index = indexOfSorted(cfi, this.locations, this.epubcfi.compare);
    if (index != -1) {
      pg = this.pages[index];
    } else {
      // Otherwise add it to the list of locations
      // Insert it in the correct position in the locations page
      //index = EPUBJS.core.insert(cfi, this.locations, this.epubcfi.compare);
      index = locationOf(cfi, this.locations, this.epubcfi.compare);
      // Get the page at the location just before the new one, or return the first
      pg = index - 1 >= 0 ? this.pages[index - 1] : this.pages[0];
      if (pg !== undefined) {
        // Add the new page in so that the locations and page array match up
        //this.pages.splice(index, 0, pg);
      } else {
        pg = -1;
      }
    }
    return pg;
  }

  /**
   * 페이지 번호로부터 CFI 검색
   *
   * @example
   * const cfi = pageList.cfiFromPage(1);
   * console.log(cfi); // "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)"
   *
   * @param  {string | number} pg 페이지 번호
   * @return {string} EpubCFI 문자열
   */
  cfiFromPage(pg) {
    var cfi = -1;
    // check that pg is an int
    if (typeof pg != "number") {
      pg = parseInt(pg);
    }

    // check if the cfi is in the page list
    // Pages could be unsorted.
    var index = this.pages.indexOf(pg);
    if (index != -1) {
      cfi = this.locations[index];
    }
    // TODO: handle pages not in the list
    return cfi;
  }

  /**
   * 책의 백분율로부터 페이지 번호 검색
   *
   * @example
   * const page = pageList.pageFromPercentage(0.5);
   * console.log(page); // 50 (전체 페이지가 100페이지인 경우)
   *
   * @param  {number} percent 백분율 (0-1)
   * @return {number} 페이지 번호
   */
  pageFromPercentage(percent) {
    var pg = Math.round(this.totalPages * percent);
    return pg;
  }

  /**
   * 페이지 번호로부터 백분율 계산
   *
   * @example
   * const percentage = pageList.percentageFromPage(50);
   * console.log(percentage); // 0.5 (전체 페이지가 100페이지인 경우)
   *
   * @param  {number} pg 페이지 번호
   * @return {number} 백분율 (0-1)
   */
  percentageFromPage(pg) {
    var percentage = (pg - this.firstPage) / this.totalPages;
    return Math.round(percentage * 1000) / 1000;
  }

  /**
   * CFI로부터 백분율 계산
   *
   * @example
   * const percentage = pageList.percentageFromCfi("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)");
   * console.log(percentage); // 0.5
   *
   * @param  {string} cfi EpubCFI 문자열
   * @return {number} 백분율 (0-1)
   */
  percentageFromCfi(cfi) {
    var pg = this.pageFromCfi(cfi);
    var percentage = this.percentageFromPage(pg);
    return percentage;
  }

  /**
   * 리소스 정리
   *
   * 클래스의 모든 속성을 초기화하여 메모리를 해제합니다.
   *
   * @example
   * pageList.destroy();
   */
  destroy() {
    this.pages = undefined;
    this.locations = undefined;
    this.epubcfi = undefined;

    this.pageList = undefined;

    this.toc = undefined;
    this.ncx = undefined;
  }
}

export default PageList;
