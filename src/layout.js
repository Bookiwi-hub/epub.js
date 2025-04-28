import { extend } from "./utils/core";
import { EVENTS } from "./utils/constants";
import EventEmitter from "event-emitter";

/**
 * EPUB 문서의 레이아웃을 관리하는 클래스
 * @class
 * @example
 * const layout = new Layout({
 *   layout: 'reflowable',
 *   spread: 'auto',
 *   minSpreadWidth: 800,
 *   evenSpreads: false
 * });
 *
 * // 결과값 예시
 * {
 *   name: 'reflowable',
 *   spread: true,
 *   flow: 'paginated',
 *   width: 0,
 *   height: 0,
 *   spreadWidth: 0,
 *   delta: 0,
 *   columnWidth: 0,
 *   gap: 0,
 *   divisor: 1
 * }
 * @param {object} settings 레이아웃 설정 객체
 * @param {string} [settings.layout='reflowable'] 레이아웃 타입 ('reflowable' 또는 'pre-paginated')
 * @param {string} [settings.spread] 스프레드 모드 ('none', 'always', 'auto')
 * @param {number} [settings.minSpreadWidth=800] 스프레드 모드로 전환되는 최소 너비
 * @param {boolean} [settings.evenSpreads=false] 짝수 페이지 스프레드 사용 여부
 */
class Layout {
  constructor(settings) {
    this.settings = settings;
    this.name = settings.layout || "reflowable";
    this._spread = settings.spread === "none" ? false : true;
    this._minSpreadWidth = settings.minSpreadWidth || 800;
    this._evenSpreads = settings.evenSpreads || false;

    if (
      settings.flow === "scrolled" ||
      settings.flow === "scrolled-continuous" ||
      settings.flow === "scrolled-doc"
    ) {
      this._flow = "scrolled";
    } else {
      this._flow = "paginated";
    }

    this.width = 0;
    this.height = 0;
    this.spreadWidth = 0;
    this.delta = 0;

    this.columnWidth = 0;
    this.gap = 0;
    this.divisor = 1;

    this.props = {
      name: this.name,
      spread: this._spread,
      flow: this._flow,
      width: 0,
      height: 0,
      spreadWidth: 0,
      delta: 0,
      columnWidth: 0,
      gap: 0,
      divisor: 1,
    };
  }

  /**
   * 페이지 흐름 방식을 변경하는 메소드
   * @example
   * layout.flow('scrolled');
   * // 결과: 'scrolled'
   *
   * layout.flow('paginated');
   * // 결과: 'paginated'
   * @param  {string} flow 페이지 흐름 방식 ('paginated' 또는 'scrolled')
   * @return {string} 적용된 페이지 흐름 방식
   */
  flow(flow) {
    if (typeof flow != "undefined") {
      if (
        flow === "scrolled" ||
        flow === "scrolled-continuous" ||
        flow === "scrolled-doc"
      ) {
        this._flow = "scrolled";
      } else {
        this._flow = "paginated";
      }
      // this.props.flow = this._flow;
      this.update({ flow: this._flow });
    }
    return this._flow;
  }

  /**
   * 스프레드 모드를 설정하는 메소드
   * @example
   * layout.spread('auto', 800);
   * // 결과: true
   *
   * layout.spread('none');
   * // 결과: false
   * @param  {string} spread 스프레드 모드 ('none', 'always', 'auto')
   * @param  {number} min 스프레드 모드로 전환되는 최소 너비
   * @return {boolean} 적용된 스프레드 모드 상태
   */
  spread(spread, min) {
    if (spread) {
      this._spread = spread === "none" ? false : true;
      // this.props.spread = this._spread;
      this.update({ spread: this._spread });
    }

    if (min >= 0) {
      this._minSpreadWidth = min;
    }

    return this._spread;
  }

