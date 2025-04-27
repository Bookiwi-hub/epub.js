import { defer, isXml, parse } from "./utils/core";
import httpRequest from "./utils/request";
import mime from "./utils/mime";
import Path from "./utils/path";
import EventEmitter from "event-emitter";
import localforage from "localforage";

/**
 * 로컬 스토리지에서 파일을 저장하고 요청하는 기능을 처리하는 클래스
 * @class
 * @param {string} name - 애플리케이션 이름 (모달 등에 사용)
 * @param {function} [requester] - 파일 요청을 처리하는 함수 (기본값: httpRequest)
 * @param {function} [resolver] - URL 해석을 위한 함수
 *
 * @example
 * // 기본 사용 예시
 * const store = new Store("myEbookApp");
 *
 * // 커스텀 requester와 resolver 사용 예시
 * const store = new Store("myEbookApp", customRequester, customResolver);
 *
 * @example
 * // 파일 저장 예시
 * store.put("https://example.com/book.epub")
 *   .then(blob => {
 *     console.log("파일이 저장되었습니다:", blob);
 *   });
 *
 * // 파일 조회 예시
 * store.retrieve("book.epub", "blob")
 *   .then(data => {
 *     console.log("파일 데이터:", data);
 *   });
 */
class Store {
  constructor(name, requester, resolver) {
    this.urlCache = {};

    this.storage = undefined;

    this.name = name;
    this.requester = requester || httpRequest;
    this.resolver = resolver;

    this.online = true;

    this.checkRequirements();

    this.addListeners();
  }

  /**
   * Checks to see if localForage exists in global namspace,
   * Requires localForage if it isn't there
   * @private
   */
  checkRequirements() {
    try {
      let store;
      if (typeof localforage === "undefined") {
        store = localforage;
      }
      this.storage = store.createInstance({
        name: this.name,
      });
    } catch (e) {
      throw new Error("localForage lib not loaded");
    }
  }

  /**
   * Add online and offline event listeners
   * @private
   */
  addListeners() {
    this._status = this.status.bind(this);
    window.addEventListener("online", this._status);
    window.addEventListener("offline", this._status);
  }

  /**
   * Remove online and offline event listeners
   * @private
   */
  removeListeners() {
    window.removeEventListener("online", this._status);
    window.removeEventListener("offline", this._status);
    this._status = undefined;
  }

  /**
   * Update the online / offline status
   * @private
   */
  status(event) {
    let online = navigator.onLine;
    this.online = online;
    if (online) {
      this.emit("online", this);
    } else {
      this.emit("offline", this);
    }
  }

  /**
   * 로컬 스토리지에 책의 모든 리소스를 추가
   * @param  {Resources} resources - 책의 리소스들
   * @param  {boolean} [force] - 이미 저장된 리소스도 강제로 다시 저장할지 여부
   * @return {Promise<object>} 저장된 객체들의 배열을 반환하는 Promise
   *
   * @example
   * // 리소스 추가 예시
   * store.add(book.resources)
   *   .then(savedResources => {
   *     console.log("모든 리소스가 저장되었습니다:", savedResources);
   *   });
   *
   * // 강제로 다시 저장하는 예시
   * store.add(book.resources, true)
   *   .then(savedResources => {
   *     console.log("리소스가 강제로 다시 저장되었습니다:", savedResources);
   *   });
   */
  add(resources, force) {
    let mapped = resources.resources.map((item) => {
      let { href } = item;
      let url = this.resolver(href);
      let encodedUrl = window.encodeURIComponent(url);

      return this.storage.getItem(encodedUrl).then((item) => {
        if (!item || force) {
          return this.requester(url, "binary").then((data) => {
            return this.storage.setItem(encodedUrl, data);
          });
        } else {
          return item;
        }
      });
    });
    return Promise.all(mapped);
  }

  /**
   * URL에서 바이너리 데이터를 가져와 스토리지에 저장
   * @param  {string} url - 스토리지에서 요청할 URL
   * @param  {boolean} [withCredentials] - 인증 정보 포함 여부
   * @param  {object} [headers] - 요청 헤더
   * @return {Promise<Blob>} 저장된 Blob 데이터를 반환하는 Promise
   *
   * @example
   * // 기본 사용 예시
   * store.put("https://example.com/image.jpg")
   *   .then(blob => {
   *     console.log("이미지가 저장되었습니다:", blob);
   *   });
   *
   * // 인증 정보와 헤더를 포함한 예시
   * store.put("https://example.com/secure.jpg", true, { "Authorization": "Bearer token" })
   *   .then(blob => {
   *     console.log("보안 이미지가 저장되었습니다:", blob);
   *   });
   */
  put(url, withCredentials, headers) {
    let encodedUrl = window.encodeURIComponent(url);

    return this.storage.getItem(encodedUrl).then((result) => {
      if (!result) {
        return this.requester(url, "binary", withCredentials, headers).then(
          (data) => {
            return this.storage.setItem(encodedUrl, data);
          }
        );
      }
      return result;
    });
  }

