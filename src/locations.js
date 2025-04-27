import { qs, sprint, locationOf, defer } from "./utils/core";
import Queue from "./utils/queue";
import EpubCFI from "./epubcfi";
import { EVENTS } from "./utils/constants";
import EventEmitter from "event-emitter";

/**
 * EPUB 문서의 위치 정보를 관리하는 클래스
 *
 * 이 클래스는 EPUB 문서의 전체 내용을 분석하여 특정 위치(CFI)를 찾고,
 * 페이지 위치나 진행률을 계산하는 기능을 제공합니다.
 *
 * @example
 * // 기본 사용 예시
 * const locations = new Locations(spine, request);
 *
 * // 위치 정보 생성
 * locations.generate(150).then(locations => {
 *   console.log(locations); // 생성된 모든 CFI 위치 배열
 * });
 *
 * // 특정 CFI의 위치 찾기
 * const cfi = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])";
 * const location = locations.locationFromCfi(cfi);
 * console.log(location); // 42 (해당 CFI의 위치 인덱스)
 *
 * // 위치에서 CFI 찾기
 * const cfi = locations.cfiFromLocation(42);
 * console.log(cfi); // "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])"
 *
 * // 진행률 계산
 * const percentage = locations.percentageFromLocation(42);
 * console.log(percentage); // 0.5 (50% 진행)
 */
class Locations {
  constructor(spine, request, pause) {
    this.spine = spine;
    this.request = request;
    this.pause = pause || 100;

    this.q = new Queue(this);
    this.epubcfi = new EpubCFI();

    this._locations = [];
    this._locationsWords = [];
    this.total = 0;

    this.break = 150;

    this._current = 0;

    this._wordCounter = 0;

    this.currentLocation = "";
    this._currentCfi = "";
    this.processingTimeout = undefined;
  }

  /**
   * EPUB 문서의 모든 섹션을 로드하여 위치 정보를 생성합니다.
   *
   * @param {int} chars - 위치를 나누는 기준이 되는 문자 수
   * @return {Promise<Array<string>>} 생성된 CFI 위치 배열
   *
   * @example
   * // 150자마다 위치를 생성
   * locations.generate(150).then(locations => {
   *   console.log(locations);
   *   // 결과: ["epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])", ...]
   * });
   */
  generate(chars) {
    if (chars) {
      this.break = chars;
    }

    this.q.pause();

    this.spine.each(
      function (section) {
        if (section.linear) {
          this.q.enqueue(this.process.bind(this), section);
        }
      }.bind(this)
    );

    return this.q.run().then(
      function () {
        this.total = this._locations.length - 1;

        if (this._currentCfi) {
          this.currentLocation = this._currentCfi;
        }

        return this._locations;
        // console.log(this.percentage(this.book.rendition.location.start), this.percentage(this.book.rendition.location.end));
      }.bind(this)
    );
  }

  createRange() {
    return {
      startContainer: undefined,
      startOffset: undefined,
      endContainer: undefined,
      endOffset: undefined,
    };
  }

  process(section) {
    return section.load(this.request).then(
      function (contents) {
        var completed = new defer();
        var locations = this.parse(contents, section.cfiBase);
        this._locations = this._locations.concat(locations);

        section.unload();

        this.processingTimeout = setTimeout(
          () => completed.resolve(locations),
          this.pause
        );
        return completed.promise;
      }.bind(this)
    );
  }