  /**
   * 페이지네이션의 크기를 계산하는 메소드
   * @example
   * layout.calculate(1024, 768, 20);
   * // 결과: {
   * //   width: 1024,
   * //   height: 768,
   * //   spreadWidth: 1024,
   * //   pageWidth: 1024,
   * //   delta: 1024,
   * //   columnWidth: 1024,
   * //   gap: 20,
   * //   divisor: 1
   * // }
   * @param  {number} _width 렌더링 영역의 너비
   * @param  {number} _height 렌더링 영역의 높이
   * @param  {number} _gap 컬럼 간의 간격
   */
  calculate(_width, _height, _gap) {
    var divisor = 1;
    var gap = _gap || 0;

    //-- Check the width and create even width columns
    // var fullWidth = Math.floor(_width);
    var width = _width;
    var height = _height;

    var section = Math.floor(width / 12);

    var columnWidth;
    var spreadWidth;
    var pageWidth;
    var delta;

    if (this._spread && width >= this._minSpreadWidth) {
      divisor = 2;
    } else {
      divisor = 1;
    }

    if (
      this.name === "reflowable" &&
      this._flow === "paginated" &&
      !(_gap >= 0)
    ) {
      gap = section % 2 === 0 ? section : section - 1;
    }

    if (this.name === "pre-paginated") {
      gap = 0;
    }

    //-- Double Page
    if (divisor > 1) {
      // width = width - gap;
      // columnWidth = (width - gap) / divisor;
      // gap = gap / divisor;
      columnWidth = width / divisor - gap;
      pageWidth = columnWidth + gap;
    } else {
      columnWidth = width;
      pageWidth = width;
    }

    if (this.name === "pre-paginated" && divisor > 1) {
      width = columnWidth;
    }

    spreadWidth = columnWidth * divisor + gap;

    delta = width;

    this.width = width;
    this.height = height;
    this.spreadWidth = spreadWidth;
    this.pageWidth = pageWidth;
    this.delta = delta;

    this.columnWidth = columnWidth;
    this.gap = gap;
    this.divisor = divisor;

    // this.props.width = width;
    // this.props.height = _height;
    // this.props.spreadWidth = spreadWidth;
    // this.props.pageWidth = pageWidth;
    // this.props.delta = delta;
    //
    // this.props.columnWidth = colWidth;
    // this.props.gap = gap;
    // this.props.divisor = divisor;

    this.update({
      width,
      height,
      spreadWidth,
      pageWidth,
      delta,
      columnWidth,
      gap,
      divisor,
    });
  }

  /**
   * 문서에 CSS 스타일을 적용하는 메소드
   * @example
   * layout.format(contents, section, 'horizontal');
   * // 결과: Promise<Contents>
   * @param  {Contents} contents 적용할 콘텐츠 객체
   * @param  {number} section 섹션 번호
   * @param  {string} axis 레이아웃 방향 ('horizontal' 또는 'vertical')
   * @return {Promise} 스타일이 적용된 콘텐츠 객체
   */
  format(contents, section, axis) {
    var formating;

    if (this.name === "pre-paginated") {
      formating = contents.fit(this.columnWidth, this.height, section);
    } else if (this._flow === "paginated") {
      formating = contents.columns(
        this.width,
        this.height,
        this.columnWidth,
        this.gap,
        this.settings.direction
      );
    } else if (axis && axis === "horizontal") {
      formating = contents.size(null, this.height);
    } else {
      formating = contents.size(this.width, null);
    }

    return formating; // might be a promise in some View Managers
  }

  /**
   * 전체 페이지 수를 계산하는 메소드
   * @example
   * layout.count(1000, 100);
   * // 결과: {
   * //   spreads: 10,
   * //   pages: 10
   * // }
   * @param  {number} totalLength 전체 콘텐츠 길이
   * @param  {number} pageLength 페이지당 콘텐츠 길이
   * @return {{spreads: Number, pages: Number}} 스프레드 수와 페이지 수
   */
  count(totalLength, pageLength) {
    let spreads, pages;

    if (this.name === "pre-paginated") {
      spreads = 1;
      pages = 1;
    } else if (this._flow === "paginated") {
      pageLength = pageLength || this.delta;
      spreads = Math.ceil(totalLength / pageLength);
      pages = spreads * this.divisor;
    } else {
      // scrolled
      pageLength = pageLength || this.height;
      spreads = Math.ceil(totalLength / pageLength);
      pages = spreads;
    }

    return {
      spreads,
      pages,
    };
  }

  /**
   * 변경된 속성을 업데이트하는 내부 메소드
   * @private
   * @example
   * layout.update({ width: 1024, height: 768 });
   * // 결과: EVENTS.LAYOUT.UPDATED 이벤트 발생
   * @param  {object} props 업데이트할 속성 객체
   */
  update(props) {
    // Remove props that haven't changed
    Object.keys(props).forEach((propName) => {
      if (this.props[propName] === props[propName]) {
        delete props[propName];
      }
    });

    if (Object.keys(props).length > 0) {
      let newProps = extend(this.props, props);
      this.emit(EVENTS.LAYOUT.UPDATED, newProps, props);
    }
  }
}

EventEmitter(Layout.prototype);

export default Layout;