  /**
   * URL에서 데이터를 요청
   * @param  {string} url - 요청할 URL
   * @param  {string} [type] - 반환될 결과의 타입 (blob, text, json 등)
   * @param  {boolean} [withCredentials] - 인증 정보 포함 여부
   * @param  {object} [headers] - 요청 헤더
   * @return {Promise<Blob | string | JSON | Document | XMLDocument>} 요청된 데이터를 반환하는 Promise
   *
   * @example
   * // 텍스트 파일 요청 예시
   * store.request("chapter1.txt", "text")
   *   .then(text => {
   *     console.log("텍스트 내용:", text);
   *   });
   *
   * // JSON 파일 요청 예시
   * store.request("metadata.json", "json")
   *   .then(json => {
   *     console.log("메타데이터:", json);
   *   });
   */
  request(url, type, withCredentials, headers) {
    if (this.online) {
      // From network
      return this.requester(url, type, withCredentials, headers).then(
        (data) => {
          // save to store if not present
          this.put(url);
          return data;
        }
      );
    } else {
      // From store
      return this.retrieve(url, type);
    }
  }

  /**
   * 스토리지에서 URL로 데이터를 요청
   * @param  {string} url - 요청할 URL
   * @param  {string} [type] - 반환될 결과의 타입
   * @return {Promise<Blob | string | JSON | Document | XMLDocument>} 요청된 데이터를 반환하는 Promise
   *
   * @example
   * // 스토리지에서 이미지 조회 예시
   * store.retrieve("cover.jpg", "blob")
   *   .then(blob => {
   *     console.log("커버 이미지:", blob);
   *   });
   *
   * // 스토리지에서 HTML 조회 예시
   * store.retrieve("chapter1.html", "html")
   *   .then(html => {
   *     console.log("HTML 내용:", html);
   *   });
   */
  retrieve(url, type) {
    var deferred = new defer();
    var response;
    var path = new Path(url);

    // If type isn't set, determine it from the file extension
    if (!type) {
      type = path.extension;
    }

    if (type == "blob") {
      response = this.getBlob(url);
    } else {
      response = this.getText(url);
    }

    return response.then((r) => {
      var deferred = new defer();
      var result;
      if (r) {
        result = this.handleResponse(r, type);
        deferred.resolve(result);
      } else {
        deferred.reject({
          message: "File not found in storage: " + url,
          stack: new Error().stack,
        });
      }
      return deferred.promise;
    });
  }

  /**
   * Handle the response from request
   * @private
   * @param  {any} response
   * @param  {string} [type]
   * @return {any} the parsed result
   */
  handleResponse(response, type) {
    var r;

    if (type == "json") {
      r = JSON.parse(response);
    } else if (isXml(type)) {
      r = parse(response, "text/xml");
    } else if (type == "xhtml") {
      r = parse(response, "application/xhtml+xml");
    } else if (type == "html" || type == "htm") {
      r = parse(response, "text/html");
    } else {
      r = response;
    }

    return r;
  }

  /**
   * 스토리지에서 Blob 데이터를 URL로 가져오기
   * @param  {string} url - Blob을 가져올 URL
   * @param  {string} [mimeType] - Blob의 MIME 타입
   * @return {Promise<Blob>} Blob 데이터를 반환하는 Promise
   *
   * @example
   * // 이미지 Blob 가져오기 예시
   * store.getBlob("image.jpg", "image/jpeg")
   *   .then(blob => {
   *     console.log("이미지 Blob:", blob);
   *     // Blob URL 생성
   *     const url = URL.createObjectURL(blob);
   *   });
   */
  getBlob(url, mimeType) {
    let encodedUrl = window.encodeURIComponent(url);

    return this.storage.getItem(encodedUrl).then(function (uint8array) {
      if (!uint8array) return;

      mimeType = mimeType || mime.lookup(url);

      return new Blob([uint8array], { type: mimeType });
    });
  }

