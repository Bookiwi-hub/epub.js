# Book 객체

## 역할

epub 파일을 파싱하여 정볼르 뽑아낸다.

## 핵심 프로퍼티

### ready

책이 로딩 상태를 가지고 있는 프라미스 객체. 전부 로드되면 fulfilled가 된다.

책이 전부 로드된 후에 로직 처리를 할 수 있다.

예시

```ts
const book = new Book("/Alice's Adventures in Wonderland.epub");

book.ready.then(() => {});
```

### loaded

책 정보를 가진 객체

```js
{
  manifest: Promise,    // 매니페스트 파일
  spine: Promise,       // 스파인 관리 객체
  metadata: Promise,    // 메타데이터
  cover: Promise,       // 커버 이미지 경로
  navigation: Promise,  // 목차 관리하는 객체
  pageList: Promise,    // 페이지 정보를 관리하는 객체
  resources: Promise,   // 리소스들
  displayOptions: Promise // 디스플레이 옵션
}

```

```js
async function loadBook() {
  const book = new Book("/path/to/book.epub");

  try {
    // 개별 리소스 접근
    const manifest = await book.loaded.manifest;
    const spine = await book.loaded.spine;
    const metadata = await book.loaded.metadata;
    const coverPath = await book.loaded.cover;
    const navigation = await book.loaded.navigation;
    const pageList = await book.loaded.pageList;
    const resources = await book.loaded.resources;
    const displayOptions = await book.loaded.displayOptions;

    console.log("책 정보:", {
      title: metadata.title,
      author: metadata.creator,
      cover: coverPath,
      toc: navigation.toc,
    });
  } catch (error) {
    console.error("책 로딩 중 오류 발생:", error);
  }
}
```

### rendition

책의 렌더링을 관리하는 Rendition 객체. `renderTo` 메소드를 호출하면 생성됩니다.

[Rendition](./Rendition.md)

**예시:**

```javascript
// 렌더링 객체 생성
const rendition = book.renderTo(element);

// 페이지 이동
rendition.display(5); // 5페이지로 이동
rendition.next(); // 다음 페이지
rendition.prev(); // 이전 페이지
```

## 핵심 메소드

### renderTo(element, options): Rendition

EPUB 책을 HTML element 내부에 EPUB 뷰어가 렌더링하는 메소드입니다.

**파라미터:**

- `element`: 렌더링할 HTML 요소 또는 CSS 선택자
- `options`: 렌더링 옵션 객체 (선택사항)
  - `width`: 뷰어 너비 (예: '100%', '800px')
  - `height`: 뷰어 높이
  - `spread`: 페이지 스프레드 설정 ('none', 'auto', 'always')
  - `flow`: 페이지 흐름 모드 ('paginated', 'scrolled')
  - `theme`: 테마 설정 ('light', 'dark', 'sepia')
  - `fontSize`: 글자 크기
  - `fontFamily`: 글꼴

**예시:**

```javascript
// 기본 렌더링
const element = document.getElementById("viewer");
const rendition = book.renderTo(element);

// 옵션을 사용한 렌더링
const options = {
  width: "100%",
  height: "600px",
  spread: "auto",
  theme: "dark",
  fontSize: "16px",
};
book.renderTo(element, options);

// CSS 선택자 사용
book.renderTo("#viewer", options);
```

### getRange(cfiRange): Promise<Range>

CFI(Canonical Fragment Identifier) 범위에 해당하는 DOM Range 객체를 반환합니다.

**파라미터:**

- `cfiRange`: EPUB CFI 문자열

**예시:**

```javascript
// 텍스트 하이라이트
const cfi = "epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3[2]";
book.getRange(cfi).then((range) => {
  const highlight = document.createElement("span");
  highlight.className = "highlight";
  range.surroundContents(highlight);
});

// 주석 추가
book.getRange(cfi).then((range) => {
  const note = document.createElement("div");
  note.className = "annotation";
  note.textContent = "주석 내용";
  range.insertNode(note);
});
```

### destroy()

책과 관련된 모든 객체를 파괴

### key(identifier): string

책의 고유 식별자를 생성합니다. 로컬 스토리지나 캐싱에 사용됩니다.

**파라미터:**

- `identifier`: 사용자 정의 식별자 (선택사항)

identifier을 넣어주지 않으면 metadata.identifier를 사용해서 생성 -> 동일한 EPUB는 항상 동일한 키를 반환

**예시:**

```javascript
// 기본 키 생성
const bookKey = book.key();
// 결과: `epubjs:0.3.93:${packaging.metadata.identifier}`

// 사용자 정의 식별자 사용
const customKey = book.key("my-custom-id");
// 결과: "epubjs:0.3.93:my-custom-id"

// 로컬 스토리지에 저장
localStorage.setItem(book.key());
```

