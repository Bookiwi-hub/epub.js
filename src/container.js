import path from "path-webpack";
import { qs } from "./utils/core";

/**
 * EPUB 컨테이너 파일을 파싱하고 접근하는 핸들러 클래스
 * @class
 * @example
 * // EPUB 파일의 container.xml을 파싱하는 예시
 * const container = new Container(containerDocument);
 * console.log(container.packagePath); // "OPS/package.opf"
 * console.log(container.directory); // "OPS"
 * console.log(container.encoding); // "UTF-8"
 *
 * @param {document} [containerDocument] container.xml 문서
 * @property {string} packagePath - package.opf 파일의 경로
 * @property {string} directory - package.opf 파일이 위치한 디렉토리
 * @property {string} encoding - container.xml의 인코딩
 */
class Container {
  constructor(containerDocument) {
    this.packagePath = "";
    this.directory = "";
    this.encoding = "";

    if (containerDocument) {
      this.parse(containerDocument);
    }
  }

  /**
   * Container XML 문서를 파싱하여 필요한 정보를 추출
   * @param  {document} containerDocument container.xml 문서
   * @example
   * // container.xml 문서 파싱 예시
   * const container = new Container();
   * container.parse(containerDocument);
   * // 결과:
   * // - packagePath: "OPS/package.opf"
   * // - directory: "OPS"
   * // - encoding: "UTF-8"
   * @throws {Error} 컨테이너 파일을 찾을 수 없을 때 발생
   * @throws {Error} RootFile을 찾을 수 없을 때 발생
   */
  parse(containerDocument) {
    //-- <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
    var rootfile;

    if (!containerDocument) {
      throw new Error("Container File Not Found");
    }

    rootfile = qs(containerDocument, "rootfile");

    if (!rootfile) {
      throw new Error("No RootFile Found");
    }

    this.packagePath = rootfile.getAttribute("full-path");
    this.directory = path.dirname(this.packagePath);
    this.encoding = containerDocument.xmlEncoding;
  }

  /**
   * Container 객체의 모든 속성을 초기화
   * @example
   * // Container 객체 초기화 예시
   * container.destroy();
   * // 결과:
   * // - packagePath: undefined
   * // - directory: undefined
   * // - encoding: undefined
   */
  destroy() {
    this.packagePath = undefined;
    this.directory = undefined;
    this.encoding = undefined;
  }
}

export default Container;
