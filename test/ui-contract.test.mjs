import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const zhHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const enHtml = readFileSync(new URL("../public/en/index.html", import.meta.url), "utf8");
const pages = [
  { html: zhHtml, lang: "zh-Hant", otherLang: "en", selfHref: "./index.html", otherHref: "./en/index.html", selfName: "繁體中文", otherName: "English" },
  { html: enHtml, lang: "en", otherLang: "zh-Hant", selfHref: "./index.html", otherHref: "../index.html", selfName: "English", otherName: "繁體中文" },
];

function allIds(html) {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
}

function tagForId(html, id) {
  const matches = [...html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/gi)].filter((match) => match[1] === id);
  assert.equal(matches.length, 1, `expected exactly one element with id="${id}"`);
  return matches[0][0];
}

function attribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valueMatch = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (valueMatch) return valueMatch[1] ?? valueMatch[2] ?? valueMatch[3];
  const booleanMatch = tag.match(new RegExp(`\\s${escapedName}(?=\\s|/?>)`, "i"));
  return booleanMatch ? "" : undefined;
}

function elementContents(html, id) {
  const openTag = tagForId(html, id);
  const name = openTag.match(/^<([a-z][\w:-]*)/i)?.[1];
  assert.ok(name, `could not read tag name for ${id}`);
  const openIndex = html.indexOf(openTag);
  const contentStart = openIndex + openTag.length;
  const closeIndex = html.indexOf(`</${name}>`, contentStart);
  assert.notEqual(closeIndex, -1, `expected closing ${name} tag for ${id}`);
  return html.slice(contentStart, closeIndex).trim();
}

