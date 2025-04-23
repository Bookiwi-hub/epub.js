# Epub.js v0.3

![FuturePress Views](http://fchasen.com/futurepress/fp.png)

Epub.js is a JavaScript library for rendering ePub documents in the browser, across many devices.

Epub.js provides an interface for common ebook functions (such as rendering, persistence and pagination) without the need to develop a dedicated application or plugin. Importantly, it has an incredibly permissive [Free BSD](http://en.wikipedia.org/wiki/BSD_licenses) license.

[Try it while reading Moby Dick](https://futurepress.github.io/epubjs-reader/)

## Why EPUB

![Why EPUB](http://fchasen.com/futurepress/whyepub.png)

The [EPUB standard](http://www.idpf.org/epub/30/spec/epub30-overview.html) is a widely used and easily convertible format. Many books are currently in this format, and it is convertible to many other formats (such as PDF, Mobi and iBooks).

An unzipped EPUB3 is a collection of HTML5 files, CSS, images and other media – just like any other website. However, it enforces a schema of book components, which allows us to render a book and its parts based on a controlled vocabulary.

More specifically, the EPUB schema standardizes the table of contents, provides a manifest that enables the caching of the entire book, and separates the storage of the content from how it's displayed.

## Getting Started

If using archived `.epub` files include JSZip (this must precede inclusion of epub.js):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script>
```

Get the minified code from the build folder:

```html
<script src="../dist/epub.min.js"></script>
```

Set up a element to render to:

```html
<div id="area"></div>
```

Create the new ePub, and then render it to that element:

```html
<script>
  var book = ePub("url/to/book/package.opf");
  var rendition = book.renderTo("area", { width: 600, height: 400 });
  var displayed = rendition.display();
</script>
```

## Render Methods

### Default

```js
book.renderTo("area", { method: "default", width: "100%", height: "100%" });
```

[View example](http://futurepress.github.io/epub.js/examples/spreads.html)

The default manager only displays a single section at a time.

### Continuous

```js
book.renderTo("area", { method: "continuous", width: "100%", height: "100%" });
```

[View example](http://futurepress.github.io/epub.js/examples/continuous-scrolled.html)

The continuous manager will display as many sections as need to fill the screen, and preload the next section offscreen. This enables seamless swiping / scrolling between pages on mobile and desktop, but is less performant than the default method.

## Flow Overrides

### Auto (Default)

`book.renderTo("area", { flow: "auto", width: "900", height: "600" });`

Flow will be based on the settings in the OPF, defaults to `paginated`.

### Paginated

```js
book.renderTo("area", { flow: "paginated", width: "900", height: "600" });
```

[View example](http://futurepress.github.io/epub.js/examples/spreads.html)

Scrolled: `book.renderTo("area", { flow: "scrolled-doc" });`

[View example](http://futurepress.github.io/epub.js/examples/scrolled.html)

## Scripted Content

[Scripted content](https://www.w3.org/TR/epub-33/#sec-scripted-content), JavasScript the ePub HTML content, is disabled by default due to the potential for executing malicious content.

This is done by sandboxing the iframe the content is rendered into, though it is still recommended to sanitize the ePub content server-side as well.

If a trusted ePub contains interactivity, it can be enabled by passing `allowScriptedContent: true` to the `Rendition` settings.

```html
<script>
  var rendition = book.renderTo("area", {
    width: 600,
    height: 400,
    allowScriptedContent: true,
  });
</script>
```

This will allow the sandboxed content to run scripts, but currently makes the sandbox insecure.

## Documentation

API documentation is available at [epubjs.org/documentation/0.3/](http://epubjs.org/documentation/0.3/)

A Markdown version is included in the repo at [documentation/API.md](https://github.com/futurepress/epub.js/blob/master/documentation/md/API.md)

## Running Locally

install [node.js](http://nodejs.org/)

Then install the project dependences with npm

```javascript
npm install
```

You can run the reader locally with the command

```javascript
npm start
```

## Examples

- [Spreads](http://futurepress.github.io/epub.js/examples/spreads.html)
- [Scrolled](http://futurepress.github.io/epub.js/examples/scrolled.html)
- [Swipe](http://futurepress.github.io/epub.js/examples/swipe.html)
- [Input](http://futurepress.github.io/epub.js/examples/input.html)
- [Highlights](http://futurepress.github.io/epub.js/examples/highlights.html)

[View All Examples](http://futurepress.github.io/epub.js/examples/)

## Testing

Test can be run by Karma from NPM

```js
npm test
```

## Building for Distribution

Builds are concatenated and minified using [webpack](https://webpack.js.org/) and [babel](https://babeljs.io/)

To generate a new build run

```javascript
npm run prepare
```

or to continuously build run

```javascript
npm run watch
```

## Hooks

Similar to a plugins, Epub.js implements events that can be "hooked" into. Thus you can interact with and manipulate the contents of the book.

Examples of this functionality is loading videos from YouTube links before displaying a chapter's contents or implementing annotation.

Hooks require an event to register to and a can return a promise to block until they are finished.

Example hook:

```javascript
rendition.hooks.content.register(function (contents, view) {
  var elements = contents.document.querySelectorAll("[video]");
  var items = Array.prototype.slice.call(elements);

  items.forEach(function (item) {
    // do something with the video item
  });
});
```

The parts of the rendering process that can be hooked into are below.

```js
book.spine.hooks.serialize; // Section is being converted to text
book.spine.hooks.content; // Section has been loaded and parsed
rendition.hooks.render; // Section is rendered to the screen
rendition.hooks.content; // Section contents have been loaded
rendition.hooks.unloaded; // Section contents are being unloaded
```

## Reader

The reader has moved to its own repo at: https://github.com/futurepress/epubjs-reader/

## Additional Resources

[![Gitter Chat](https://badges.gitter.im/futurepress/epub.js.png)](https://gitter.im/futurepress/epub.js "Gitter Chat")

[Epub.js Developer Mailing List](https://groups.google.com/forum/#!forum/epubjs)

IRC Server: freenode.net Channel: #epub.js

Follow us on twitter: @Epubjs

- http://twitter.com/#!/Epubjs

## Other

EPUB is a registered trademark of the [IDPF](http://idpf.org/).

---

# Epub.js v0.3 (한국어 번역)

![FuturePress Views](http://fchasen.com/futurepress/fp.png)

Epub.js는 브라우저에서 ePub 문서를 렌더링하기 위한 JavaScript 라이브러리로, 다양한 기기에서 사용할 수 있습니다.

Epub.js는 전용 애플리케이션이나 플러그인을 개발할 필요 없이 일반적인 전자책 기능(렌더링, 지속성, 페이지네이션 등)에 대한 인터페이스를 제공합니다. 특히, 매우 허용적인 [Free BSD](http://en.wikipedia.org/wiki/BSD_licenses) 라이선스를 가지고 있습니다.

[모비 딕을 읽으면서 시도해보세요](https://futurepress.github.io/epubjs-reader/)

## EPUB를 선택한 이유

![Why EPUB](http://fchasen.com/futurepress/whyepub.png)

[EPUB 표준](http://www.idpf.org/epub/30/spec/epub30-overview.html)은 널리 사용되고 쉽게 변환할 수 있는 형식입니다. 많은 책들이 현재 이 형식으로 되어 있으며, PDF, Mobi, iBooks 등 다른 많은 형식으로 변환할 수 있습니다.

압축이 해제된 EPUB3는 HTML5 파일, CSS, 이미지 및 기타 미디어의 모음으로, 다른 웹사이트와 마찬가지입니다. 그러나 책 구성요소에 대한 스키마를 강제하여 제어된 어휘를 기반으로 책과 그 부분을 렌더링할 수 있습니다.

더 구체적으로, EPUB 스키마는 목차를 표준화하고, 전체 책의 캐싱을 가능하게 하는 매니페스트를 제공하며, 콘텐츠의 저장을 표시 방식과 분리합니다.

## 시작하기

아카이브된 `.epub` 파일을 사용하는 경우 JSZip을 포함하세요 (이는 epub.js 포함 전에 와야 합니다):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script>
```

빌드 폴더에서 최소화된 코드를 가져옵니다:

```html
<script src="../dist/epub.min.js"></script>
```

렌더링할 요소를 설정합니다:

```html
<div id="area"></div>
```

새로운 ePub를 생성하고 해당 요소에 렌더링합니다:

```html
<script>
  var book = ePub("url/to/book/package.opf");
  var rendition = book.renderTo("area", { width: 600, height: 400 });
  var displayed = rendition.display();
</script>
```

## 렌더링 방법

### 기본

```js
book.renderTo("area", { method: "default", width: "100%", height: "100%" });
```

[예제 보기](http://futurepress.github.io/epub.js/examples/spreads.html)

기본 매니저는 한 번에 하나의 섹션만 표시합니다.

### 연속

```js
book.renderTo("area", { method: "continuous", width: "100%", height: "100%" });
```

[예제 보기](http://futurepress.github.io/epub.js/examples/continuous-scrolled.html)

연속 매니저는 화면을 채우기 위해 필요한 만큼의 섹션을 표시하고, 다음 섹션을 화면 밖에서 미리 로드합니다. 이는 모바일과 데스크톱에서 페이지 간의 매끄러운 스와이프/스크롤을 가능하게 하지만, 기본 방법보다 성능이 떨어집니다.

## 흐름 재정의

### 자동 (기본값)

`book.renderTo("area", { flow: "auto", width: "900", height: "600" });`

흐름은 OPF의 설정을 기반으로 하며, 기본값은 `paginated`입니다.

### 페이지화

```js
book.renderTo("area", { flow: "paginated", width: "900", height: "600" });
```

[예제 보기](http://futurepress.github.io/epub.js/examples/spreads.html)

스크롤: `book.renderTo("area", { flow: "scrolled-doc" });`

[예제 보기](http://futurepress.github.io/epub.js/examples/scrolled.html)

## 스크립트 콘텐츠

[스크립트 콘텐츠](https://www.w3.org/TR/epub-33/#sec-scripted-content), ePub HTML 콘텐츠의 JavaScript는 악의적인 콘텐츠 실행 가능성 때문에 기본적으로 비활성화되어 있습니다.

이는 콘텐츠가 렌더링되는 iframe을 샌드박싱하여 수행되지만, 서버 측에서도 ePub 콘텐츠를 정리하는 것이 권장됩니다.

신뢰할 수 있는 ePub에 상호작용성이 포함되어 있는 경우, `Rendition` 설정에 `allowScriptedContent: true`를 전달하여 활성화할 수 있습니다.

```html
<script>
  var rendition = book.renderTo("area", {
    width: 600,
    height: 400,
    allowScriptedContent: true,
  });
</script>
```

이렇게 하면 샌드박스된 콘텐츠가 스크립트를 실행할 수 있지만, 현재는 샌드박스를 불안전하게 만듭니다.

## 문서

API 문서는 [epubjs.org/documentation/0.3/](http://epubjs.org/documentation/0.3/)에서 확인할 수 있습니다.

마크다운 버전은 저장소의 [documentation/API.md](https://github.com/futurepress/epub.js/blob/master/documentation/md/API.md)에 포함되어 있습니다.

## 로컬에서 실행하기

[node.js](http://nodejs.org/)를 설치하세요

그런 다음 npm으로 프로젝트 의존성을 설치합니다

```javascript
npm install
```

다음 명령으로 리더를 로컬에서 실행할 수 있습니다

```javascript
npm start
```

## 예제

- [스프레드](http://futurepress.github.io/epub.js/examples/spreads.html)
- [스크롤](http://futurepress.github.io/epub.js/examples/scrolled.html)
- [스와이프](http://futurepress.github.io/epub.js/examples/swipe.html)
- [입력](http://futurepress.github.io/epub.js/examples/input.html)
- [하이라이트](http://futurepress.github.io/epub.js/examples/highlights.html)

[모든 예제 보기](http://futurepress.github.io/epub.js/examples/)

## 테스트

테스트는 NPM에서 Karma를 통해 실행할 수 있습니다

```js
npm test
```

## 배포를 위한 빌드

빌드는 [webpack](https://webpack.js.org/)과 [babel](https://babeljs.io/)을 사용하여 연결되고 최소화됩니다

새로운 빌드를 생성하려면 실행하세요

```javascript
npm run prepare
```

또는 지속적으로 빌드하려면 실행하세요

```javascript
npm run watch
```

## 훅

플러그인과 유사하게, Epub.js는 "훅"할 수 있는 이벤트를 구현합니다. 이를 통해 책의 콘텐츠와 상호작용하고 조작할 수 있습니다.

이 기능의 예로는 챕터의 콘텐츠를 표시하기 전에 YouTube 링크에서 비디오를 로드하거나 주석을 구현하는 것이 있습니다.

훅은 등록할 이벤트가 필요하며 완료될 때까지 차단할 수 있는 프라미스를 반환할 수 있습니다.

훅 예제:

```javascript
rendition.hooks.content.register(function (contents, view) {
  var elements = contents.document.querySelectorAll("[video]");
  var items = Array.prototype.slice.call(elements);

  items.forEach(function (item) {
    // 비디오 항목으로 무언가를 수행
  });
});
```

렌더링 프로세스에서 훅할 수 있는 부분은 다음과 같습니다.

```js
book.spine.hooks.serialize; // 섹션이 텍스트로 변환되는 중
book.spine.hooks.content; // 섹션이 로드되고 파싱됨
rendition.hooks.render; // 섹션이 화면에 렌더링됨
rendition.hooks.content; // 섹션 콘텐츠가 로드됨
rendition.hooks.unloaded; // 섹션 콘텐츠가 언로드되는 중
```

## 리더

리더는 자체 저장소로 이동했습니다: https://github.com/futurepress/epubjs-reader/

## 추가 리소스

[![Gitter Chat](https://badges.gitter.im/futurepress/epub.js.png)](https://gitter.im/futurepress/epub.js "Gitter Chat")

[Epub.js 개발자 메일링 리스트](https://groups.google.com/forum/#!forum/epubjs)

IRC 서버: freenode.net 채널: #epub.js

트위터에서 팔로우하세요: @Epubjs

- http://twitter.com/#!/Epubjs

## 기타

EPUB는 [IDPF](http://idpf.org/)의 등록 상표입니다.
