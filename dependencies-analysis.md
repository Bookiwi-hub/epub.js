# package.json 분석

## 개발 의존성 (devDependencies)

### Babel 관련 패키지

- **@babel/cli (^7.15.7)**: Babel 명령줄 인터페이스, JavaScript 코드를 트랜스파일하기 위한 도구
- **@babel/core (^7.15.8)**: Babel의 핵심 기능을 제공하는 패키지
- **@babel/plugin-proposal-export-default-from (^7.14.5)**: export default from 문법 지원 플러그인
- **@babel/plugin-proposal-export-namespace-from (^7.14.5)**: export \* as namespace from 문법 지원 플러그인
- **@babel/preset-env (^7.15.8)**: 타겟 환경에 맞게 JavaScript를 자동 변환해주는 프리셋
- **@babel/runtime (^7.15.4)**: Babel 헬퍼 함수 런타임 지원
- **babel-loader (^8.2.3)**: Webpack과 Babel 연동을 위한 로더

### 문서화 도구

- **documentation (^13.2.5)**: JavaScript 코드에서 API 문서를 자동으로 생성하는 도구
- **jsdoc (^3.6.7)**: JavaScript 소스 코드에서 API 문서를 생성하는 도구
- **tsd-jsdoc (^2.5.0)**: JSDoc 주석에서 TypeScript 정의 파일을 생성하는 도구

### 코드 품질 및 테스트

- **eslint (^8.0.1)**: JavaScript 코드 품질 검사 도구
- **karma (^5.0.9)**: JavaScript 브라우저 환경 테스트 실행기
- **karma-chrome-launcher (^3.1.0)**: Karma에서 Chrome 브라우저 실행 지원
- **karma-mocha (^2.0.1)**: Karma에서 Mocha 테스트 프레임워크 통합
- **karma-mocha-reporter (^2.2.5)**: Mocha 스타일 테스트 결과 리포터
- **karma-phantomjs-launcher (^1.0.4)**: PhantomJS 브라우저에서 테스트 실행
- **karma-sourcemap-loader (^0.3.7)**: 소스맵 로딩 지원
- **karma-webpack (^4.0.2)**: Webpack으로 번들링된 코드 테스트 지원
- **mocha (^7.2.0)**: JavaScript 테스트 프레임워크
- **mocha-loader (^5.0.0)**: Webpack에서 Mocha 테스트 로딩

### 빌드 도구

- **raw-loader (^4.0.2)**: 텍스트 파일을 문자열로 임포트하기 위한 Webpack 로더
- **terser-webpack-plugin (^3.0.3)**: JavaScript 코드 압축 및 최적화 플러그인
- **webpack (^4.43.0)**: JavaScript 애플리케이션 모듈 번들러
- **webpack-cli (^3.3.11)**: Webpack 명령줄 인터페이스
- **webpack-dev-middleware (^3.7.2)**: Webpack 개발 미들웨어
- **webpack-dev-server (^3.11.0)**: Webpack 개발 서버

## 런타임 의존성 (dependencies)

### 타입 지원

- **@types/localforage (0.0.34)**: localforage 라이브러리의 TypeScript 타입 정의

### XML 처리

- **@xmldom/xmldom (^0.7.5)**: 브라우저와 Node.js에서 사용할 수 있는 XML DOM 구현체

### 핵심 기능

- **core-js (^3.18.3)**: JavaScript 폴리필 라이브러리, 최신 기능을 구형 브라우저에서 사용 가능하게 함
- **event-emitter (^0.3.5)**: 이벤트 발행/구독 패턴 구현 라이브러리
- **jszip (^3.7.1)**: JavaScript에서 ZIP 파일 생성 및 읽기 라이브러리 (EPUB 파일이 ZIP 형식 기반이므로 필수)
- **localforage (^1.10.0)**: 오프라인 저장소를 추상화한 라이브러리, IndexedDB, WebSQL, localStorage 백엔드 지원
- **lodash (^4.17.21)**: 유틸리티 함수 모음, 배열/객체/문자열 등 데이터 조작에 유용
- **marks-pane (^1.0.9)**: 터치와 마우스 이벤트 관리 라이브러리, 전자책 페이지 넘김 등에 사용
- **path-webpack (0.0.3)**: Node.js의 path 모듈을 Webpack에서 사용할 수 있게 해주는 패키지, EPUB.js에서는 전자책의 내부 파일 경로를 처리할 때 이 패키지를 사용합니다. EPUB 파일은 ZIP 아카이브이며 내부에 여러 HTML, CSS, 이미지 파일이 포함되어 있음, 이 파일들 간의 상대 경로와 절대 경로를 올바르게 처리하기 위해 path 기능이 필요.
