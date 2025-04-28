# Rendition 클래스

Rendition 클래스는 EPUB 콘텐츠를 렌더링하고 표시하는 핵심 구성 요소입니다. 각 섹션에 대한 뷰 시리즈로 EPUB을 표시합니다.

## 생성자

```js
// 기본 설정으로 렌더링
const rendition = new Rendition(book);

// 커스텀 설정으로 렌더링
const rendition = new Rendition(book, {
  width: 800, // 뷰포트 너비
  height: 600, // 뷰포트 높이
  ignoreClass: "footnote", // CFI 파서가 무시할 클래스
  manager: "continuous", // 연속 스크롤 뷰 매니저 사용
  view: "iframe", // iframe 뷰 사용
  flow: "scrolled", // 스크롤 흐름 설정
  layout: "reflowable", // 리플로어블 레이아웃
  spread: "auto", // 자동 스프레드 모드
  minSpreadWidth: 800, // 스프레드 최소 너비
  stylesheet: "custom.css", // 커스텀 스타일시트
  resizeOnOrientationChange: true, // 방향 변경 시 크기 조정
  script: "custom.js", // 커스텀 스크립트
  snap: { snap: true, snapWidth: 100 }, // 스냅 스크롤링 설정
  defaultDirection: "rtl", // 오른쪽에서 왼쪽 텍스트 방향
  allowScriptedContent: true, // 스크립트 실행 허용
  allowPopups: false, // 팝업 차단
});
```

### 매개변수

- **book** (Book): 표시할 Book 객체
- **options** (Object): 옵션 객체
  - **width** (Number): 렌더링 너비 (예: 800, 1024)
  - **height** (Number): 렌더링 높이 (예: 600, 768)
  - **ignoreClass** (String): CFI 파서가 무시할 클래스 (예: "footnote", "annotation, sidebar")
  - **manager** (String | Function | Object): 사용할 뷰 매니저
    - 'default': 기본 페이지 단위 뷰
    - 'continuous': 연속 스크롤 뷰
    - CustomManager: 커스텀 매니저 클래스
  - **view** (String | Function): 사용할 뷰
    - 'iframe': 기본 iframe 뷰
    - CustomView: 커스텀 뷰 클래스
  - **layout** (String): 강제 레이아웃
    - 'reflowable': 리플로어블 레이아웃
    - 'pre-paginated': 고정 레이아웃
  - **spread** (String): 강제 스프레드 값
    - 'none': 스프레드 비활성화
    - 'auto': 자동 스프레드
    - 'landscape': 가로 방향 스프레드
  - **minSpreadWidth** (Number): 스프레드를 사용할 최소 너비 (예: 800, 1024)
  - **stylesheet** (String): 주입할 스타일시트 URL (예: "styles/custom.css")
  - **resizeOnOrientationChange** (Boolean): 방향 변경 이벤트 활성화/비활성화
    - true: 방향 변경 시 크기 자동 조정
    - false: 방향 변경 시 크기 고정
  - **script** (String): 주입할 스크립트 URL (예: "scripts/custom.js")
  - **snap** (Boolean | Object): 스냅 스크롤링 사용
    - true: 기본 스냅 스크롤링
    - { snap: true, snapWidth: 100 }: 커스텀 스냅 설정
  - **defaultDirection** (String): 기본 텍스트 방향
    - 'ltr': 왼쪽에서 오른쪽
    - 'rtl': 오른쪽에서 왼쪽
  - **allowScriptedContent** (Boolean): 콘텐츠의 스크립트 실행 활성화
    - true: 스크립트 실행 허용
    - false: 스크립트 실행 차단
  - **allowPopups** (Boolean): 콘텐츠의 팝업 열기 활성화
    - true: 팝업 허용
    - false: 팝업 차단

## 이벤트

Rendition 클래스는 다음과 같은 이벤트를 발생시킵니다:

- **started**: 렌더링이 시작되었을 때
- **attached**: 렌더링이 DOM 요소에 연결되었을 때
- **displayed**: 섹션이 표시되었을 때
- **displayError**: 표시 중 오류가 발생했을 때
- **rendered**: 섹션이 렌더링되었을 때
- **removed**: 섹션이 제거되었을 때
- **resized**: 렌더링이 크기 조정되었을 때
- **orientationchange**: 렌더링이 회전되었을 때
- **locationChanged**: 위치가 변경되었을 때
- **relocated**: 위치가 재배치되었을 때
- **selected**: 텍스트 선택이 발생했을 때
- **markClicked**: 마크가 클릭되었을 때

## 핵심 메소드

### display(target)

책의 특정 위치를 표시합니다.

```js
// CFI로 표시
rendition
  .display("epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)")
  .then((section) => {
    console.log("위치가 표시되었습니다.");
    // 결과: { index: 0, href: 'chapter1.html', ... }
  });

// URL로 표시
rendition.display("chapter1.html").then((section) => {
  console.log("위치가 표시되었습니다.");
  // 결과: { index: 0, href: 'chapter1.html', ... }
});

// 책의 특정 퍼센트 위치로 표시
rendition.display(0.5).then((section) => {
  console.log("책의 중간 지점이 표시되었습니다.");
  // 결과: { index: 2, href: 'chapter3.html', ... }
});
```

### resize(width, height, epubcfi)

뷰의 크기를 조정합니다.

