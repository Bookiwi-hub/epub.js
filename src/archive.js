import { defer, isXml, parse } from "./utils/core";
import request from "./utils/request";
import mime from "./utils/mime";
import Path from "./utils/path";
import JSZip from "jszip/dist/jszip";

/**
 * EPUB 파일의 압축을 해제하고 파일을 요청하는 기능을 제공하는 클래스
 * @class
 * @example
 * // EPUB 파일 로드 예시
 * const archive = new Archive();
 * archive.openUrl('book.epub').then(() => {
 *   // 컨테이너 파일 요청
 *   return archive.request('META-INF/container.xml');
 * }).then((container) => {
 *   // 컨테이너 파싱 후 처리
 *   console.log(container); // XMLDocument 객체 반환
 *   // 예시 출력:
 *   // <?xml version="1.0" encoding="UTF-8"?>
 *   // <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
 *   //   <rootfiles>
 *   //     <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
 *   //   </rootfiles>
 *   // </container>
 * });
 */
class Archive {
  constructor() {
    this.zip = undefined;
    this.urlCache = {};

    this.checkRequirements();
  }

  /**
   * JSZip 라이브러리가 전역 네임스페이스에 존재하는지 확인하고,
   * 없을 경우 JSZip를 요구하는 메소드
   * @private
   */
  checkRequirements() {
    try {
      this.zip = new JSZip();
    } catch (e) {
      throw new Error("JSZip lib not loaded");
    }
  }

  /**
   * EPUB 파일을 열고 압축을 해제하는 메소드
   * @param  {binary} input - EPUB 파일의 바이너리 데이터
   * @param  {boolean} [isBase64] - 입력 데이터가 base64로 인코딩되었는지 여부
   * @return {Promise} - 압축 해제된 EPUB 파일을 나타내는 Promise 객체
   * @example
   * // base64로 인코딩된 EPUB 파일 열기
   * archive.open(base64Data, true).then((zip) => {
   *   console.log('EPUB 파일이 성공적으로 열렸습니다.');
   *   console.log(zip); // JSZip 객체 반환
   *   // 예시 출력:
   *   // JSZip {
   *   //   files: {
   *   //     "META-INF/container.xml": {...},
   *   //     "OEBPS/content.opf": {...},
   *   //     "OEBPS/toc.ncx": {...},
   *   //     ...
   *   //   }
   *   // }
   * });
   */
  open(input, isBase64) {
    return this.zip.loadAsync(input, { base64: isBase64 });
  }

  /**
   * URL에서 EPUB 파일을 로드하고 압축을 해제하는 메소드
   * @param  {string} zipUrl - EPUB 파일의 URL
   * @param  {boolean} [isBase64] - 입력 데이터가 base64로 인코딩되었는지 여부
   * @return {Promise} - 압축 해제된 EPUB 파일을 나타내는 Promise 객체
   * @example
   * // URL에서 EPUB 파일 로드
   * archive.openUrl('https://example.com/book.epub').then((zip) => {
   *   console.log('EPUB 파일이 성공적으로 로드되었습니다.');
   *   console.log(zip); // JSZip 객체 반환
   *   // 예시 출력:
   *   // JSZip {
   *   //   files: {
   *   //     "META-INF/container.xml": {...},
   *   //     "OEBPS/content.opf": {...},
   *   //     "OEBPS/toc.ncx": {...},
   *   //     ...
   *   //   }
   *   // }
   * });
   */
  openUrl(zipUrl, isBase64) {
    return request(zipUrl, "binary").then(
      function (data) {
        return this.zip.loadAsync(data, { base64: isBase64 });
      }.bind(this)
    );
  }

  /**
   * EPUB 파일 내의 특정 URL에 대한 파일을 요청하는 메소드
   * @param  {string} url - EPUB 파일 내에서 요청할 파일의 경로
   * @param  {string} [type] - 반환될 결과의 타입 (blob, text, json, xml 등)
   * @return {Promise<Blob | string | JSON | Document | XMLDocument>} - 요청된 파일의 내용
   * @example
   * // 컨테이너 파일 요청
   * archive.request('META-INF/container.xml', 'xml').then((container) => {
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
   * // HTML 파일 요청
   * archive.request('OEBPS/chapter1.xhtml', 'xhtml').then((doc) => {
   *   console.log(doc); // Document 객체 반환
   *   // 예시 출력:
   *   // <html xmlns="http://www.w3.org/1999/xhtml">
   *   //   <head>...</head>
   *   //   <body>
   *   //     <h1>Chapter 1</h1>
   *   //     <p>This is the first chapter...</p>
   *   //   </body>
   *   // </html>
   * });
   */
  request(url, type) {
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

    if (response) {
      response.then(
        function (r) {
          let result = this.handleResponse(r, type);
          deferred.resolve(result);
        }.bind(this)
      );
    } else {
      deferred.reject({
        message: "File not found in the epub: " + url,
        stack: new Error().stack,
      });
    }
    return deferred.promise;
  }

