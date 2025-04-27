import { qs, qsa } from "./utils/core";

/**
 * EPUB의 디스플레이 옵션을 파싱하고 관리하는 클래스
 * @class
 * @param {document} displayOptionsDocument - XML 문서 객체
 * @example
 * // XML 문서에서 디스플레이 옵션 파싱
 * const displayOptions = new DisplayOptions(xmlDoc);
 * console.log(displayOptions.fixedLayout); // "true" 또는 "false"
 * console.log(displayOptions.orientationLock); // "portrait" 또는 "landscape"
 *
 * @property {string} interactive - EPUB의 상호작용 여부 ("true" 또는 "false")
 * @property {string} fixedLayout - 고정 레이아웃 사용 여부 ("true" 또는 "false")
 * @property {string} openToSpread - 스프레드 형태로 열기 여부 ("true" 또는 "false")
 * @property {string} orientationLock - 화면 방향 고정 여부 ("portrait", "landscape" 또는 "")
 */
class DisplayOptions {
  constructor(displayOptionsDocument) {
    this.interactive = "";
    this.fixedLayout = "";
    this.openToSpread = "";
    this.orientationLock = "";

    if (displayOptionsDocument) {
      this.parse(displayOptionsDocument);
    }
  }

  /**
   * XML 문서에서 디스플레이 옵션을 파싱하여 객체의 속성에 저장
   * @param  {document} displayOptionsDocument - XML 문서 객체
   * @return {DisplayOptions} - 파싱된 디스플레이 옵션 객체
   * @example
   * // XML 문서 파싱
   * const displayOptions = new DisplayOptions();
   * displayOptions.parse(xmlDoc);
   *
   * // 결과 예시
   * // displayOptions.interactive = "true"
   * // displayOptions.fixedLayout = "false"
   * // displayOptions.openToSpread = "true"
   * // displayOptions.orientationLock = "portrait"
   */
  parse(displayOptionsDocument) {
    if (!displayOptionsDocument) {
      return this;
    }

    const displayOptionsNode = qs(displayOptionsDocument, "display_options");
    if (!displayOptionsNode) {
      return this;
    }

    const options = qsa(displayOptionsNode, "option");
    options.forEach((el) => {
      let value = "";

      if (el.childNodes.length) {
        value = el.childNodes[0].nodeValue;
      }

      switch (el.attributes.name.value) {
        case "interactive":
          this.interactive = value;
          break;
        case "fixed-layout":
          this.fixedLayout = value;
          break;
        case "open-to-spread":
          this.openToSpread = value;
          break;
        case "orientation-lock":
          this.orientationLock = value;
          break;
      }
    });

    return this;
  }

  /**
   * 디스플레이 옵션 객체의 모든 속성을 초기화
   * @example
   * const displayOptions = new DisplayOptions(xmlDoc);
   * displayOptions.destroy();
   * // 모든 속성이 undefined로 설정됨
   */
  destroy() {
    this.interactive = undefined;
    this.fixedLayout = undefined;
    this.openToSpread = undefined;
    this.orientationLock = undefined;
  }
}

export default DisplayOptions;
