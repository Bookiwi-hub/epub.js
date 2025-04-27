import path from "path-webpack";

/**
 * Creates a Path object for parsing and manipulation of a path strings
 *
 * Uses a polyfill for Nodejs path: https://nodejs.org/api/path.html
 * @param	{string} pathString	a url string (relative or absolute)
 * @class
 * @example
 * // 파일 URL로부터 Path 생성
 * const filePath = new Path("https://example.com/path/to/file.epub");
 * console.log(filePath.path); // "/path/to/file.epub"
 * console.log(filePath.directory); // "/path/to/"
 * console.log(filePath.filename); // "file.epub"
 * console.log(filePath.extension); // "epub"
 *
 * // 상대 경로로부터 Path 생성
 * const relativePath = new Path("path/to/file.epub");
 * console.log(relativePath.path); // "path/to/file.epub"
 * console.log(relativePath.directory); // "path/to/"
 * console.log(relativePath.filename); // "file.epub"
 * console.log(relativePath.extension); // "epub"
 *
 * // 절대 경로로부터 Path 생성
 * const absolutePath = new Path("/path/to/file.epub");
 * console.log(absolutePath.path); // "/path/to/file.epub"
 * console.log(absolutePath.directory); // "/path/to/"
 * console.log(absolutePath.filename); // "file.epub"
 * console.log(absolutePath.extension); // "epub"
 *
 * // 디렉토리 경로로부터 Path 생성
 * const directoryPath = new Path("/path/to/directory/");
 * console.log(directoryPath.path); // "/path/to/directory/"
 * console.log(directoryPath.directory); // "/path/to/directory/"
 * console.log(directoryPath.filename); // ""
 * console.log(directoryPath.extension); // ""
 */
class Path {
  constructor(pathString) {
    var protocol;
    var parsed;

    protocol = pathString.indexOf("://");
    if (protocol > -1) {
      pathString = new URL(pathString).pathname;
    }

    parsed = this.parse(pathString);

    this.path = pathString;

    if (this.isDirectory(pathString)) {
      this.directory = pathString;
    } else {
      this.directory = parsed.dir + "/";
    }

    this.filename = parsed.base;
    this.extension = parsed.ext.slice(1);
  }

  /**
   * Parse the path: https://nodejs.org/api/path.html#path_path_parse_path
   * @param	{string} what
   * @returns {object}
   * @example
   * const pathObj = new Path("/path/to/file.epub");
   *
   * // 경로 문자열을 분석하여 각 구성 요소를 포함한 객체 반환
   * const parsed = pathObj.parse("/another/path/book.epub");
   * console.log(parsed);
   * // 결과: {
   * //   root: '/',           // 루트 디렉토리
   * //   dir: '/another/path', // 디렉토리 경로
   * //   base: 'book.epub',    // 파일명 (확장자 포함)
   * //   ext: '.epub',         // 확장자 (점 포함)
   * //   name: 'book'          // 파일명 (확장자 제외)
   * // }
   *
   * // 윈도우 경로 예시
   * const windowsParsed = pathObj.parse("C:\\Users\\username\\Documents\\book.epub");
   * console.log(windowsParsed);
   * // 결과: {
   * //   root: 'C:\\',
   * //   dir: 'C:\\Users\\username\\Documents',
   * //   base: 'book.epub',
   * //   ext: '.epub',
   * //   name: 'book'
   * // }
   */
  parse(what) {
    return path.parse(what);
  }

  /**
   * @param	{string} what
   * @returns {boolean}
   * @example
   * const pathObj = new Path("/path/to/file.epub");
   *
   * // 현재 Path 객체의 경로가 절대 경로인지 확인
   * const isCurrentPathAbsolute = pathObj.isAbsolute();
   * console.log(isCurrentPathAbsolute); // 결과: true (경로가 '/'로 시작하기 때문)
   *
   * // 다른 경로가 절대 경로인지 확인
   * const isOtherPathAbsolute1 = pathObj.isAbsolute("chapter/content.html");
   * console.log(isOtherPathAbsolute1); // 결과: false (상대 경로이기 때문)
   *
   * const isOtherPathAbsolute2 = pathObj.isAbsolute("/absolute/path/file.txt");
   * console.log(isOtherPathAbsolute2); // 결과: true (경로가 '/'로 시작하기 때문)
   *
   * // 윈도우 시스템에서 절대 경로 확인
   * const isWindowsPathAbsolute = pathObj.isAbsolute("C:\\Users\\username\\Documents\\file.txt");
   * console.log(isWindowsPathAbsolute); // 결과: true (드라이브 문자로 시작하는 경로)
   */
  isAbsolute(what) {
    return path.isAbsolute(what || this.path);
  }

  /**
   * Check if path ends with a directory
   * @param	{string} what
   * @returns {boolean}
   * @example
   * const pathObj = new Path("/path/to/directory/");
   *
   * // 디렉토리 경로인지 확인 (끝에 '/'가 있는지 확인)
   * const isDir1 = pathObj.isDirectory("/another/directory/");
   * console.log(isDir1); // 결과: true (경로가 '/'로 끝나기 때문)
   *
   * const isDir2 = pathObj.isDirectory("/path/to/file.epub");
   * console.log(isDir2); // 결과: false (경로가 '/'로 끝나지 않기 때문)
   *
   * // 빈 디렉토리 경로도 디렉토리로 인식
   * const isDir3 = pathObj.isDirectory("/");
   * console.log(isDir3); // 결과: true
   *
   * // 상대 경로도 확인 가능
   * const isDir4 = pathObj.isDirectory("relative/path/");
   * console.log(isDir4); // 결과: true
   */
  isDirectory(what) {
    return what.charAt(what.length - 1) === "/";
  }

