# 📖 epub.js Deep Dive Sprint

[epub.js](https://github.com/futurepress/epub.js)

## 🏃‍♂️DeepDive.start("epub.js",2025.03.16");

## 🛠️ 문제 상황

이북 리더기를 개발하기 위해 epub.js라는 라이브러리를 선택.  
그러나 해당 라이브러리의 활용하는데 어려움을 겪고 있다.

- epub.js의 복잡한 구조 때문에 사용이 쉽지 않다.
- epub이 어떻게 렌더링 되고 관리되는지 이해하지 못하기 때문에 어플리케이션에 맞게 커스텀하기 힘들다.

이북 리더기를 개발하는데 있어서, **핵심이 되는 epub 핸들링을 잘 이해하지 못하면 곤란하다.**

## 💡 해결 아이디어

**"epub.js 라이브러리를 뜯어보는 "epub.js Deep Dive Sprint"를 진행.**

## 🎯 목표

### 스프린트 목표

- **epub.js 활용한 이북 리더기 개발 역량 확보**
  - epub.js를 분석하여 이해한다.
  - 어떤 기능이 있고 어떻게 구현했는지 파악하여 이북 리더기 개발에 활용하고 커스텀할 수 있게 한다.
- **epub 파일 핸들링을 이해한다.**
  - epub 파일을 js로 다루는 법을 배워 차후 자체 epub 라이브러리 제작을 도모한다.

### 커리어 목표

- 우수한 개발자의 코드 분석을 통해 실력을 향상한다.

- 자바스크립트 실력 향상

  - 자바스크립트 라이브러리를 공부하며 해당 언어 실력을 키운다.

- 기존 프로젝트의 코드 리딩 및 분석 역량을 키운다.

  - 다양한 코드베이스를 빠르게 파악하고, 협업 및 코드 리뷰 능력을 성장시킨다.

- 이력서에 어필할 수 있는 경험을 쌓는다.

  - 레포지토리 분석 경험을 포트폴리오에 추가
  - 코드 리딩 및 분석 능력 강화
  - 레거시 코드 적응력 향상
  - 학습 열정과 능력 강조

## 🔍 How to deep dive

### [분석](#레포-분석)

레포지토리의 폴더, 파일, 코드의 역할을 분석하고 정리한다.

### [활용](#활용-방안)

- 프로젝트에 사용 가능한 부분과 커스텀 할 수 있는 부분을 정리한다.

## 🚀 레포 분석

### 루트 디렉토리

│── 📂 [src](./src/index.md) # 소스 코드 디렉토리(주요 라이브러리 코드) 분석  
│── 📂 [examples](./examples/index.md) # 라이브러리 사용 예제 모음 폴더 분석  
│── 📂 test # 테스트 코드 및 테스트 관련 파일  
│── 📂 types # TypeScript 타입 정의 파일  
│── 📂 [documentation](./documentation/md/API.md) # API 문서 분석  
│── 📄 .travis.yml # Travis CI 설정 파일 (지속적 통합)  
│── 📄 [package.json](./dependencies-analysis.md) # 의존성 목록 분석

### 핵심 클래스 분석

```
Book: EPUB 파일의 파싱 및 관리를 담당하는 핵심 클래스
├── Spine: 책의 섹션 순서와 구조를 정의
├── Locations: 페이지 위치 및 퍼센트 계산 관리
├── Navigation: 목차 및 내비게이션 기능 관리
├── PageList
├── Resources
├── Container
├── Packaging
└── Rendition: 실제 화면에 도서를 렌더링하는 클래스
    ├── Themes: 스타일 및 테마 적용을 담당
    ├── Annotations: 주석 및 하이라이트 관리
    ├── EpubCFI: EPUB 문서 내 위치를 고유하게 식별하는 CFI 처리
    ├── ViewManager (Default/Continuous)
    │   └── View (Iframe)
    └── Contents: EPUB 내용의 실제 콘텐츠 처리와 DOM 조작을 담당
```

## 🔑 활용 방안

### 커스터마이징 포인트

#### 1. 뷰 매니저 확장

`src/managers` 디렉토리의 코드를 분석하여 기존 뷰 매니저(default, continuous)를 확장하거나 새로운 뷰 매니저를 구현할 수 있습니다:

```javascript
// 커스텀 매니저 생성 예시
class CustomManager extends DefaultViewManager {
  // 오버라이드 및 확장
}

// 사용
book.renderTo("viewer", {
  manager: "custom",
  managers: {
    custom: CustomManager,
  },
});
```

#### 2. 훅(Hook) 시스템 활용

다양한 이벤트 지점에 훅을 등록하여 렌더링 과정을 확장할 수 있습니다:

```javascript
// 콘텐츠 처리 훅
rendition.hooks.content.register(function (contents) {
  // HTML 콘텐츠 수정 및 확장
  let elements = contents.document.querySelectorAll("p");
  // 처리 로직...
});

// 렌더링 훅
rendition.hooks.render.register(function (contents, view) {
  // 렌더링 단계 확장
});
```

#### 3. 주석 및 하이라이트 시스템 확장

`src/annotations.js` 분석을 통해 주석 시스템을 확장하여 사용자 정의 주석 기능을 구현할 수 있습니다:

```javascript
// 주석 추가
rendition.annotations.add(cfi, {
  type: "highlight",
  data: { note: "사용자 노트" },
  styles: { background: "yellow" },
});

// 주석 이벤트 리스닝
rendition.annotations.on("add", function (annotation) {
  // 주석 추가 시 처리
});
```

#### 4. 테마 및 스타일 커스터마이징

`src/themes.js`를 분석하여 사용자 정의 테마 등록 및 적용이 가능합니다:

```javascript
// 테마 등록
rendition.themes.register("dark", {
  body: {
    background: "#000",
    color: "#fff",
  },
});

// 테마 적용
rendition.themes.select("dark");
```

- CI/CD 툴로 travis를 활용하는 걸 고려한다.