  /**
   * 요청에 대한 응답을 처리하는 메소드
   * @private
   * @param  {any} response - 원본 응답 데이터
   * @param  {string} [type] - 응답 데이터의 타입
   * @return {any} - 파싱된 결과
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
   * EPUB 파일 내의 특정 URL에 대한 Blob 객체를 가져오는 메소드
   * @param  {string} url - EPUB 파일 내의 파일 경로
   * @param  {string} [mimeType] - Blob의 MIME 타입
   * @return {Blob} - 요청된 파일의 Blob 객체
   * @example
   * // 이미지 파일을 Blob으로 가져오기
   * archive.getBlob('OEBPS/images/cover.jpg', 'image/jpeg').then((blob) => {
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
   */
  getBlob(url, mimeType) {
    var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
    var entry = this.zip.file(decodededUrl);

    if (entry) {
      mimeType = mimeType || mime.lookup(entry.name);
      return entry.async("uint8array").then(function (uint8array) {
        return new Blob([uint8array], { type: mimeType });
      });
    }
  }

  /**
   * EPUB 파일 내의 특정 URL에 대한 텍스트 내용을 가져오는 메소드
   * @param  {string} url - EPUB 파일 내의 파일 경로
   * @param  {string} [encoding] - 텍스트의 인코딩 방식
   * @return {string} - 요청된 파일의 텍스트 내용
   * @example
   * // HTML 파일 내용 가져오기
   * archive.getText('OEBPS/chapter1.xhtml').then((content) => {
   *   console.log(content); // 문자열 반환
   *   // 예시 출력:
   *   // <?xml version="1.0" encoding="UTF-8"?>
   *   // <!DOCTYPE html>
   *   // <html xmlns="http://www.w3.org/1999/xhtml">
   *   //   <head>...</head>
   *   //   <body>
   *   //     <h1>Chapter 1</h1>
   *   //     <p>This is the first chapter...</p>
   *   //   </body>
   *   // </html>
   *   document.getElementById('content').innerHTML = content;
   * });
   */
  getText(url, encoding) {
    var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
    var entry = this.zip.file(decodededUrl);

    if (entry) {
      return entry.async("string").then(function (text) {
        return text;
      });
    }
  }

  /**
   * EPUB 파일 내의 특정 URL에 대한 base64 인코딩된 결과를 가져오는 메소드
   * @param  {string} url - EPUB 파일 내의 파일 경로
   * @param  {string} [mimeType] - 파일의 MIME 타입
   * @return {string} - base64로 인코딩된 데이터 URL
   * @example
   * // 이미지를 base64로 가져오기
   * archive.getBase64('OEBPS/images/cover.jpg').then((dataUrl) => {
   *   console.log(dataUrl); // base64 데이터 URL 반환
   *   // 예시 출력:
   *   // "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4QBYRXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAQ6ADAAQAAAABAAAAQwAAAAA..."
   *   document.getElementById('cover').src = dataUrl;
   * });
   */
  getBase64(url, mimeType) {
    var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
    var entry = this.zip.file(decodededUrl);

    if (entry) {
      mimeType = mimeType || mime.lookup(entry.name);
      return entry.async("base64").then(function (data) {
        return "data:" + mimeType + ";base64," + data;
      });
    }
  }

  /**
   * EPUB 파일 내의 항목에 대한 URL을 생성하는 메소드
   * @param  {string} url - EPUB 파일 내의 파일 경로
   * @param  {object} [options.base64] - base64 인코딩 사용 여부
   * @return {Promise} - 생성된 URL을 포함하는 Promise 객체
   * @example
   * // 이미지 URL 생성
   * archive.createUrl('OEBPS/images/cover.jpg').then((url) => {
   *   console.log(url); // Blob URL 반환
   *   // 예시 출력:
   *   // "blob:http://localhost:8080/550e8400-e29b-41d4-a716-446655440000"
   *   document.getElementById('cover').src = url;
   * });
   *
   * // base64 URL 생성
   * archive.createUrl('OEBPS/images/cover.jpg', { base64: true }).then((url) => {
   *   console.log(url); // base64 데이터 URL 반환
   *   // 예시 출력:
   *   // "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4QBYRXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAQ6ADAAQAAAABAAAAQwAAAAA..."
   *   document.getElementById('cover').src = url;
   * });
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
        message: "File not found in the epub: " + url,
        stack: new Error().stack,
      });
    }

    return deferred.promise;
  }

  /**
   * EPUB 파일 내의 항목에 대해 생성된 임시 URL을 해제하는 메소드
   * @param  {string} url - EPUB 파일 내의 파일 경로
   * @example
   * // 이미지 URL 해제
   * const imgUrl = await archive.createUrl('OEBPS/images/cover.jpg');
   * document.getElementById('cover').src = imgUrl;
   * // 이미지 사용이 끝난 후 URL 해제
   * archive.revokeUrl('OEBPS/images/cover.jpg');
   * // 이제 imgUrl은 더 이상 유효하지 않음
   */
  revokeUrl(url) {
    var _URL = window.URL || window.webkitURL || window.mozURL;
    var fromCache = this.urlCache[url];
    if (fromCache) _URL.revokeObjectURL(fromCache);
  }

  /**
   * Archive 객체를 정리하고 메모리를 해제하는 메소드
   * @example
   * // EPUB 리더 종료 시
   * archive.destroy();
   * // 이제 모든 임시 URL이 해제되고 메모리가 정리됨
   */
  destroy() {
    var _URL = window.URL || window.webkitURL || window.mozURL;
    for (let fromCache in this.urlCache) {
      _URL.revokeObjectURL(fromCache);
    }
    this.zip = undefined;
    this.urlCache = {};
  }
}

export default Archive;
