import { substitute } from "./utils/replacements";
import { createBase64Url, createBlobUrl, blob2base64 } from "./utils/core";
import Url from "./utils/url";
import mime from "./utils/mime";
import Path from "./utils/path";
import path from "path-webpack";

/**
 * EPUB 리소스 관리 클래스
 *
 * 이 클래스는 EPUB 파일의 리소스(이미지, CSS, HTML 등)를 관리하고 변환하는 역할을 합니다.
 * 리소스의 URL을 Blob URL이나 Base64 URL로 변환하고, CSS 파일 내의 상대 경로를 절대 경로로 변환하는 등의 기능을 제공합니다.
 *
 * @example
 * // EPUB 파일의 리소스 관리 예시
 * const resources = new Resources(manifest, {
 *   replacements: "base64", // "base64" 또는 "blob" 또는 "none"
 *   archive: epubArchive,
 *   resolver: (url) => resolveUrl(url)
 * });
 *
 * // 리소스 URL 변환 예시
 * resources.replacements().then((urls) => {
 *   console.log(urls); // ["data:image/png;base64,...", "data:image/jpeg;base64,..."]
 * });
 *
 * @class
 * @param {Manifest} manifest EPUB 매니페스트 객체
 * @param {object} [options] 옵션 객체
 * @param {string} [options.replacements="base64"] 리소스 변환 방식 ("base64", "blob", "none")
 * @param {Archive} [options.archive] EPUB 아카이브 객체
 * @param {method} [options.resolver] URL 해석기 함수
 */
class Resources {
  constructor(manifest, options) {
    this.settings = {
      replacements: (options && options.replacements) || "base64",
      archive: options && options.archive,
      resolver: options && options.resolver,
      request: options && options.request,
    };

    this.process(manifest);
  }

  /**
   * 리소스 처리
   *
   * 매니페스트의 리소스들을 처리하여 HTML, CSS, 에셋 등으로 분류합니다.
   *
   * @example
   * resources.process(manifest);
   * console.log(resources.html); // HTML 리소스 목록
   * console.log(resources.css); // CSS 리소스 목록
   * console.log(resources.assets); // 이미지 등 기타 리소스 목록
   *
   * @param {Manifest} manifest EPUB 매니페스트 객체
   */
  process(manifest) {
    this.manifest = manifest;
    this.resources = Object.keys(manifest).map(function (key) {
      return manifest[key];
    });

    this.replacementUrls = [];

    this.html = [];
    this.assets = [];
    this.css = [];

    this.urls = [];
    this.cssUrls = [];

    this.split();
    this.splitUrls();
  }

  /**
   * Split resources by type
   * @private
   */
  split() {
    // HTML
    this.html = this.resources.filter(function (item) {
      if (item.type === "application/xhtml+xml" || item.type === "text/html") {
        return true;
      }
    });

    // Exclude HTML
    this.assets = this.resources.filter(function (item) {
      if (item.type !== "application/xhtml+xml" && item.type !== "text/html") {
        return true;
      }
    });

    // Only CSS
    this.css = this.resources.filter(function (item) {
      if (item.type === "text/css") {
        return true;
      }
    });
  }

  /**
   * Convert split resources into Urls
   * @private
   */
  splitUrls() {
    // All Assets Urls
    this.urls = this.assets.map(
      function (item) {
        return item.href;
      }.bind(this)
    );

    // Css Urls
    this.cssUrls = this.css.map(function (item) {
      return item.href;
    });
  }

  /**
   * 리소스 URL 생성
   *
   * 주어진 URL의 리소스를 Blob URL이나 Base64 URL로 변환합니다.
   *
   * @example
   * resources.createUrl("images/cover.jpg")
   *   .then(url => {
   *     console.log(url); // "data:image/jpeg;base64,..." 또는 "blob:http://..."
   *   });
   *
   * @param {string} url 리소스 URL
   * @return {Promise<string>} Promise가 resolve되면 변환된 URL 문자열 반환
   */
  createUrl(url) {
    var parsedUrl = new Url(url);
    var mimeType = mime.lookup(parsedUrl.filename);

    if (this.settings.archive) {
      return this.settings.archive.createUrl(url, {
        base64: this.settings.replacements === "base64",
      });
    } else {
      if (this.settings.replacements === "base64") {
        return this.settings
          .request(url, "blob")
          .then((blob) => {
            return blob2base64(blob);
          })
          .then((blob) => {
            return createBase64Url(blob, mimeType);
          });
      } else {
        return this.settings.request(url, "blob").then((blob) => {
          return createBlobUrl(blob, mimeType);
        });
      }
    }
  }

  /**
   * 모든 에셋의 Blob URL 생성
   *
   * 모든 에셋 리소스의 URL을 설정된 방식(base64 또는 blob)으로 변환합니다.
   *
   * @example
   * resources.replacements()
   *   .then(urls => {
   *     console.log(urls); // ["data:image/png;base64,...", "data:image/jpeg;base64,..."]
   *   });
   *
   * @return {Promise<string[]>} Promise가 resolve되면 변환된 URL 배열 반환
   */
  replacements() {
    if (this.settings.replacements === "none") {
      return new Promise(
        function (resolve) {
          resolve(this.urls);
        }.bind(this)
      );
    }

    var replacements = this.urls.map((url) => {
      var absolute = this.settings.resolver(url);

      return this.createUrl(absolute).catch((err) => {
        console.error(err);
        return null;
      });
    });

    return Promise.all(replacements).then((replacementUrls) => {
      this.replacementUrls = replacementUrls.filter((url) => {
        return typeof url === "string";
      });
      return replacementUrls;
    });
  }

