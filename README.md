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

此倉庫供原始碼檢查，尚未部署網站或啟用GitHub Pages。兩語來源與預設build保留`noindex, nofollow`。正式建置工具鏈已備妥；網址及主機選定後，仍需驗證安全標頭、MIME、重新導向與索引政策，才能部署正式版本。

This repository is for source review. The site is not deployed and GitHub Pages is not enabled. Source pages and default builds retain `noindex, nofollow`. Production build tooling is ready; actual hosting headers, MIME types, redirects, and indexing policies still require verification before deployment.

## 稽核修正與正式建置 / Audit fixes and production builds

2026-09-30：46項測試、20個受管來源檔檢查及8檔預覽建置通過。兩語原生HTTP頁面完成14項鍵盤狀態檢查；Enter現在確認最新日期結果，保留焦點、離欄確認與有效输入時節制通知。模擬DOM測試不等於真螢幕閱讀器验證，以上人工待驗仍保留。

On 2026-09-30, all 46 tests, checks covering 20 source files, and the 8-file preview build passed. Fourteen real HTTP browser assertions covered both languages. Enter confirms the latest result without moving focus; change-on-blur and quiet continuous typing remain. Simulated DOM tests do not certify screen-reader behavior; the manual checklist above remains pending.

下列網址只供離線測試。正式主機選定後換成真實HTTPS部署目錄；不要部署這個佔位網址。兩旗標須一起使用，沒有預設正式網址。

The URL below is an offline test placeholder. Replace it with the real HTTPS deployment directory once hosting is decided. Both flags are required; there is no default production URL. Do not deploy the placeholder build.

```sh
npm run build -- --production --site-url https://dates.example.invalid/tools/dates/
npm run check -- --production --site-url https://dates.example.invalid/tools/dates/
```

- 正式HTML產生自指canonical、雙向絕對zh-Hant/en hreflang及index/follow；sitemap只含index.html與en/index.html。來源HTML仍noindex。
- Production HTML gets self-canonical URLs, reciprocal absolute zh-Hant/en hreflang, and index/follow. The sitemap lists only index.html and en/index.html. Source HTML stays noindex.
- 根目錄正式build10檔，含robots.txt；子目錄build9檔，不產生robots，須檢查主站origin根目錄既有政策並提交或登記sitemap。不得覆寫主站robots。
- Origin-root builds contain 10 files including robots.txt. Subdirectory builds contain 9 files and no robots file; inspect the parent site's origin-root policy and submit or register the sitemap without overwriting that policy.
- 接受簡單ASCII HTTPS主機／目錄，拒絕帳密、query、fragment、編碼及歧義路徑。一般連結與資產仍限本地；只有精確SEO metadata可用絕對網址，任意XML/TXT及inline script仍拒絕。註解中的SEO標記不計有效。
- Plain ASCII HTTPS hosts/directories are accepted; credentials, queries, fragments, encoded and ambiguous paths are rejected. General links/assets stay local, only exact SEO metadata permits absolute URLs, and arbitrary XML/TXT or inline scripts remain rejected. Commented-out SEO tags do not count.
- 無旗標npm run build恢復8檔noindex預覽；npm run dev永遠讀public，不是正式主機。build不部署，dist不入Git。
- Running npm run build without flags restores the 8-file noindex preview. npm run dev always serves public, not the production build. Builds do not deploy, and dist is not tracked.

正式主機仍需配置並以真實HTTP驗收下列headers、HTTPS、mjs JavaScript MIME、未知路徑404、唯一URL與redirect、origin robots和無衝突X-Robots-Tag。若主機將index.html強制轉址到目錄URL，先調整並測試canonical契約。CSP meta不能提供frame-ancestors；開發伺服器headers不會自動部署。

Verify these headers over real HTTP, plus HTTPS, JavaScript MIME for mjs, unknown-route 404s, unique URLs/redirects, origin robots, and non-conflicting X-Robots-Tag. If hosting redirects index.html to directory URLs, update and test the canonical contract first. Meta CSP cannot provide frame-ancestors, and development-server headers do not deploy automatically.

```text
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

## Cloudflare 部署準備 / Cloudflare deployment preparation

2026-10-06：已選定 Cloudflare Free，正式 origin 為 `https://date.glossquote.com/`。這是部署設定與原始碼更新；DNS 接入及正式主機驗收尚未完成，不能把此提交當成網站已上線。

Cloudflare Free is selected, with `https://date.glossquote.com/` as the production origin. This commit prepares hosting; DNS activation and live-host verification remain pending.

```sh
npm run build -- --production --cloudflare --site-url https://date.glossquote.com/
npm run check -- --production --cloudflare --site-url https://date.glossquote.com/
```

此模式產生12份檔案，新增精確驗證的 `_headers`／`_redirects`。`wrangler.jsonc` 使用純靜態資產、`html_handling: none`，保留 `/index.html` 與 `/en/index.html` canonical；`/`、`/en`、`/en/` 以301導向唯一頁，未知路徑404。安全HTTP標頭包括CSP、nosniff、no-referrer及 `.mjs` JavaScript MIME。停用workers.dev、version preview URLs、自訂日誌與追蹤。

The 12-file Cloudflare build adds exact-policy `_headers` and `_redirects`. Static-only hosting preserves the existing canonical URLs, redirects directory aliases, and avoids SPA fallback. Workers.dev and version preview URLs, custom logs, and tracking are disabled. The CLI build command regenerates validated production assets before deployment; source HTML and default builds remain noindex previews.

Wrangler 4.147.0 已完成打包試跑；平台相容日期使用UTC 2026-10-05。CLI為獨立部署工具，不是產品執行期或測試依賴。真正上線仍需已登入的部署管道、Active zone及正式HTTP／瀏覽器驗收；不得只上传dist而忽略HTML handling設定。`dist`、`.wrangler`及憑證不得提交。

Packaging was dry-run with Wrangler 4.147.0. Deployment still requires authentication, an active zone, and live HTTP/browser verification. The CLI is deployment tooling, not a runtime or test dependency. Do not upload assets with a hosting configuration that changes the canonical URL contract. Keep generated output and credentials out of Git.

## 授權 / License

尚未指定授權條款，未加入LICENSE檔案。No license terms have been specified; no LICENSE file is included.