function assertInsideOuterControls(html, id) {
  const controlsTag = tagForId(html, "calculator-controls");
  const controlsOpen = html.indexOf(controlsTag);
  const tokens = [...html.matchAll(/<\/?fieldset\b[^>]*>/gi)].filter((match) => match.index >= controlsOpen);
  let depth = 0;
  let controlsEnd = -1;
  for (const token of tokens) {
    if (/^<fieldset\b/i.test(token[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) {
      controlsEnd = token.index + token[0].length;
      break;
    }
  }
  assert.notEqual(controlsEnd, -1, "calculator-controls must have a closing fieldset");
  const targetIndex = html.indexOf(tagForId(html, id));
  assert.ok(targetIndex > controlsOpen && targetIndex < controlsEnd, `${id} must remain inside calculator-controls`);
}

const hooks = {
  "page-title": "h1",
  "date-form": "form",
  "calculator-controls": "fieldset",
  "mode-diff": "input",
  "mode-offset": "input",
  "diff-panel": "section",
  "offset-panel": "section",
  "date-start": "input",
  "date-end": "input",
  "date-base": "input",
  "day-offset": "input",
  "start-help": "p",
  "start-error": "p",
  "end-help": "p",
  "end-error": "p",
  "base-help": "p",
  "base-error": "p",
  "days-help": "p",
  "days-error": "p",
  "swap-dates": "button",
  "diff-results": "section",
  "diff-result": "output",
  "inclusive-result": "output",
  "offset-results": "section",
  "date-result": "output",
  "result-note": "p",
  "clear-input": "button",
  "calculation-status": "p",
  "unsupported-note": "p",
};

test("the bilingual source pages expose the same unique fixed DOM IDs", () => {
  const zhIds = allIds(zhHtml);
  const enIds = allIds(enHtml);
  assert.equal(new Set(zhIds).size, zhIds.length, "Traditional Chinese page has duplicate IDs");
  assert.equal(new Set(enIds).size, enIds.length, "English page has duplicate IDs");
  assert.deepEqual([...enIds].sort(), [...zhIds].sort(), "both languages must keep the same ID set");

  for (const { html } of pages) {
    for (const [id, expectedTag] of Object.entries(hooks)) {
      const tag = tagForId(html, id);
      assert.match(tag, new RegExp(`^<${expectedTag}\\b`, "i"), `${id} must be a ${expectedTag}`);
    }
  }
});

test("form hooks, modes, panels, date bounds, and reload defaults match the contract", () => {
  for (const { html } of pages) {
    const root = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
    assert.equal(attribute(root, "lang"), html === zhHtml ? "zh-Hant" : "en");

    const form = tagForId(html, "date-form");
    assert.equal(attribute(form, "novalidate"), "", "the app owns form validation");

    const controls = tagForId(html, "calculator-controls");
    assert.equal(attribute(controls, "disabled"), "", "work controls start disabled until the app is ready");

    for (const [id, value, checked] of [["mode-diff", "diff", true], ["mode-offset", "offset", false]]) {
      const radio = tagForId(html, id);
      assert.equal(attribute(radio, "type"), "radio");
      assert.equal(attribute(radio, "name"), "calculation-mode");
      assert.equal(attribute(radio, "value"), value);
      assert.equal(attribute(radio, "checked") !== undefined, checked);
      assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"[^>]*>[\\s\\S]*?<input\\b[^>]*id="${id}"`, "i"), `${id} must have a visible wrapping label`);
      assertInsideOuterControls(html, id);
    }

    for (const [id, hidden] of [["diff-panel", false], ["diff-results", false], ["offset-panel", true], ["offset-results", true]]) {
      const tag = tagForId(html, id);
      assert.equal(attribute(tag, "hidden") !== undefined, hidden, `${id} initial hidden state`);
      assertInsideOuterControls(html, id);
    }

    for (const [dateId, helpId] of [["date-start", "start-help"], ["date-end", "end-help"], ["date-base", "base-help"]]) {
      const date = tagForId(html, dateId);
      assert.equal(attribute(date, "type"), "date");
      assert.equal(attribute(date, "min"), "0001-01-01");
      assert.equal(attribute(date, "max"), "9999-12-31");
      assert.equal(attribute(date, "value"), undefined, `${dateId} must start empty`);
      assert.equal(attribute(date, "maxlength"), undefined, `${dateId} must not truncate input`);
      assert.ok(attribute(date, "aria-describedby").split(/\s+/).includes(helpId), `${dateId} must reference its help`);
      assert.match(html, new RegExp(`<label\\b[^>]*for="${dateId}"`, "i"), `${dateId} must have a visible label`);
      assertInsideOuterControls(html, dateId);

      const errorId = helpId.replace("-help", "-error");
      const error = tagForId(html, errorId);
      assert.equal(attribute(error, "hidden"), "", `${errorId} starts hidden`);
      assert.equal(elementContents(html, errorId), "", `${errorId} starts empty`);
    }

    const dayOffset = tagForId(html, "day-offset");
    assert.equal(attribute(dayOffset, "type"), "text");
    assert.equal(attribute(dayOffset, "inputmode"), "text");
    assert.equal(attribute(dayOffset, "value"), "0");
    assert.equal(attribute(dayOffset, "maxlength"), undefined, "the core must see the original day string");
    assert.ok(attribute(dayOffset, "aria-describedby").split(/\s+/).includes("days-help"));
    assert.match(html, /<label\b[^>]*for="day-offset"/i);
    assertInsideOuterControls(html, "day-offset");
    assert.equal(attribute(tagForId(html, "days-error"), "hidden"), "");
    assert.equal(elementContents(html, "days-error"), "");

    assert.equal(attribute(tagForId(html, "swap-dates"), "type"), "button");
    assert.equal(attribute(tagForId(html, "clear-input"), "type"), "button");
    assertInsideOuterControls(html, "swap-dates");
    assertInsideOuterControls(html, "clear-input");

    for (const [id, labelId] of [["diff-result", "diff-result-label"], ["inclusive-result", "inclusive-result-label"], ["date-result", "offset-results-title"]]) {
      const output = tagForId(html, id);
      assert.equal(attribute(output, "aria-live"), "off");
      assert.equal(attribute(output, "aria-labelledby"), labelId);
      assert.equal(elementContents(html, id), "—");
      assertInsideOuterControls(html, id);
    }

    const status = tagForId(html, "calculation-status");
    assert.equal(attribute(status, "role"), "status");
    assert.equal(attribute(status, "aria-live"), "polite");
    assert.equal(attribute(status, "aria-atomic"), "true");
    assert.equal(elementContents(html, "calculation-status"), "");
    assert.equal(attribute(tagForId(html, "unsupported-note"), "hidden"), undefined);
    assert.match(html, /<noscript\b[\s\S]*?(?:JavaScript|javascript)[\s\S]*?<\/noscript>/i);
  }
});

test("static page metadata, privacy copy, FAQ content, and language links stay local and truthful", () => {
  for (const page of pages) {
    const { html, lang, otherLang, selfHref, otherHref, selfName, otherName } = page;
    const root = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
    assert.equal(attribute(root, "lang"), lang);
    assert.match(html, /<title>[^<]+<\/title>/i);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/i);
    assert.match(html, /<meta\s+name="robots"\s+content="noindex, nofollow"/i);
    assert.match(html, /<meta\s+name="referrer"\s+content="no-referrer"/i);
    assert.doesNotMatch(html, /<link\b[^>]*\brel="canonical"/i);
    const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] ?? "";
    for (const directive of [
      /(?:^|;)\s*default-src 'self'(?:;|$)/,
      /(?:^|;)\s*script-src 'self'(?:;|$)/,
      /(?:^|;)\s*style-src 'self'(?:;|$)/,
      /(?:^|;)\s*connect-src 'none'(?:;|$)/,
      /(?:^|;)\s*form-action 'none'(?:;|$)/,
      /(?:^|;)\s*object-src 'none'(?:;|$)/,
      /(?:^|;)\s*base-uri 'none'(?:;|$)/,
    ]) assert.match(csp, directive);

    const headAlternates = [...html.matchAll(/<link\b[^>]*\brel="alternate"[^>]*>/gi)].map((match) => match[0]);
    assert.ok(headAlternates.some((tag) => attribute(tag, "hreflang") === otherLang && attribute(tag, "href") === otherHref), "head alternate points to the other local language page");

    const anchors = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({ tag: match[0].slice(0, match[0].indexOf(">") + 1), text: match[1].replace(/<[^>]+>/g, "").trim() }));
    assert.ok(anchors.some(({ tag, text }) => attribute(tag, "href") === selfHref && attribute(tag, "hreflang") === lang && attribute(tag, "aria-current") === "page" && text === selfName), "language bar visibly identifies the current language");
    assert.ok(anchors.some(({ tag, text }) => attribute(tag, "href") === otherHref && attribute(tag, "hreflang") === otherLang && attribute(tag, "rel") === "alternate" && text === otherName), "language bar links to the other language with an explicit reset warning");
    assert.match(html, /切換語言會清空日期與計算結果|Changing language clears dates and results\./);

    const faqCount = (html.match(/<details\b/gi) ?? []).length;
    assert.ok(faqCount >= 5, `expected at least five FAQ entries, found ${faqCount}`);
    assert.match(html, /0001-01-01[\s\S]*9999-12-31/);
    assert.match(html, /<(?:section|div)\b[^>]*class="[^"]*rules-section[^"]*"[\s\S]*?(?:不會送出或儲存|not sent or stored)[\s\S]*?(?:不追蹤|does not track)/i);
    assert.match(html, /<h1\b[^>]*id="page-title"[^>]*>[^<]+<\/h1>/i);

    const scriptBlocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    assert.equal(scriptBlocks.length, 1);
    assert.equal(attribute(`<script ${scriptBlocks[0][1]}>`, "type"), "module");
    assert.ok(attribute(`<script ${scriptBlocks[0][1]}>`, "src").startsWith("./") || attribute(`<script ${scriptBlocks[0][1]}>`, "src").startsWith("../"));
    assert.equal(scriptBlocks[0][2].trim(), "", "the page has no inline script");
    const familyNavigation = /<a\b[^>]*href="https:\/\/(?:glossquote\.com|units\.glossquote\.com)\/(?:en\/)?index\.html"[^>]*>/g;
    assert.equal([...html.matchAll(familyNavigation)].length, 3, "brand and footer expose only the three expected family anchors");
    assert.doesNotMatch(html.replace(familyNavigation, ""), /https?:\/\//i, "no remote resources or other external links are declared");
    assert.doesNotMatch(html, /\s+on[a-z]+\s*=/i, "no inline event handler attributes");
    assert.doesNotMatch(html, /\bmaxlength\s*=/i, "inputs must not silently truncate source text");
  }
});
