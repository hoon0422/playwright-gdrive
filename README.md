# Playwright Google Drive Downloader

Google Drive 공유 링크를 Playwright로 열어 문서/폴더를 다운로드합니다.

## Setup

```bash
bun install
```

## Usage

```bash
bun src/download.ts <shareLink> <outputDir> --wait-login
```

옵션:
- `--user-data-dir <dir>`: 로그인 세션을 저장할 폴더 (기본: `.playwright-user-data`)
- `--headless`: 브라우저를 headless로 실행
- `--wait-login`: 최초 로그인 수동 진행을 위해 일시 정지

## 지원 링크

- Google Docs: `https://docs.google.com/document/d/<id>/edit`
- Google Sheets: `https://docs.google.com/spreadsheets/d/<id>/edit`
- Google Slides: `https://docs.google.com/presentation/d/<id>/edit`
- Google Drive 폴더: `https://drive.google.com/drive/folders/<id>`

Docs/Sheets/Slides는 각각 docx/xlsx/pptx 형식으로 내보냅니다. 폴더는 zip으로 다운로드 후 지정한 위치에 압축 해제합니다.\n+\n+## 로그인 유지\n+\n+최초 로그인은 `--wait-login`으로 진행하고, 이후 동일한 `--user-data-dir`를 사용하면 세션이 유지되어 다시 로그인하지 않아도 됩니다.
