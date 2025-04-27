import Path from "./path";
import path from "path-webpack";

/**
 * Creates a Url object for parsing and manipulation of a url string
 * @param	{string} urlString	a url string (relative or absolute)
 * @param	{string} [baseString] optional base for the url,
 * default to window.location.href
 * @example
 * // 1. 절대 URL 파싱
 * const absoluteUrl = new Url('https://example.com/books/book1/chapter1.html');
 * console.log(absoluteUrl.protocol); // 'https:'
 * console.log(absoluteUrl.origin); // 'https://example.com'
 * console.log(absoluteUrl.directory); // '/books/book1'
 * console.log(absoluteUrl.filename); // 'chapter1.html'
 *
 * // 2. 상대 URL과 베이스 URL 사용
 * const baseUrl = 'https://example.com/books/main/';
 * const relativeUrl = new Url('../../images/cover.jpg', baseUrl);
 * console.log(relativeUrl.href); // 'https://example.com/images/cover.jpg'
 *
 * // 3. URL에서 경로 해결하기(resolve 메소드)
 * const bookUrl = new Url('https://example.com/books/fantasy/chapter1.html');
 * const imageUrl = bookUrl.resolve('images/dragon.jpg');
 * console.log(imageUrl); // 'https://example.com/books/fantasy/images/dragon.jpg'
 *
 * // 상위 디렉토리로 이동하는 상대 경로
 * const chapterUrl = new Url('https://example.com/books/scifi/chapters/chapter3.html');
 * const coverUrl = chapterUrl.resolve('../cover.jpg');
 * console.log(coverUrl); // 'https://example.com/books/scifi/cover.jpg'
 */
class Url {
  constructor(urlString, baseString) {
    // Check if the URL is absolute (contains protocol)
    var absolute = urlString.indexOf("://") > -1;
    // Store initial pathname from urlString
    var pathname = urlString;
    var basePath;

    // Initialize class properties
    this.Url = undefined; // Will hold the native URL object if created
    this.href = urlString; // Store the original URL string
    this.protocol = ""; // Protocol portion (http:, https:, etc)
    this.origin = ""; // Origin (protocol + hostname + port)
    this.hash = ""; // URL fragment identifier
    this.hash = ""; // Duplicate declaration (likely a typo in original code)
    this.search = ""; // Query string portion of URL
    this.base = baseString; // Base URL for resolving relative URLs

    // If URL is not absolute and no base is explicitly provided, use current window location
    if (
      !absolute &&
      baseString !== false &&
      typeof baseString !== "string" &&
      window &&
      window.location
    ) {
      this.base = window.location.href;
    }

    // Process URL with native URL API if possible
    // URL Polyfill doesn't throw an error if base is empty
    if (absolute || this.base) {
      try {
        // Create native URL object using the browser's URL API
        if (this.base) {
          // Safari doesn't like an undefined base
          this.Url = new URL(urlString, this.base);
        } else {
          this.Url = new URL(urlString);
        }
        // Extract and store all URL parts from the native URL object
        this.href = this.Url.href; // Complete URL
        this.protocol = this.Url.protocol; // Protocol portion
        this.origin = this.Url.origin; // Origin portion
        this.hash = this.Url.hash; // Fragment identifier
        this.search = this.Url.search; // Query string

        // Combine pathname and search for Path object
        pathname = this.Url.pathname + (this.Url.search ? this.Url.search : "");
      } catch (e) {
        // If URL parsing fails, skip URL processing
        this.Url = undefined;
        // Try to resolve the pathname from the base instead
        if (this.base) {
          basePath = new Path(this.base);
          pathname = basePath.resolve(pathname);
        }
      }
    }

    // Create a Path object to handle pathname operations
    this.Path = new Path(pathname);

    // Extract path components from the Path object
    this.directory = this.Path.directory; // Directory portion of path
    this.filename = this.Path.filename; // Filename portion of path
    this.extension = this.Path.extension; // File extension
  }

  /**
   * Returns the Path object
   * @returns {Path} Path object representing the pathname
   * @example
   * const url = new Url('https://example.com/books/chapter1.html');
   * const pathObj = url.path();
   * console.log(pathObj.directory); // '/books'
   * console.log(pathObj.filename); // 'chapter1.html'
   */
  path() {
    return this.Path;
  }

  /**
   * Resolves a relative path to an absolute URL
   * @param {string} what - The relative path to resolve
   * @returns {string} Absolute URL
   * @example
   * // 기본 상대 경로 해석
   * const bookUrl = new Url('https://example.com/books/fantasy/chapter1.html');
   * const imageUrl = bookUrl.resolve('images/dragon.jpg');
   * console.log(imageUrl); // 'https://example.com/books/fantasy/images/dragon.jpg'
   *
   * // 상위 디렉토리로 이동하는 상대 경로
   * const chapterUrl = new Url('https://example.com/books/scifi/chapters/chapter3.html');
   * const coverUrl = chapterUrl.resolve('../cover.jpg');
   * console.log(coverUrl); // 'https://example.com/books/scifi/cover.jpg'
   *
   * // 루트 경로부터 시작하는 상대 경로
   * const pageUrl = new Url('https://example.com/ebooks/novel/page.html');
   * const rootImage = pageUrl.resolve('/images/logo.png');
   * console.log(rootImage); // 'https://example.com/images/logo.png'
   */
  resolve(what) {
    // Check if the path is already absolute
    var isAbsolute = what.indexOf("://") > -1;
    var fullpath;

    // Return as is if already absolute
    if (isAbsolute) {
      return what;
    }

    // Resolve the path relative to current directory
    fullpath = path.resolve(this.directory, what);
    // Combine with origin to create absolute URL
    return this.origin + fullpath;
  }

  /**
   * Calculates a path relative to the current URL
   * @param {string} what - The path to make relative
   * @returns {string} Relative path
   * @example
   * const baseUrl = new Url('https://example.com/books/scifi/');
   * const relativePath = baseUrl.relative('https://example.com/books/');
   * console.log(relativePath); // '..'
   *
   * const bookUrl = new Url('https://example.com/library/fiction/novel.html');
   * const imgPath = bookUrl.relative('https://example.com/library/images/');
   * console.log(imgPath); // '../images'
   */
  relative(what) {
    return path.relative(what, this.directory);
  }

  /**
   * Returns the string representation of the URL
   * @returns {string} Complete URL as string
   * @example
   * const url = new Url('https://example.com/path/to/file.html?query=123#fragment');
   * console.log(url.toString()); // 'https://example.com/path/to/file.html?query=123#fragment'
   *
   * const relativeUrl = new Url('../images/icon.png', 'https://example.com/books/');
   * console.log(relativeUrl.toString()); // 'https://example.com/images/icon.png'
   */
  toString() {
    return this.href;
  }
}

export default Url;
