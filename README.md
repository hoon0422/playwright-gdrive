# Playwright Google Drive Downloader

Google Drive 공유 링크(Docs, Sheets, Slides, Folders)를 Playwright를 사용하여 자동으로 다운로드하는 도구입니다.
Node.js 환경에서 실행됩니다.

## 설치 (Setup)

```bash
npm install
```

## 사용법 (Usage)

```bash
npm run download <url1> [url2 ... url10] <output_dir> [--user-data-dir <dir>]
```

### 예시

```bash
# 단일 파일 다운로드
npm run download "https://docs.google.com/document/d/..." ./downloads

# 여러 파일 다운로드 (최대 10개)
npm run download "https://docs.google.com/document/d/..." "https://docs.google.com/spreadsheets/d/..." ./downloads

# 사용자 데이터 디렉토리 지정 (로그인 세션 유지용)
npm run download "https://drive.google.com/drive/folders/..." ./downloads --user-data-dir ./my-session
```

### 옵션

- `<url...>`: 다운로드할 Google Drive/Docs 링크 (최대 10개)
- `<output_dir>`: 파일이 저장될 경로 (마지막 인자로 전달해야 합니다)
- `--user-data-dir <dir>`: 브라우저 사용자 데이터(로그인 세션 등)를 저장할 경로. 지정하지 않으면 현재 디렉토리의 `.user_data` 폴더를 사용합니다.

## 로그인 (Login)

스크립트 실행 시 로그인이 필요한 경우, 브라우저가 열리고 로그인 페이지로 리다이렉트됩니다.
브라우저에서 수동으로 로그인을 완료하면, 스크립트가 이를 감지하고 자동으로 다운로드를 진행하거나 종료됩니다.
로그인 세션은 `--user-data-dir`에 저장되므로, 다음 실행부터는 로그인 상태가 유지됩니다.

## 사전 로그인 (Pre-login)

대량의 다운로드를 수행하기 전에 미리 로그인을 해두고 싶다면 `login` 스크립트를 사용할 수 있습니다.

```bash
npm run login <user_data_dir>
```

예시:

```bash
npm run login ./my-session
```

이 명령어를 실행하면 브라우저가 열리고 Google 로그인 페이지로 이동합니다. 로그인을 완료한 후 브라우저를 닫으면 세션이 저장됩니다.
이후 `download` 스크립트에서 동일한 `--user-data-dir`을 사용하여 로그인된 상태로 다운로드를 진행할 수 있습니다.

## 지원하는 링크

- **Google Docs**: `.docx` 형식으로 다운로드
- **Google Sheets**: `.xlsx` 형식으로 다운로드
- **Google Slides**: `.pptx` 형식으로 다운로드
- **Google Drive 폴더**: `.zip`으로 다운로드 후 지정된 폴더에 압축 해제

## 요구 사항

- Node.js