  /**
   * 스토리지에서 텍스트 데이터를 URL로 가져오기
   * @param  {string} url - 텍스트를 가져올 URL
   * @param  {string} [mimeType] - 텍스트의 MIME 타입
   * @return {Promise<string>} 텍스트 데이터를 반환하는 Promise
   *
   * @example
   * // HTML 텍스트 가져오기 예시
   * store.getText("chapter1.html", "text/html")
   *   .then(text => {
   *     console.log("HTML 텍스트:", text);
   *   });
   */
  getText(url, mimeType) {
    let encodedUrl = window.encodeURIComponent(url);

    mimeType = mimeType || mime.lookup(url);

    return this.storage.getItem(encodedUrl).then(function (uint8array) {
      var deferred = new defer();
      var reader = new FileReader();
      var blob;

      if (!uint8array) return;

      blob = new Blob([uint8array], { type: mimeType });

      reader.addEventListener("loadend", () => {
        deferred.resolve(reader.result);
      });

      reader.readAsText(blob, mimeType);

      return deferred.promise;
    });
  }

  /**
   * 스토리지에서 Base64로 인코딩된 데이터를 URL로 가져오기
   * @param  {string} url - Base64 데이터를 가져올 URL
   * @param  {string} [mimeType] - 데이터의 MIME 타입
   * @return {Promise<string>} Base64로 인코딩된 문자열을 반환하는 Promise
   *
   * @example
   * // 이미지를 Base64로 가져오기 예시
   * store.getBase64("image.jpg", "image/jpeg")
   *   .then(base64 => {
   *     console.log("Base64 이미지:", base64);
   *     // 이미지 태그에 직접 사용 가능
   *     const img = document.createElement("img");
   *     img.src = base64;
   *   });
   */
  getBase64(url, mimeType) {
    let encodedUrl = window.encodeURIComponent(url);

    mimeType = mimeType || mime.lookup(url);

    return this.storage.getItem(encodedUrl).then((uint8array) => {
      var deferred = new defer();
      var reader = new FileReader();
      var blob;

      if (!uint8array) return;

      blob = new Blob([uint8array], { type: mimeType });

      reader.addEventListener("loadend", () => {
        deferred.resolve(reader.result);
      });
      reader.readAsDataURL(blob, mimeType);

      return deferred.promise;
    });
  }

  /**
   * 저장된 항목으로부터 URL 생성
   * @param  {string} url - URL을 생성할 항목의 URL
   * @param  {object} [options] - 옵션 객체
   * @param  {boolean} [options.base64] - Base64 인코딩 사용 여부
   * @return {Promise<string>} 생성된 URL을 반환하는 Promise
   *
   * @example
   * // Blob URL 생성 예시
   * store.createUrl("image.jpg")
   *   .then(url => {
   *     console.log("Blob URL:", url);
   *     const img = document.createElement("img");
   *     img.src = url;
   *   });
   *
   * // Base64 URL 생성 예시
   * store.createUrl("image.jpg", { base64: true })
   *   .then(url => {
   *     console.log("Base64 URL:", url);
   *     const img = document.createElement("img");
   *     img.src = url;
   *   });
   */
  createUrl(url, options) {
    var deferred = new defer();
    var _URL = window.URL || window.webkitURL || window.mozURL;
    var tempUrl;
    var response;
    var useBase64 = options && options.base64;

    if (url in this.urlCache) {
      deferred.resolve(this.urlCache[url]);
      return deferred.promise;
    }

    if (useBase64) {
      response = this.getBase64(url);

      if (response) {
        response.then(
          function (tempUrl) {
            this.urlCache[url] = tempUrl;
            deferred.resolve(tempUrl);
          }.bind(this)
        );
      }
    } else {
      response = this.getBlob(url);

      if (response) {
        response.then(
          function (blob) {
            tempUrl = _URL.createObjectURL(blob);
            this.urlCache[url] = tempUrl;
            deferred.resolve(tempUrl);
          }.bind(this)
        );
      }
    }

    if (!response) {
      deferred.reject({
        message: "File not found in storage: " + url,
        stack: new Error().stack,
      });
    }

    return deferred.promise;
  }

  /**
   * 임시 URL 해제
   * @param  {string} url - 해제할 URL
   *
   * @example
   * // URL 해제 예시
   * store.revokeUrl("image.jpg");
   */
  revokeUrl(url) {
    var _URL = window.URL || window.webkitURL || window.mozURL;
    var fromCache = this.urlCache[url];
    if (fromCache) _URL.revokeObjectURL(fromCache);
  }

  /**
   * Store 인스턴스 정리 및 제거
   * 모든 캐시된 URL을 해제하고 이벤트 리스너를 제거
   *
   * @example
   * // Store 인스턴스 정리 예시
   * store.destroy();
   */
  destroy() {
    var _URL = window.URL || window.webkitURL || window.mozURL;
    for (let fromCache in this.urlCache) {
      _URL.revokeObjectURL(fromCache);
    }
    this.urlCache = {};
    this.removeListeners();
  }
}

EventEmitter(Store.prototype);

export default Store;
