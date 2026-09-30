# GlossQuote-Labs — 日期差與加減天數 / Date Calculator

繁體中文與英文的靜態日期工具，所有日期計算都在瀏覽器中完成。無帳號、API、上傳、追蹤或工作資料儲存。

A static date calculator in Traditional Chinese and English. Calculations run in your browser, with no account, API, upload, tracking, or storage of entered dates.

## 功能 / Features

- **日期差 / Date difference:** 結束日期減開始日期，可為負數。End date minus start date, including negative differences.
- **含起訖日 / Inclusive count:** 日期差的絕對值加一；同一天分別是0天與1天。Absolute difference plus one; the same date gives a difference of 0 and an inclusive count of 1.
- **加減天數 / Add or subtract days:** 正數往後、負數往前、0維持日期。Positive moves forward, negative moves backward, and zero keeps the date.
- 交換日期、清除及即時欄位錯誤；切換模式、語言或重整會清空輸入。Swap, clear, and immediate field errors; changing modes or languages, or reloading, clears input.

使用延伸公曆，日期支援 `0001-01-01` 至 `9999-12-31`；天數只接受 `-3652058` 至 `3652058` 的整數，計算結果也須在日期範圍內。不提供工作日、假日、時區、時間、月份／年份加減、農曆或法律期限判斷。

Uses the proleptic Gregorian calendar, from `0001-01-01` through `9999-12-31`. Day offsets must be integers from `-3652058` through `3652058`, and the result must remain in the supported date range. Workdays, holidays, time zones, times, month/year addition, lunar calendars, and legal deadline rules are not provided.

## 本機預覽 / Local preview

需要 Node.js 24+，沒有套件依賴，不需要 `npm install`。下載或複製此倉庫後，在倉庫根目錄執行：

Requires Node.js 24+. No dependencies or `npm install` are needed. From the repository root:

```sh
npm run dev
```

- [繁體中文](http://127.0.0.1:4174/index.html)
- [English](http://127.0.0.1:4174/en/index.html)

服務僅監聽 `127.0.0.1:4174`；請使用完整HTML路徑，根路徑 `/` 回404。按Ctrl+C停止。請透過本機HTTP服務使用，直接雙擊HTML的file://方式不受支援。

The server binds only to `127.0.0.1:4174`. Use the complete HTML paths above; `/` returns 404. Stop with Ctrl+C. Open through the local HTTP server, not by double-clicking HTML files.

## 檢查與建置 / Validation and build

```sh
npm test
npm run check
npm run build
```

Windows PowerShell如遇執行原則問題，可使用`npm.cmd`。純函式與工具鏈測試使用Node內建模組和離線合成資料；build將`public/`複製成`dist/`，不會自動部署。`dist/`不納入Git追蹤。

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm`. Tests use built-in Node modules and offline synthetic data. Build copies `public/` into `dist/`; it does not deploy the site. Generated `dist/` is not tracked.

Source layout: `public/` contains both pages and browser modules; `scripts/` contains preview/check/build commands; `test/` contains automated tests.

## 驗證範圍 / Verification scope

開發版本於2026-09-29通過39項自動測試、17個受管來源檔檢查與8檔建置。核心另與Python標準日期庫交叉核對129,987個日期及2,000組計算。應用程式內瀏覽器已檢查兩語兩模式、46條操作狀態斷言、320px版型、強制文字日期欄位及模組載入失敗狀態。

The development version passed 39 automated tests, checks covering 17 managed source files, and an 8-file build on 2026-09-29. Its core was also compared against Python's standard date library for 129,987 dates and 2,000 calculations. In-app browser checks covered both languages and modes, 46 interaction-state assertions, 320px layout, forced text date inputs, and module loading failure.

人工待驗仍保留：真200%縮放、額外40%長標籤、手機真機、螢幕閱讀器、Firefox/Safari、完整Network/storage、首次離線、真BFCache，以及真正禁用JavaScript的noscript畫面。強制文字欄位不是不支援date瀏覽器的相容性認證。這不是完整MVP或獨立安全認證。

Manual checks remain pending: real 200% zoom, labels expanded by another 40%, physical mobile devices, screen readers, Firefox/Safari, full Network/storage inspection, first-load offline behavior, actual BFCache restoration, and the noscript view with JavaScript disabled. Forced text inputs do not certify unsupported-browser compatibility. This is not full MVP acceptance or an independent security certification.

## 公開原始碼與網站上線 / Source publication and hosting

此倉庫供原始碼檢查，尚未部署網站或啟用GitHub Pages。兩語保留`noindex, nofollow`，沒有正式canonical或sitemap。正式網址確定後，需補絕對canonical/hreflang、精確調整check/build允許的SEO檔案與路徑，並在託管端驗證CSP（含frame-ancestors）、nosniff、Referrer-Policy、HTTPS及mjs MIME後再開放索引。

This repository is for source review. The site is not deployed and GitHub Pages is not enabled. Both pages retain `noindex, nofollow`; production canonical URLs and a sitemap are not configured. Hosting requires production canonical/hreflang URLs, precise check/build allowances for SEO files, and verified CSP (including frame-ancestors), nosniff, Referrer-Policy, HTTPS, and mjs MIME settings before indexing is enabled.

## 授權 / License

尚未指定授權條款，未加入LICENSE檔案。No license terms have been specified; no LICENSE file is included.