  parse(contents, cfiBase, chars) {
    var locations = [];
    var range;
    var doc = contents.ownerDocument;
    var body = qs(doc, "body");
    var counter = 0;
    var prev;
    var _break = chars || this.break;
    var parser = function (node) {
      var len = node.length;
      var dist;
      var pos = 0;

      if (node.textContent.trim().length === 0) {
        return false; // continue
      }

      // Start range
      if (counter == 0) {
        range = this.createRange();
        range.startContainer = node;
        range.startOffset = 0;
      }

      dist = _break - counter;

      // Node is smaller than a break,
      // skip over it
      if (dist > len) {
        counter += len;
        pos = len;
      }

      while (pos < len) {
        dist = _break - counter;

        if (counter === 0) {
          // Start new range
          pos += 1;
          range = this.createRange();
          range.startContainer = node;
          range.startOffset = pos;
        }

        // pos += dist;

        // Gone over
        if (pos + dist >= len) {
          // Continue counter for next node
          counter += len - pos;
          // break
          pos = len;
          // At End
        } else {
          // Advance pos
          pos += dist;

          // End the previous range
          range.endContainer = node;
          range.endOffset = pos;
          // cfi = section.cfiFromRange(range);
          let cfi = new EpubCFI(range, cfiBase).toString();
          locations.push(cfi);
          counter = 0;
        }
      }
      prev = node;
    };

    sprint(body, parser.bind(this));

    // Close remaining
    if (range && range.startContainer && prev) {
      range.endContainer = prev;
      range.endOffset = prev.length;
      let cfi = new EpubCFI(range, cfiBase).toString();
      locations.push(cfi);
      counter = 0;
    }

    return locations;
  }

  /**
   * 단어 수를 기준으로 위치 정보를 생성합니다.
   *
   * @param {string} startCfi - 시작 위치의 CFI
   * @param {int} wordCount - 위치를 나누는 기준이 되는 단어 수
   * @param {int} count - 생성할 위치 정보의 최대 개수
   * @return {Promise<Array<Object>>} 생성된 위치 정보 배열 (각 항목은 cfi와 wordCount를 포함)
   *
   * @example
   * // 100단어마다 위치를 생성
   * locations.generateFromWords(null, 100, 10).then(locations => {
   *   console.log(locations);
   *   // 결과: [{cfi: "epubcfi(...)", wordCount: 100}, ...]
   * });
   */
  generateFromWords(startCfi, wordCount, count) {
    var start = startCfi ? new EpubCFI(startCfi) : undefined;
    this.q.pause();
    this._locationsWords = [];
    this._wordCounter = 0;

    this.spine.each(
      function (section) {
        if (section.linear) {
          if (start) {
            if (section.index >= start.spinePos) {
              this.q.enqueue(
                this.processWords.bind(this),
                section,
                wordCount,
                start,
                count
              );
            }
          } else {
            this.q.enqueue(
              this.processWords.bind(this),
              section,
              wordCount,
              start,
              count
            );
          }
        }
      }.bind(this)
    );

    return this.q.run().then(
      function () {
        if (this._currentCfi) {
          this.currentLocation = this._currentCfi;
        }

        return this._locationsWords;
      }.bind(this)
    );
  }

  processWords(section, wordCount, startCfi, count) {
    if (count && this._locationsWords.length >= count) {
      return Promise.resolve();
    }

    return section.load(this.request).then(
      function (contents) {
        var completed = new defer();
        var locations = this.parseWords(contents, section, wordCount, startCfi);
        var remainingCount = count - this._locationsWords.length;
        this._locationsWords = this._locationsWords.concat(
          locations.length >= count
            ? locations.slice(0, remainingCount)
            : locations
        );

        section.unload();

        this.processingTimeout = setTimeout(
          () => completed.resolve(locations),
          this.pause
        );
        return completed.promise;
      }.bind(this)
    );
  }

  /**
   * 문자열의 단어 수를 계산합니다.
   *
   * @param {string} s - 단어 수를 계산할 문자열
   * @return {number} 단어 수
   *
   * @example
   * const count = locations.countWords("Hello World");
   * console.log(count); // 2
   */
  countWords(s) {
    s = s.replace(/(^\s*)|(\s*$)/gi, ""); //exclude  start and end white-space
    s = s.replace(/[ ]{2,}/gi, " "); //2 or more space to 1
    s = s.replace(/\n /, "\n"); // exclude newline with a start spacing
    return s.split(" ").length;
  }