  /**
   * CSS 리소스의 URL 교체
   *
   * CSS 파일 내의 상대 경로를 절대 경로로 변환합니다.
   *
   * @example
   * resources.replaceCss()
   *   .then(() => {
   *     console.log("CSS URL 교체 완료");
   *   });
   *
   * @private
   * @param  {Archive} [archive] EPUB 아카이브 객체
   * @param  {method} [resolver] URL 해석기 함수
   * @return {Promise}
   */
  replaceCss(archive, resolver) {
    var replaced = [];
    archive = archive || this.settings.archive;
    resolver = resolver || this.settings.resolver;
    this.cssUrls.forEach(
      function (href) {
        var replacement = this.createCssFile(href, archive, resolver).then(
          function (replacementUrl) {
            // switch the url in the replacementUrls
            var indexInUrls = this.urls.indexOf(href);
            if (indexInUrls > -1) {
              this.replacementUrls[indexInUrls] = replacementUrl;
            }
          }.bind(this)
        );

        replaced.push(replacement);
      }.bind(this)
    );
    return Promise.all(replaced);
  }

  /**
   * 새로운 CSS 파일 생성
   *
   * URL이 교체된 새로운 CSS 파일을 생성합니다.
   *
   * @example
   * resources.createCssFile("styles/main.css")
   *   .then(url => {
   *     console.log(url); // "data:text/css;base64,..." 또는 "blob:http://..."
   *   });
   *
   * @private
   * @param  {string} href 원본 CSS 파일 경로
   * @return {Promise<string>} Promise가 resolve되면 새로운 CSS 파일의 URL 반환
   */
  createCssFile(href) {
    var newUrl;

    if (path.isAbsolute(href)) {
      return new Promise(function (resolve) {
        resolve();
      });
    }

    var absolute = this.settings.resolver(href);

    // Get the text of the css file from the archive
    var textResponse;

    if (this.settings.archive) {
      textResponse = this.settings.archive.getText(absolute);
    } else {
      textResponse = this.settings.request(absolute, "text");
    }

    // Get asset links relative to css file
    var relUrls = this.urls.map((assetHref) => {
      var resolved = this.settings.resolver(assetHref);
      var relative = new Path(absolute).relative(resolved);

      return relative;
    });

    if (!textResponse) {
      // file not found, don't replace
      return new Promise(function (resolve) {
        resolve();
      });
    }

    return textResponse.then(
      (text) => {
        // Replacements in the css text
        text = substitute(text, relUrls, this.replacementUrls);

        // Get the new url
        if (this.settings.replacements === "base64") {
          newUrl = createBase64Url(text, "text/css");
        } else {
          newUrl = createBlobUrl(text, "text/css");
        }

        return newUrl;
      },
      (err) => {
        // handle response errors
        return new Promise(function (resolve) {
          resolve();
        });
      }
    );
  }

  /**
   * 리소스 URL을 절대 URL 기준으로 상대 경로로 변환
   *
   * @example
   * const relativeUrls = resources.relativeTo("OEBPS/content.opf");
   * console.log(relativeUrls); // ["../images/cover.jpg", "../styles/main.css"]
   *
   * @param  {string} absolute 기준이 되는 절대 URL
   * @param  {resolver} [resolver] URL 해석기 함수
   * @return {string[]} 상대 URL 배열
   */
  relativeTo(absolute, resolver) {
    resolver = resolver || this.settings.resolver;

    // Get Urls relative to current sections
    return this.urls.map(
      function (href) {
        var resolved = resolver(href);
        var relative = new Path(absolute).relative(resolved);
        return relative;
      }.bind(this)
    );
  }

  /**
   * 리소스의 URL 가져오기
   *
   * @example
   * resources.get("images/cover.jpg")
   *   .then(url => {
   *     console.log(url); // "data:image/jpeg;base64,..." 또는 "blob:http://..."
   *   });
   *
   * @param  {string} path 리소스 경로
   * @return {Promise<string>} Promise가 resolve되면 리소스 URL 반환
   */
  get(path) {
    var indexInUrls = this.urls.indexOf(path);
    if (indexInUrls === -1) {
      return;
    }
    if (this.replacementUrls.length) {
      return new Promise(
        function (resolve, reject) {
          resolve(this.replacementUrls[indexInUrls]);
        }.bind(this)
      );
    } else {
      return this.createUrl(path);
    }
  }

  /**
   * 컨텐츠 내의 URL을 교체된 URL로 대체
   *
   * @example
   * const content = '<img src="images/cover.jpg">';
   * const newContent = resources.substitute(content, "OEBPS/content.opf");
   * console.log(newContent); // '<img src="data:image/jpeg;base64,...">'
   *
   * @param  {string} content 원본 컨텐츠
   * @param  {string} [url] 기준이 되는 URL
   * @return {string} URL이 교체된 컨텐츠
   */
  substitute(content, url) {
    var relUrls;
    if (url) {
      relUrls = this.relativeTo(url);
    } else {
      relUrls = this.urls;
    }
    return substitute(content, relUrls, this.replacementUrls);
  }

  /**
   * 리소스 정리
   *
   * 클래스의 모든 속성을 초기화하여 메모리를 해제합니다.
   *
   * @example
   * resources.destroy();
   */
  destroy() {
    this.settings = undefined;
    this.manifest = undefined;
    this.resources = undefined;
    this.replacementUrls = undefined;
    this.html = undefined;
    this.assets = undefined;
    this.css = undefined;

    this.urls = undefined;
    this.cssUrls = undefined;
  }
}

export default Resources;