  /**
   * Resolve a path against the directory of the Path
   *
   * https://nodejs.org/api/path.html#path_path_resolve_paths
   * @param	{string} what
   * @returns {string} resolved
   * @example
   * const pathObj = new Path("/books/fantasy/");
   *
   * // 상대 경로를 Path 객체의 디렉토리를 기준으로 절대 경로로 변환
   * const resolvedPath1 = pathObj.resolve("tolkien/lotr.epub");
   * console.log(resolvedPath1); // 결과: "/books/fantasy/tolkien/lotr.epub"
   *
   * // '..'를 사용하여 상위 디렉토리로 이동
   * const resolvedPath2 = pathObj.resolve("../science/fiction.epub");
   * console.log(resolvedPath2); // 결과: "/books/science/fiction.epub"
   *
   * // '.'를 사용하여 현재 디렉토리 참조
   * const resolvedPath3 = pathObj.resolve("./rowling/hp.epub");
   * console.log(resolvedPath3); // 결과: "/books/fantasy/rowling/hp.epub"
   *
   * // 절대 경로가 주어진 경우, 그 경로를 반환
   * const resolvedPath4 = pathObj.resolve("/absolute/path/book.epub");
   * console.log(resolvedPath4); // 결과: "/absolute/path/book.epub"
   */
  resolve(what) {
    return path.resolve(this.directory, what);
  }

  /**
   * Resolve a path relative to the directory of the Path
   *
   * https://nodejs.org/api/path.html#path_path_relative_from_to
   * @param	{string} what
   * @returns {string} relative
   * @example
   * const pathObj = new Path("/books/fantasy/");
   *
   * // 절대 URL이 주어진 경우, URL을 그대로 반환
   * const absoluteUrl = pathObj.relative("https://example.com/books/history.epub");
   * console.log(absoluteUrl); // 결과: "https://example.com/books/history.epub"
   *
   * // 경로가 주어진 경우, Path 객체의 디렉토리를 기준으로 상대 경로 반환
   * const relativePath1 = pathObj.relative("/books/fantasy/tolkien/hobbit.epub");
   * console.log(relativePath1); // 결과: "tolkien/hobbit.epub"
   *
   * // 다른 디렉토리에 있는 파일의 상대 경로
   * const relativePath2 = pathObj.relative("/books/science/fiction/dune.epub");
   * console.log(relativePath2); // 결과: "../../science/fiction/dune.epub"
   *
   * // 같은 디렉토리의 파일
   * const relativePath3 = pathObj.relative("/books/fantasy/index.html");
   * console.log(relativePath3); // 결과: "index.html"
   */
  relative(what) {
    var isAbsolute = what && what.indexOf("://") > -1;

    if (isAbsolute) {
      return what;
    }

    return path.relative(this.directory, what);
  }

  /**
   * Split a path into its components
   * @param {string} filename - The path to split
   * @returns {Array} - Array containing path components
   * @example
   * const pathObj = new Path("/path/to/file.epub");
   *
   * // 경로를 구성 요소로 분리
   * const parts = pathObj.splitPath("/books/fantasy/tolkien/lotr.epub");
   * console.log(parts);
   * // 결과: 경로의 각 부분을 포함하는 배열
   * // 예시 결과: ["/books", "fantasy", "tolkien", "lotr.epub"]
   *
   * // 절대 경로 분리
   * const absoluteParts = pathObj.splitPath("/absolute/path/to/file.txt");
   * console.log(absoluteParts);
   * // 예시 결과: ["/absolute", "path", "to", "file.txt"]
   *
   * // 상대 경로 분리
   * const relativeParts = pathObj.splitPath("relative/path/file.jpg");
   * console.log(relativeParts);
   * // 예시 결과: ["relative", "path", "file.jpg"]
   */
  splitPath(filename) {
    return this.splitPathRe.exec(filename).slice(1);
  }

  /**
   * Return the path string
   * @returns {string} path
   * @example
   * // 파일 경로로 Path 객체 생성
   * const pathObj1 = new Path("/books/fantasy/tolkien/lotr.epub");
   * const pathString1 = pathObj1.toString();
   * console.log(pathString1); // 결과: "/books/fantasy/tolkien/lotr.epub"
   *
   * // URL로 Path 객체 생성
   * const pathObj2 = new Path("https://example.com/books/history.epub");
   * const pathString2 = pathObj2.toString();
   * console.log(pathString2); // 결과: "/books/history.epub"
   *
   * // 디렉토리 경로로 Path 객체 생성
   * const pathObj3 = new Path("/documents/reports/");
   * const pathString3 = pathObj3.toString();
   * console.log(pathString3); // 결과: "/documents/reports/"
   *
   * // 상대 경로로 Path 객체 생성
   * const pathObj4 = new Path("../images/photo.jpg");
   * const pathString4 = pathObj4.toString();
   * console.log(pathString4); // 결과: "../images/photo.jpg"
   */
  toString() {
    return this.path;
  }
}

export default Path;