## 고려사항

url에는 바이너리 파일 즉 blob만 넣도록 통일하면 좋을 것 같다. "https://s3.amazonaws.com/epubjs/books/moby-dick/OPS/package.opf" 이런 식으로 url을 넣으면 epubjs 내부에서 http 통신을 하고 blob으로 변환한다. 에러 처리와 로딩처리를 원할하게 하기 위해 파일 받아오기와 변환은 직접 하도록 하자.

```js
book = new Book(`${url}`);
```

## 전체 프로퍼티 & 메소드

### 프로퍼티 목록 (Properties)

1. `settings` - Book 객체의 설정을 저장하는 객체
2. `opening` - 책이 열리는 과정을 추적하는 defer 객체
3. `opened` - 책이 완전히 열렸을 때 resolve되는 promise
4. `isOpen` - 책이 열려있는지 여부를 나타내는 boolean
5. `loading` - 다양한 리소스들의 로딩 상태를 추적하는 defer 객체들의 집합
6. `loaded` - 각 리소스의 로딩이 완료되었을 때 resolve되는 promise들의 집합
7. `ready` - 모든 리소스가 로드되고 파싱되었을 때 resolve되는 promise
8. `isRendered` - 책이 렌더링되었는지 여부를 나타내는 boolean
9. `request` - 리소스를 요청하는 메소드
10. `spine` - 책의 스파인(목차)을 관리하는 Spine 객체
11. `locations` - 책의 위치 정보를 관리하는 Locations 객체
12. `navigation` - 책의 네비게이션 정보를 관리하는 Navigation 객체
13. `pageList` - 책의 페이지 목록을 관리하는 PageList 객체
14. `url` - 책의 URL 정보를 관리하는 Url 객체
15. `path` - 책의 경로 정보를 관리하는 Path 객체
16. `archived` - 책 파일이 있는지 나타내는 boolean
17. `archive` - epub 파일 압축 풀고 안에 파일을 뽑을 수 있는 객체.
18. `storage` - 책의 저장소를 관리하는 Store 객체
19. `resources` - 책의 리소스들을 관리하는 Resources 객체, 리소스의 URL을 Blob URL이나 Base64 URL로 변환하고, CSS 파일 내의 상대 경로를 절대 경로로 변환하는 등의 기능을 제공
20. `rendition` - 책의 렌더링을 관리하는 Rendition 객체
21. `container` - 책의 컨테이너 정보를 관리하는 Container 객체
22. `packaging` - 책의 패키징 정보를 관리하는 Packaging 객체
23. `displayOptions` - 책의 디스플레이 옵션을 관리하는 DisplayOptions 객체

### 메소드 목록(Methods)

1. `constructor(url, options)` - Book 객체를 초기화하고 설정을 적용
2. `open(input, what)` - EPUB 파일이나 URL을 열고 로드
3. `openEpub(data, encoding)` - 압축된 EPUB 파일을 열고 처리
4. `openContainer(url)` - EPUB 컨테이너 파일을 열고 처리
5. `openPackaging(url)` - EPUB 패키징 파일을 열고 처리
6. `openManifest(url)` - 매니페스트 파일을 열고 처리
7. `load(path)` - 지정된 경로의 리소스를 로드
8. `resolve(path, absolute)` - 상대 경로를 절대 경로로 변환
9. `canonical(path)` - 경로를 정규화된 URL로 변환
10. `determineType(input)` - 입력된 데이터의 타입을 결정
11. `unpack(packaging)` - EPUB 패키지의 내용을 해제하고 필요한 정보 설정
12. `loadNavigation(packaging)` - 네비게이션과 페이지 목록을 로드
13. `section(target)` - 스파인에서 특정 섹션을 가져옴
14. `renderTo(element, options)` - 책을 특정 요소에 렌더링
15. `setRequestCredentials(credentials)` - 요청에 사용할 인증 정보 설정
16. `setRequestHeaders(headers)` - 요청에 사용할 헤더 설정
17. `unarchive(input, encoding)` - 압축된 EPUB 파일을 해제
18. `store(name)` - EPUB의 내용을 저장소에 저장
19. `coverUrl()` - 책의 커버 이미지 URL을 가져옴
20. `replacements()` - EPUB의 리소스들을 대체
21. `getRange(cfiRange)` - 주어진 CFI 범위에 대한 DOM 범위를 찾음
22. `key(identifier)` - 책의 고유 키를 생성
23. `destroy()` - Book 객체와 관련된 모든 객체들을 정리하고 제거

BINARY,BASE64로 한정해야 한다. 안 그러면 http 통신을 epubjs가 한다.

store 함수와 클래스를 참고해서 커스텀 로컬 저장소를 만들어야 할 수 도 있겠다. indexDB를 사용할 수 도 있으니.
