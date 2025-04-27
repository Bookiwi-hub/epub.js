# JavaScript Range 객체 완벽 가이드

## Range 객체란?

Range 객체는 웹 문서(DOM)에서 텍스트 또는 노드의 "범위"(시작점~끝점)를 지정해 조작할 수 있게 해주는 강력한 도구이다. 마치 워드에서 텍스트를 드래그해 선택하는 것과 비슷하다.

---

## Range 주요 속성 (간단 정리)

| 속성명         | 설명                 |
| -------------- | -------------------- |
| startContainer | 시작 노드            |
| startOffset    | 시작 위치(인덱스)    |
| endContainer   | 끝 노드              |
| endOffset      | 끝 위치(인덱스)      |
| collapsed      | 범위가 비었는지 여부 |

## Range 주요 메소드 (간단 정리)

| 메소드명                       | 설명              |
| ------------------------------ | ----------------- |
| setStart, setEnd               | 시작/끝 위치 지정 |
| selectNode                     | 노드 전체 선택    |
| selectNodeContents             | 노드 내용만 선택  |
| collapse                       | 범위 축소         |
| deleteContents                 | 범위 내용 삭제    |
| extractContents, cloneContents | 내용 추출/복제    |
| insertNode                     | 노드 삽입         |
| surroundContents               | 범위 감싸기       |
| toString                       | 텍스트 반환       |

---

## 1. 텍스트 일부 선택하기

### 예시 텍스트

```html
<div class="content">안녕하세요, JavaScript Range 객체입니다.</div>
```

### 코드 예시

```javascript
// 텍스트 노드 가져오기
const textNode = document.querySelector(".content").firstChild;
// textNode.textContent = "안녕하세요, JavaScript Range 객체입니다."

// Range 객체 생성
const range = document.createRange();

// 0: 안, 1: 녕, 2: 하, 3: 세, 4: 요, 5: ,
range.setStart(textNode, 2); // 2번째 문자(하)부터
range.setEnd(textNode, 5); // 5번째 문자(,)까지
```

### 실제 선택 결과

```html
<div class="content">안녕|하세요|, JavaScript Range 객체입니다.</div>
<!-- | | 사이의 텍스트(하세요)가 선택된다. -->
```

## 2. 노드 전체 선택하기

### 예시 텍스트

```html
<div class="container">
  <p class="paragraph">첫 번째 단락입니다.</p>
  <p>두 번째 단락입니다.</p>
</div>
```

### 코드 예시

```javascript
const node = document.querySelector(".paragraph");
const range = document.createRange();
range.selectNode(node);
```

### 실제 선택 결과

```html
<div class="container">
  |
  <p class="paragraph">첫 번째 단락입니다.</p>
  |
  <p>두 번째 단락입니다.</p>
</div>
<!-- | | 사이의 p 태그 전체가 선택된다. -->
```

## 3. 노드 내용만 선택하기

### 예시 텍스트

```html
<div class="content">
  <h2>제목</h2>
  <p>첫 번째 단락</p>
  <p>두 번째 단락</p>
</div>
```

### 코드 예시

```javascript
const node = document.querySelector(".content");
const range = document.createRange();
range.selectNodeContents(node);
```

### 실제 선택 결과

```html
<div class="content">
  |
  <h2>제목</h2>
  <p>첫 번째 단락</p>
  <p>두 번째 단락</p>
  |
</div>
<!-- | | 사이의 모든 내용이 선택된다. (div 태그 자체는 제외) -->
```

## 4. 여러 노드에 걸쳐 선택하기

### 예시 텍스트

```html
<div class="container">
  <p class="start">이것은 첫 번째 단락입니다.</p>
  <p>이것은 두 번째 단락입니다.</p>
  <p class="end">이것은 세 번째 단락입니다.</p>
</div>
```

### 코드 예시

```javascript
const startNode = document.querySelector(".start").firstChild; // "이것은 첫 번째 단락입니다."
const endNode = document.querySelector(".end").firstChild; // "이것은 세 번째 단락입니다."
// 0: 이, 1: 것, 2: 은, 3:  , 4: 첫, ...
const range = document.createRange();
range.setStart(startNode, 4); // 첫 번째 p의 4번째 문자(첫)부터
range.setEnd(endNode, 6); // 마지막 p의 6번째 문자(세)까지
```

### 실제 선택 결과

```html
<div class="container">
  <p class="start">이것|은 첫 번째 단락입니다.</p>
  <p>이것은 두 번째 단락입니다.</p>
  <p class="end">이것은 세|번째 단락입니다.</p>
</div>
<!-- | | 사이의 텍스트가 여러 노드에 걸쳐 선택된다. -->
```

## 5. 실제 활용: 텍스트 하이라이팅

### 예시 텍스트

```html
<p class="article">JavaScript는 웹 개발에서 가장 중요한 언어입니다.</p>
```

### 코드 예시

```javascript
const textNode = document.querySelector(".article").firstChild;
const range = document.createRange();

const text = textNode.textContent;
const startIndex = text.indexOf("JavaScript");
const endIndex = startIndex + "JavaScript".length;

range.setStart(textNode, startIndex);
range.setEnd(textNode, endIndex);

const span = document.createElement("span");
span.className = "highlight";
range.surroundContents(span);
```

### 실제 선택 결과 및 하이라이트 적용 후

```html
<!-- Range 적용 시 (선택된 텍스트) -->
<p class="article">|JavaScript|는 웹 개발에서 가장 중요한 언어입니다.</p>

<!-- surroundContents 실행 후 -->
<p class="article">
  <span class="highlight">JavaScript</span>는 웹 개발에서 가장 중요한
  언어입니다.
</p>
```

---

## 참고 및 주의사항

- Range는 텍스트 편집, 하이라이트, 복사/붙여넣기 등 다양한 곳에 활용된다.
- 인덱스는 0부터 시작한다. (공백, 특수문자 포함)
- 여러 노드에 걸친 선택도 가능하다.
- Range 객체 사용 후 필요하다면 해제하거나, 메모리 누수에 주의해야 한다.

---

## 결론

Range 객체는 웹에서 텍스트와 노드를 정밀하게 선택·조작할 수 있는 매우 유용한 도구이다.
