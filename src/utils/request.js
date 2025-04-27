import { defer, isXml, parse } from "./core";
import Path from "./path";

/**
 * URL로부터 리소스를 요청하고 응답을 반환하는 함수
 * @param {string} url - 요청할 리소스의 URL
 * @param {string} [type=null] - 응답 데이터의 타입 ('binary', 'base64', 'text', 'json', 'xml', 'blob', 'arraybuffer')
 * @param {boolean} [withCredentials=false] - 크로스 오리진 요청 시 인증 정보 포함 여부
 * @param {object} [headers={}] - 요청 헤더 정보
 * @returns {Promise} 요청된 리소스를 포함하는 Promise 객체
 * @example
 * // 바이너리 데이터 요청
 * request('book.epub', 'binary')
 *   .then(data => {
 *     console.log(data); // ArrayBuffer 객체
 *   });
 *
 * // JSON 데이터 요청
 * request('manifest.json', 'json')
 *   .then(data => {
 *     console.log(data); // JSON 객체
 *   });
 *
 * // XML 데이터 요청
 * request('content.opf', 'xml')
 *   .then(data => {
 *     console.log(data); // XMLDocument 객체
 *   });
 *
 * // 인증 정보가 필요한 요청
 * request('protected-resource', null, true)
 *   .then(data => {
 *     console.log(data);
 *   });
 *
 * // 커스텀 헤더가 필요한 요청
 * request('resource', null, false, {
 *   'Authorization': 'Bearer token',
 *   'Custom-Header': 'value'
 * })
 *   .then(data => {
 *     console.log(data);
 *   });
 *
 * @description
 * 이 함수는 다음과 같은 작업을 수행합니다:
 * 1. XMLHttpRequest 객체를 생성하고 설정
 * 2. 요청 타입에 따라 responseType 설정
 * 3. withCredentials 설정
 * 4. 커스텀 헤더 설정
 * 5. 요청을 보내고 응답을 처리
 * 6. 응답 데이터를 지정된 타입으로 변환하여 반환
 *
 * @throws {Error} 요청이 실패했을 때 발생
 */
function request(url, type, withCredentials, headers) {
  var supportsURL = typeof window != "undefined" ? window.URL : false; // TODO: fallback for url if window isn't defined
  var BLOB_RESPONSE = supportsURL ? "blob" : "arraybuffer";

  var deferred = new defer();

  var xhr = new XMLHttpRequest();

  //-- Check from PDF.js:
  //   https://github.com/mozilla/pdf.js/blob/master/web/compatibility.js
  var xhrPrototype = XMLHttpRequest.prototype;

  var header;

  if (!("overrideMimeType" in xhrPrototype)) {
    // IE10 might have response, but not overrideMimeType
    Object.defineProperty(xhrPrototype, "overrideMimeType", {
      value: function xmlHttpRequestOverrideMimeType() {},
    });
  }

  if (withCredentials) {
    xhr.withCredentials = true;
  }

  xhr.onreadystatechange = handler;
  xhr.onerror = err;

  xhr.open("GET", url, true);

  for (header in headers) {
    xhr.setRequestHeader(header, headers[header]);
  }

  if (type == "json") {
    xhr.setRequestHeader("Accept", "application/json");
  }

  // If type isn"t set, determine it from the file extension
  if (!type) {
    type = new Path(url).extension;
  }

  if (type == "blob") {
    xhr.responseType = BLOB_RESPONSE;
  }

  if (isXml(type)) {
    // xhr.responseType = "document";
    xhr.overrideMimeType("text/xml"); // for OPF parsing
  }

  if (type == "xhtml") {
    // xhr.responseType = "document";
  }

  if (type == "html" || type == "htm") {
    // xhr.responseType = "document";
  }

  if (type == "binary") {
    xhr.responseType = "arraybuffer";
  }

  xhr.send();

  function err(e) {
    deferred.reject(e);
  }

  function handler() {
    if (this.readyState === XMLHttpRequest.DONE) {
      var responseXML = false;

      if (this.responseType === "" || this.responseType === "document") {
        responseXML = this.responseXML;
      }

      if (this.status === 200 || this.status === 0 || responseXML) {
        //-- Firefox is reporting 0 for blob urls
        var r;

        if (!this.response && !responseXML) {
          deferred.reject({
            status: this.status,
            message: "Empty Response",
            stack: new Error().stack,
          });
          return deferred.promise;
        }

        if (this.status === 403) {
          deferred.reject({
            status: this.status,
            response: this.response,
            message: "Forbidden",
            stack: new Error().stack,
          });
          return deferred.promise;
        }
        if (responseXML) {
          r = this.responseXML;
        } else if (isXml(type)) {
          // xhr.overrideMimeType("text/xml"); // for OPF parsing
          // If this.responseXML wasn't set, try to parse using a DOMParser from text
          r = parse(this.response, "text/xml");
        } else if (type == "xhtml") {
          r = parse(this.response, "application/xhtml+xml");
        } else if (type == "html" || type == "htm") {
          r = parse(this.response, "text/html");
        } else if (type == "json") {
          r = JSON.parse(this.response);
        } else if (type == "blob") {
          if (supportsURL) {
            r = this.response;
          } else {
            //-- Safari doesn't support responseType blob, so create a blob from arraybuffer
            r = new Blob([this.response]);
          }
        } else {
          r = this.response;
        }

        deferred.resolve(r);
      } else {
        deferred.reject({
          status: this.status,
          message: this.response,
          stack: new Error().stack,
        });
      }
    }
  }

  return deferred.promise;
}

export default request;
