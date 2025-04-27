# Blob과 Base64 이해하기

## Blob(Binary Large Object)란?

Blob은 바이너리 데이터를 저장하는 객체입니다. 파일이나 이미지, 오디오, 비디오 등의 바이너리 데이터를 다룰 때 사용됩니다.

### Blob의 주요 사용 시나리오

1. **파일 업로드/다운로드**: 사용자가 선택한 파일을 서버로 전송하거나, 서버에서 받은 파일을 저장할 때 사용합니다.
2. **스트리밍 미디어**: 동영상이나 오디오를 실시간으로 재생할 때 사용합니다.
3. **캔버스 이미지 처리**: HTML5 Canvas에서 생성된 이미지를 파일로 저장할 때 사용합니다.
4. **대용량 데이터 처리**: 메모리에 로드하기 힘든 큰 파일을 조각조각 처리할 때 사용합니다.

### Blob의 주요 특징

1. **바이너리 데이터 저장**: Blob은 순수한 바이너리 데이터를 저장할 수 있습니다.
2. **타입 지정 가능**: MIME 타입을 지정하여 데이터의 종류를 명시할 수 있습니다.
3. **크기 제한**: 브라우저마다 다르지만, 일반적으로 수백 MB까지 저장 가능합니다.
4. **저장 제한**:
   - IndexedDB: Blob 저장 가능
   - localStorage: Blob 저장 불가능 (문자열만 저장 가능)

### Blob 예시

```javascript
// 텍스트로 Blob 생성
const textBlob = new Blob(["Hello, World!"], { type: "text/plain" });

// Blob URL 생성
const blobUrl = URL.createObjectURL(textBlob);
console.log(blobUrl); // blob:http://localhost:3000/550e8400-e29b-41d4-a716-446655440000

// Blob을 파일로 다운로드
const downloadBlob = (blob, filename) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

// 이미지 파일을 Blob으로 변환
const imageInput = document.querySelector('input[type="file"]');
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  const imageBlob = new Blob([file], { type: file.type });
  console.log(imageBlob);
});
```

## Base64란?

Base64는 이미지나 파일과 같은 바이너리 데이터를 텍스트로 변환하는 방식.

### Base64의 주요 특징

1. **이미지 데이터의 텍스트 변환**:
   - 원본 이미지: `FF D8 FF E0 00 10 4A 46 49 46 00 01...` (바이너리)
   - Base64 변환: `/9j/4AAQSkZJRgABAQEASABIAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHI...` (텍스트)
2. **데이터 크기 증가**:
   - 원본 이미지: 100KB
   - Base64 변환 후: 약 133KB (33% 증가)
3. **브라우저 지원**: 모든 현대 브라우저에서 기본적으로 지원됩니다.

### 예시

예를 들어, JPG나 PNG 이미지 파일은 컴퓨터에서 0과 1로 이루어진 바이너리 데이터로 저장된다. 이 데이터를 A-Z, a-z, 0-9, +, / 문자만 사용하여 텍스트로 변환한다.

즉, 변수에 문자열이나 숫자를 저장하는 것 처럼, 변수에 이미지를 저장할 수 있는 것이다.

### Base64의 장점

1. **별도 파일 불필요**:

   - Base64 데이터는 이미지 데이터를 텍스트 형태로 변환한 것이므로, 별도의 이미지 파일이 필요 없습니다.
   - HTML, CSS, JavaScript에 직접 이미지를 넣을 수 있다. 즉 링크 url을 통해 서버에 요청하지 않고도 직접 이미지를 사용할 수 있게 된다.
   - 이미지 URL을 관리할 필요가 없어져 코드 관리가 단순해집니다.

2. **동시 로딩**:

   - 문서와 함께 이미지가 로딩되어 이미지 로딩이 끊기지 않습니다.
   - 네트워크 상태가 좋지 않아도 이미지를 안정적으로 표시할 수 있습니다.
   - 이미지 로딩 실패나 지연 없이 즉시 표시됩니다.

3. **캐시 효율성**:
   - 문서와 함께 캐시되어 추가 HTTP 요청이 필요 없습니다.
   - 작은 이미지의 경우 여러 번의 HTTP 요청을 줄일 수 있습니다.
   - 브라우저 캐시 정책에 영향을 받지 않아 안정적인 이미지 표시가 가능합니다.

### Base64의 단점

1. **가독성 저하**:

   - Base64 문자열이 매우 길어 코드의 가독성이 떨어집니다.
   - 이미지 데이터가 코드에 포함되어 코드 관리가 어려워질 수 있습니다.

2. **용량 증가**:

   - Base64 인코딩으로 인해 원본보다 33% 용량이 증가합니다.
   - 대용량 이미지의 경우 문서 크기가 크게 증가할 수 있습니다.

3. **성능 저하 가능성**:
   - 문서 크기가 커지면 초기 로딩 시간이 증가할 수 있습니다.
   - 이미지가 많을 경우 오히려 전체 로딩 속도가 저하될 수 있습니다.

### Base64 사용 권장 사례

1. **작은 크기의 이미지**:

   - 아이콘, 배지, 작은 로고 등
   - HTTP 요청을 줄이기 위해 사용

2. **즉시 표시가 필요한 이미지**:

   - 로딩 화면, 스플래시 이미지
   - 네트워크 상태와 관계없이 즉시 표시해야 하는 경우

3. **캐시가 중요한 이미지**:
   - 자주 사용되는 작은 이미지
   - 오프라인에서도 필요한 이미지

### Base64 사용 주의 사례

1. **대용량 이미지**:

   - 고해상도 사진
   - 큰 배너 이미지

2. **동적으로 변경되는 이미지**:

   - 사용자 프로필 사진
   - 실시간으로 업데이트되는 이미지

3. **많은 수의 이미지**:
   - 갤러리 페이지
   - 이미지가 많은 콘텐츠 페이지

### Base64 변환하는 법

이미지를 Blob으로 변환한 후 Base64로 변환하는 리액트 예시:

```jsx
import { useState } from "react";

function ImageConverter() {
  const [base64Image, setBase64Image] = useState("");

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    // 1. File을 Blob으로 변환
    const blob = new Blob([file], { type: file.type });

    // 2. Blob을 Base64로 변환
    const reader = new FileReader();
    reader.onload = () => setBase64Image(reader.result);
    reader.readAsDataURL(blob);
  };

  return (
    <div>
      <input type="file" onChange={handleImageChange} />
      {base64Image && <img src={base64Image} alt="변환된 이미지" />}
    </div>
  );
}
```
