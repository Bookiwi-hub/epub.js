import EpubCFI from "./epubcfi";
import Hook from "./utils/hook";
import Section from "./section";
import {
  replaceBase,
  replaceCanonical,
  replaceMeta,
} from "./utils/replacements";

/**
 * EPUB 문서의 스파인(Spine)을 관리하는 클래스
 * 스파인은 EPUB 문서의 읽기 순서를 정의하는 요소들의 집합입니다.
 *
 * @example
 * // 기본 사용 예시
 * const spine = new Spine();
 * spine.unpack(package, resolver, canonical);
 *
 * // 특정 섹션 가져오기
 * const section = spine.get(1); // 두 번째 섹션
 *
 * // 결과값 예시
 * // {
 * //   index: 1,
 * //   href: "chapter2.xhtml",
 * //   idref: "chap2",
 * //   linear: true,
 * //   cfiBase: "/2"
 * // }
 */
class Spine {
  constructor() {
    this.spineItems = [];
    this.spineByHref = {};
    this.spineById = {};

    this.hooks = {};
    this.hooks.serialize = new Hook();
    this.hooks.content = new Hook();

    // Register replacements
    this.hooks.content.register(replaceBase);
    this.hooks.content.register(replaceCanonical);
    this.hooks.content.register(replaceMeta);

    this.epubcfi = new EpubCFI();

    this.loaded = false;

    this.items = undefined;
    this.manifest = undefined;
    this.spineNodeIndex = undefined;
    this.baseUrl = undefined;
    this.length = undefined;
  }

  /**
   * EPUB 패키지에서 스파인 아이템들을 추출하여 초기화합니다.
   * @param  {Packaging} _package EPUB 패키지 객체
   * @param  {Function} resolver URL 해석기
   * @param  {Function} canonical 정규화된 URL 해석기
   *
   * @example
   * // 사용 예시
   * spine.unpack(package, (href) => `http://example.com/${href}`, (href) => `canonical/${href}`);
   *
   * // 결과값 예시
   * // spine.items 배열에 다음과 같은 형식으로 저장됨:
   * // [
   * //   { idref: "chap1", href: "chapter1.xhtml", linear: true, index: 0 },
   * //   { idref: "chap2", href: "chapter2.xhtml", linear: true, index: 1 }
   * // ]
   */
  unpack(_package, resolver, canonical) {
    this.items = _package.spine;
    this.manifest = _package.manifest;
    this.spineNodeIndex = _package.spineNodeIndex;
    this.baseUrl = _package.baseUrl || _package.basePath || "";
    this.length = this.items.length;

    this.items.forEach((item, index) => {
      var manifestItem = this.manifest[item.idref];
      var spineItem;

      item.index = index;
      item.cfiBase = this.epubcfi.generateChapterComponent(
        this.spineNodeIndex,
        item.index,
        item.id
      );

      if (item.href) {
        item.url = resolver(item.href, true);
        item.canonical = canonical(item.href);
      }

      if (manifestItem) {
        item.href = manifestItem.href;
        item.url = resolver(item.href, true);
        item.canonical = canonical(item.href);

        if (manifestItem.properties.length) {
          item.properties.push.apply(item.properties, manifestItem.properties);
        }
      }

      if (item.linear === "yes") {
        item.prev = function () {
          let prevIndex = item.index;
          while (prevIndex > 0) {
            let prev = this.get(prevIndex - 1);
            if (prev && prev.linear) {
              return prev;
            }
            prevIndex -= 1;
          }
          return;
        }.bind(this);
        item.next = function () {
          let nextIndex = item.index;
          while (nextIndex < this.spineItems.length - 1) {
            let next = this.get(nextIndex + 1);
            if (next && next.linear) {
              return next;
            }
            nextIndex += 1;
          }
          return;
        }.bind(this);
      } else {
        item.prev = function () {
          return;
        };
        item.next = function () {
          return;
        };
      }

      spineItem = new Section(item, this.hooks);

      this.append(spineItem);
    });

    this.loaded = true;
  }

  /**
   * 스파인에서 특정 섹션을 가져옵니다.
   * @param  {string|number} [target] 찾을 섹션의 인덱스, ID 또는 CFI 문자열
   * @return {Section} 찾은 섹션 객체 또는 null
   *
   * @example
   * // 사용 예시
   * spine.get(); // 첫 번째 선형 섹션
   * spine.get(1); // 두 번째 섹션
   * spine.get("chap1.html"); // 특정 파일명의 섹션
   * spine.get("#id1234"); // 특정 ID의 섹션
   * spine.get("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)"); // CFI 위치의 섹션
   *
   * // 결과값 예시
   * // {
   * //   index: 1,
   * //   href: "chapter2.xhtml",
   * //   idref: "chap2",
   * //   linear: true,
   * //   cfiBase: "/2"
   * // }
   */
  get(target) {
    var index = 0;

    if (typeof target === "undefined") {
      while (index < this.spineItems.length) {
        let next = this.spineItems[index];
        if (next && next.linear) {
          break;
        }
        index += 1;
      }
    } else if (this.epubcfi.isCfiString(target)) {
      let cfi = new EpubCFI(target);
      index = cfi.spinePos;
    } else if (typeof target === "number" || isNaN(target) === false) {
      index = target;
    } else if (typeof target === "string" && target.indexOf("#") === 0) {
      index = this.spineById[target.substring(1)];
    } else if (typeof target === "string") {
      // Remove fragments
      target = target.split("#")[0];
      index = this.spineByHref[target] || this.spineByHref[encodeURI(target)];
    }

    return this.spineItems[index] || null;
  }