```js
// 크기만 조정
rendition.resize(800, 600);
// 결과: 뷰포트 크기가 800x600으로 변경됨

// 크기 조정 및 특정 위치 표시
rendition.resize(800, 600, "epubcfi(/6/4[chap01ref]!/4[body01])");
// 결과: 뷰포트 크기가 800x600으로 변경되고 지정된 위치가 표시됨
```

### next()

렌더링의 다음 "페이지"로 이동합니다.

```js
rendition.next().then(() => {
  console.log("다음 페이지로 이동했습니다.");
  // 결과: 현재 페이지에서 다음 페이지로 이동
  // 예: 페이지 1 -> 페이지 2
});
```

### prev()

렌더링의 이전 "페이지"로 이동합니다.

```js
rendition.prev().then(() => {
  console.log("이전 페이지로 이동했습니다.");
  // 결과: 현재 페이지에서 이전 페이지로 이동
  // 예: 페이지 2 -> 페이지 1
});
```

### flow(flow)

렌더링의 흐름을 페이지화 또는 스크롤로 조정합니다.

```js
rendition.flow("paginated"); // 페이지화된 보기
// 결과: 콘텐츠가 페이지 단위로 표시됨

rendition.flow("scrolled"); // 스크롤 보기
// 결과: 콘텐츠가 연속적으로 스크롤 가능한 형태로 표시됨
```

### layout(settings)

렌더링의 레이아웃을 조정합니다.

```js
rendition.layout({
  layout: "reflowable", // 리플로어블 레이아웃
  spread: "auto", // 자동 스프레드
  orientation: "auto", // 자동 방향
});
// 결과: 새로운 레이아웃 설정이 적용됨
```

### spread(spread, min)

렌더링의 스프레드 사용 여부를 조정합니다.

```js
rendition.spread("auto", 800);
// 결과: 화면 너비가 800px 이상일 때 스프레드 보기로 변경
```

### currentLocation()

현재 위치 객체를 가져옵니다.

```js
const location = rendition.currentLocation();
location.then((loc) => {
  console.log("현재 위치:", loc);
  // 결과 예시:
  // {
  //   start: {
  //     index: 0,
  //     href: 'chapter1.html',
  //     cfi: 'epubcfi(/6/4[chap01ref])',
  //     displayed: { page: 1, total: 5 }
  //   },
  //   end: {
  //     index: 0,
  //     href: 'chapter1.html',
  //     cfi: 'epubcfi(/6/4[chap01ref]!/4[body01])',
  //     displayed: { page: 1, total: 5 }
  //   }
  // }
});
```

### getRange(cfi, ignoreClass)

표시된 CFI로부터 범위를 가져옵니다.

```js
const range = rendition.getRange(
  "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05])"
);
// 결과: Range { startContainer: Node, startOffset: 0, ... }
```

### getContents()

렌더링된 각 뷰의 Contents 객체를 가져옵니다.

```js
const contents = rendition.getContents();
contents.forEach((content) => {
  console.log("콘텐츠:", content);
  // 결과: [Contents { window: Window, content: HTMLElement, ... }, ...]
});
```

### views()

매니저로부터 뷰 멤버를 가져옵니다.

```js
const views = rendition.views();
views.forEach((view) => {
  console.log("뷰:", view);
  // 결과: [View { element: HTMLElement, ... }, ...]
});
```

## 기타 메소드

### setManager(manager)

뷰 매니저를 설정합니다.

```js
const customManager = new CustomViewManager();
rendition.setManager(customManager);
// 결과: 새로운 뷰 매니저가 적용됨
```

### requireManager(manager)

매니저를 문자열이나 클래스 함수로부터 로드합니다.

```js
const defaultManager = rendition.requireManager("default");
// 결과: DefaultViewManager 인스턴스

const customManager = rendition.requireManager(CustomManager);
// 결과: CustomManager 인스턴스
```

### requireView(view)

뷰를 문자열이나 클래스 함수로부터 로드합니다.

```js
const iframeView = rendition.requireView("iframe");
// 결과: IframeView 인스턴스

const customView = rendition.requireView(CustomView);
// 결과: CustomView 인스턴스
```

### start()

렌더링을 시작합니다.

```js
rendition.start().then(() => {
  console.log("렌더링이 시작되었습니다.");
  // 결과: 렌더링이 초기화되고 준비됨
});
```

### attachTo(element)

DOM 요소에 렌더링 컨테이너를 연결합니다.

```js
const container = document.getElementById("viewer");
rendition.attachTo(container).then(() => {
  console.log("렌더링 컨테이너가 연결되었습니다.");
  // 결과: EPUB 콘텐츠가 지정된 컨테이너에 표시됨
});
```

### moveTo(offset)

렌더링을 특정 오프셋으로 이동합니다.

```js
rendition.moveTo({ x: 100, y: 200 });
// 결과: 뷰포트가 지정된 좌표로 이동
```

### clear()

모든 렌더링된 뷰를 지웁니다.

```js
rendition.clear();
// 결과: 모든 렌더링된 뷰가 제거됨
```

### direction(dir)

렌더링의 텍스트 방향을 조정합니다.

```js
rendition.direction("rtl"); // 오른쪽에서 왼쪽으로
// 결과: 텍스트가 오른쪽에서 왼쪽으로 표시됨
```

### reportLocation()

현재 위치를 보고합니다.

```js
rendition.reportLocation();
// 결과: 현재 위치 정보가 이벤트로 발생됨
```

### destroy()

렌더링을 제거하고 정리합니다.

```js
rendition.destroy();
// 결과: 모든 리소스가 해제되고 이벤트 리스너가 제거됨
```