  parseWords(contents, section, wordCount, startCfi) {
    var cfiBase = section.cfiBase;
    var locations = [];
    var doc = contents.ownerDocument;
    var body = qs(doc, "body");
    var prev;
    var _break = wordCount;
    var foundStartNode = startCfi ? startCfi.spinePos !== section.index : true;
    var startNode;
    if (startCfi && section.index === startCfi.spinePos) {
      startNode = startCfi.findNode(
        startCfi.range
          ? startCfi.path.steps.concat(startCfi.start.steps)
          : startCfi.path.steps,
        contents.ownerDocument
      );
    }
    var parser = function (node) {
      if (!foundStartNode) {
        if (node === startNode) {
          foundStartNode = true;
        } else {
          return false;
        }
      }
      if (node.textContent.length < 10) {
        if (node.textContent.trim().length === 0) {
          return false;
        }
      }
      var len = this.countWords(node.textContent);
      var dist;
      var pos = 0;

      if (len === 0) {
        return false; // continue
      }

      dist = _break - this._wordCounter;

      // Node is smaller than a break,
      // skip over it
      if (dist > len) {
        this._wordCounter += len;
        pos = len;
      }

      while (pos < len) {
        dist = _break - this._wordCounter;

        // Gone over
        if (pos + dist >= len) {
          // Continue counter for next node
          this._wordCounter += len - pos;
          // break
          pos = len;
          // At End
        } else {
          // Advance pos
          pos += dist;

          let cfi = new EpubCFI(node, cfiBase);
          locations.push({ cfi: cfi.toString(), wordCount: this._wordCounter });
          this._wordCounter = 0;
        }
      }
      prev = node;
    };

    sprint(body, parser.bind(this));

    return locations;
  }

  /**
   * 특정 CFI의 위치 인덱스를 반환합니다.
   *
   * @param {EpubCFI} cfi - 찾고자 하는 CFI
   * @return {number} 위치 인덱스 (0부터 시작)
   *
   * @example
   * const cfi = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])";
   * const location = locations.locationFromCfi(cfi);
   * console.log(location); // 42
   */
  locationFromCfi(cfi) {
    let loc;
    if (EpubCFI.prototype.isCfiString(cfi)) {
      cfi = new EpubCFI(cfi);
    }
    // Check if the location has not been set yet
    if (this._locations.length === 0) {
      return -1;
    }

    loc = locationOf(cfi, this._locations, this.epubcfi.compare);

    if (loc > this.total) {
      return this.total;
    }

    return loc;
  }

  /**
   * 특정 CFI의 진행률을 백분율로 반환합니다.
   *
   * @param {EpubCFI} cfi - 진행률을 계산할 CFI
   * @return {number} 진행률 (0 ~ 1 사이의 값)
   *
   * @example
   * const cfi = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])";
   * const percentage = locations.percentageFromCfi(cfi);
   * console.log(percentage); // 0.5 (50% 진행)
   */
  percentageFromCfi(cfi) {
    if (this._locations.length === 0) {
      return null;
    }
    // Find closest cfi
    var loc = this.locationFromCfi(cfi);
    // Get percentage in total
    return this.percentageFromLocation(loc);
  }

  /**
   * 특정 위치 인덱스의 진행률을 백분율로 반환합니다.
   *
   * @param {number} loc - 위치 인덱스
   * @return {number} 진행률 (0 ~ 1 사이의 값)
   *
   * @example
   * const percentage = locations.percentageFromLocation(42);
   * console.log(percentage); // 0.5 (50% 진행)
   */
  percentageFromLocation(loc) {
    if (!loc || !this.total) {
      return 0;
    }

    return loc / this.total;
  }

  /**
   * 특정 위치 인덱스에 해당하는 CFI를 반환합니다.
   *
   * @param {number} loc - 위치 인덱스
   * @return {EpubCFI} 해당 위치의 CFI
   *
   * @example
   * const cfi = locations.cfiFromLocation(42);
   * console.log(cfi); // "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])"
   */
  cfiFromLocation(loc) {
    var cfi = -1;
    // check that pg is an int
    if (typeof loc != "number") {
      loc = parseInt(loc);
    }

    if (loc >= 0 && loc < this._locations.length) {
      cfi = this._locations[loc];
    }

    return cfi;
  }