  /**
   * 스파인에 새로운 섹션을 추가합니다.
   * @private
   * @param  {Section} section 추가할 섹션 객체
   * @return {number} 추가된 섹션의 인덱스
   *
   * @example
   * // 사용 예시
   * const section = new Section({href: "new-chapter.xhtml", idref: "new-chap"});
   * spine.append(section);
   *
   * // 결과값 예시
   * // 3 (새로 추가된 섹션의 인덱스)
   */
  append(section) {
    var index = this.spineItems.length;
    section.index = index;

    this.spineItems.push(section);

    // Encode and Decode href lookups
    // see pr for details: https://github.com/futurepress/epub.js/pull/358
    this.spineByHref[decodeURI(section.href)] = index;
    this.spineByHref[encodeURI(section.href)] = index;
    this.spineByHref[section.href] = index;

    this.spineById[section.idref] = index;

    return index;
  }

  /**
   * 스파인의 시작 부분에 새로운 섹션을 추가합니다.
   * @private
   * @param  {Section} section 추가할 섹션 객체
   * @return {number} 추가된 섹션의 인덱스 (항상 0)
   *
   * @example
   * // 사용 예시
   * const section = new Section({href: "preface.xhtml", idref: "preface"});
   * spine.prepend(section);
   *
   * // 결과값 예시
   * // 0 (새로 추가된 섹션의 인덱스)
   */
  prepend(section) {
    // var index = this.spineItems.unshift(section);
    this.spineByHref[section.href] = 0;
    this.spineById[section.idref] = 0;

    // Re-index
    this.spineItems.forEach(function (item, index) {
      item.index = index;
    });

    return 0;
  }

  // insert(section, index) {
  //
  // };

  /**
   * 스파인에서 특정 섹션을 제거합니다.
   * @private
   * @param  {Section} section 제거할 섹션 객체
   * @return {Array} 제거된 섹션 배열
   *
   * @example
   * // 사용 예시
   * const section = spine.get(1);
   * spine.remove(section);
   *
   * // 결과값 예시
   * // [{
   * //   index: 1,
   * //   href: "chapter2.xhtml",
   * //   idref: "chap2"
   * // }]
   */
  remove(section) {
    var index = this.spineItems.indexOf(section);

    if (index > -1) {
      delete this.spineByHref[section.href];
      delete this.spineById[section.idref];

      return this.spineItems.splice(index, 1);
    }
  }

  /**
   * 스파인의 모든 섹션에 대해 반복 작업을 수행합니다.
   * @return {Function} Array.prototype.forEach와 동일한 기능의 함수
   *
   * @example
   * // 사용 예시
   * spine.each((section, index) => {
   *   console.log(`Section ${index}: ${section.href}`);
   * });
   *
   * // 결과값 예시
   * // Section 0: chapter1.xhtml
   * // Section 1: chapter2.xhtml
   * // Section 2: chapter3.xhtml
   */
  each() {
    return this.spineItems.forEach.apply(this.spineItems, arguments);
  }

  /**
   * 스파인의 첫 번째 선형(linear) 섹션을 찾습니다.
   * @return {Section} 첫 번째 선형 섹션 객체
   *
   * @example
   * // 사용 예시
   * const firstSection = spine.first();
   *
   * // 결과값 예시
   * // {
   * //   index: 0,
   * //   href: "chapter1.xhtml",
   * //   idref: "chap1",
   * //   linear: true,
   * //   cfiBase: "/0"
   * // }
   */
  first() {
    let index = 0;

    do {
      let next = this.get(index);

      if (next && next.linear) {
        return next;
      }
      index += 1;
    } while (index < this.spineItems.length);
  }

  /**
   * 스파인의 마지막 선형(linear) 섹션을 찾습니다.
   * @return {Section} 마지막 선형 섹션 객체
   *
   * @example
   * // 사용 예시
   * const lastSection = spine.last();
   *
   * // 결과값 예시
   * // {
   * //   index: 2,
   * //   href: "chapter3.xhtml",
   * //   idref: "chap3",
   * //   linear: true,
   * //   cfiBase: "/2"
   * // }
   */
  last() {
    let index = this.spineItems.length - 1;

    do {
      let prev = this.get(index);
      if (prev && prev.linear) {
        return prev;
      }
      index -= 1;
    } while (index >= 0);
  }

  /**
   * 스파인 객체를 정리하고 메모리를 해제합니다.
   *
   * @example
   * // 사용 예시
   * spine.destroy();
   *
   * // 결과값 예시
   * // 모든 속성이 undefined로 설정됨
   */
  destroy() {
    this.each((section) => section.destroy());

    this.spineItems = undefined;
    this.spineByHref = undefined;
    this.spineById = undefined;

    this.hooks.serialize.clear();
    this.hooks.content.clear();
    this.hooks = undefined;

    this.epubcfi = undefined;

    this.loaded = false;

    this.items = undefined;
    this.manifest = undefined;
    this.spineNodeIndex = undefined;
    this.baseUrl = undefined;
    this.length = undefined;
  }
}

export default Spine;