  /**
   * 진행률에 해당하는 CFI를 반환합니다.
   *
   * @param {number} percentage - 진행률 (0 ~ 1 사이의 값)
   * @return {EpubCFI} 해당 진행률의 CFI
   *
   * @example
   * const cfi = locations.cfiFromPercentage(0.5);
   * console.log(cfi); // "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])"
   */
  cfiFromPercentage(percentage) {
    let loc;
    if (percentage > 1) {
      console.warn("Normalize cfiFromPercentage value to between 0 - 1");
    }

    // Make sure 1 goes to very end
    if (percentage >= 1) {
      let cfi = new EpubCFI(this._locations[this.total]);
      cfi.collapse();
      return cfi.toString();
    }

    loc = Math.ceil(this.total * percentage);
    return this.cfiFromLocation(loc);
  }

  /**
   * JSON 형식의 위치 정보를 로드합니다.
   *
   * @param {json} locations - JSON 형식의 위치 정보
   * @return {Array} 로드된 위치 정보 배열
   *
   * @example
   * const locationsJson = '["epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])", ...]';
   * const loadedLocations = locations.load(locationsJson);
   * console.log(loadedLocations); // 로드된 CFI 배열
   */
  load(locations) {
    if (typeof locations === "string") {
      this._locations = JSON.parse(locations);
    } else {
      this._locations = locations;
    }
    this.total = this._locations.length - 1;
    return this._locations;
  }

  /**
   * 현재 위치 정보를 JSON 형식으로 저장합니다.
   *
   * @return {json} JSON 형식의 위치 정보
   *
   * @example
   * const locationsJson = locations.save();
   * console.log(locationsJson);
   * // 결과: '["epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])", ...]'
   */
  save() {
    return JSON.stringify(this._locations);
  }

  /**
   * 현재 위치를 반환합니다.
   *
   * @return {number} 현재 위치 인덱스
   *
   * @example
   * const current = locations.getCurrent();
   * console.log(current); // 42
   */
  getCurrent() {
    return this._current;
  }

  /**
   * 현재 위치를 설정합니다.
   *
   * @param {string|number} curr - 설정할 위치 (CFI 문자열 또는 인덱스)
   *
   * @example
   * // 인덱스로 설정
   * locations.setCurrent(42);
   *
   * // CFI로 설정
   * locations.setCurrent("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])");
   */
  setCurrent(curr) {
    var loc;

    if (typeof curr == "string") {
      this._currentCfi = curr;
    } else if (typeof curr == "number") {
      this._current = curr;
    } else {
      return;
    }

    if (this._locations.length === 0) {
      return;
    }

    if (typeof curr == "string") {
      loc = this.locationFromCfi(curr);
      this._current = loc;
    } else {
      loc = curr;
    }

    this.emit(EVENTS.LOCATIONS.CHANGED, {
      percentage: this.percentageFromLocation(loc),
    });
  }

  /**
   * 현재 위치를 반환합니다.
   *
   * @return {number} 현재 위치 인덱스
   *
   * @example
   * const current = locations.currentLocation;
   * console.log(current); // 42
   */
  get currentLocation() {
    return this._current;
  }

  /**
   * 현재 위치를 설정합니다.
   *
   * @param {string|number} curr - 설정할 위치 (CFI 문자열 또는 인덱스)
   *
   * @example
   * // 인덱스로 설정
   * locations.currentLocation = 42;
   *
   * // CFI로 설정
   * locations.currentLocation = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2:1])";
   */
  set currentLocation(curr) {
    this.setCurrent(curr);
  }

  /**
   * 위치 정보의 총 개수를 반환합니다.
   *
   * @return {number} 위치 정보의 총 개수
   *
   * @example
   * const total = locations.length();
   * console.log(total); // 100
   */
  length() {
    return this._locations.length;
  }

  /**
   * Locations 객체를 정리하고 메모리를 해제합니다.
   *
   * @example
   * locations.destroy();
   */
  destroy() {
    this.spine = undefined;
    this.request = undefined;
    this.pause = undefined;

    this.q.stop();
    this.q = undefined;
    this.epubcfi = undefined;

    this._locations = undefined;
    this.total = undefined;

    this.break = undefined;
    this._current = undefined;

    this.currentLocation = undefined;
    this._currentCfi = undefined;
    clearTimeout(this.processingTimeout);
  }
}

EventEmitter(Locations.prototype);

export default Locations;
