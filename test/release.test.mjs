import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, rmdir, writeFile, symlink } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "../scripts/build.mjs";
import { checkReleaseOutput } from "../scripts/check.mjs";
import { parseReleaseArgs, releasePolicy } from "../scripts/release.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP = resolve(ROOT, "test/.tmp");
const SITE = "https://dates.example.invalid/";

function contained(root, path) {
  const part = relative(root, path);
  return part !== "" && !isAbsolute(part) && part.split(sep)[0] !== "..";
}

async function fixture(action) {
  await mkdir(TEMP, { recursive: true });
  assert.equal((await lstat(TEMP)).isSymbolicLink(), false);
  assert.ok(contained(await realpath(ROOT), await realpath(TEMP)));
  const path = await mkdtemp(resolve(TEMP, "release-"));
  try {
    await cp(resolve(ROOT, "public"), resolve(path, "public"), { recursive: true });
    await action(path);
  } finally {
    const actual = await realpath(path);
    assert.ok(contained(await realpath(TEMP), actual));
    assert.equal((await lstat(path)).isSymbolicLink(), false);
    await rm(actual, { recursive: true });
    try { await rmdir(TEMP); } catch (error) {
      if (error.code !== "ENOTEMPTY" && error.code !== "ENOENT") throw error;
    }
  }
}

const build = (path, options = {}) => buildProject({ projectPath: path, check: async () => ({ ok: true }), ...options });

test("production flags and URL validation fail closed", () => {
  assert.deepEqual(parseReleaseArgs([]), { production: false });
  assert.deepEqual(parseReleaseArgs(["--production", "--site-url", SITE]), { production: true, siteUrl: SITE });
  assert.equal(parseReleaseArgs(["--site-url", SITE, "--production"]).production, true);
  for (const args of [["--production"], ["--site-url", SITE], ["--production", "--unknown", SITE],
    ["--production", "--production", SITE], ["--site-url", "--production", SITE], ["--production", "--site-url", SITE, "extra"]]) {
    assert.throws(() => parseReleaseArgs(args));
  }
  for (const url of [undefined, "", "http://dates.example.invalid/", "https://a:b@dates.example.invalid/",
    "https://dates.example.invalid/?q=1", "https://dates.example.invalid/#a", "https://dates.example.invalid/../a/",
    "https://dates.example.invalid/%2e%2e/", "https://dates.example.invalid/a//b", "https://dates.example.invalid/\n",
    "https://dates.example.invalid/a&b", "https://dates.example.invalid/\"x", "https://localhost/", "//dates.example.invalid/"]) {
    assert.throws(() => releasePolicy(url), String(url));
  }
  assert.equal(releasePolicy("https://dates.example.invalid/tools/dates").base, "https://dates.example.invalid/tools/dates/");
});

test("root production emits exact bilingual URLs, sitemap and origin robots; source stays preview", async () => {
  await fixture(async (path) => {
    const result = await build(path, { production: true, siteUrl: SITE });
    assert.equal(result.fileCount, 10);
    for (const [page, lang] of [["index.html", "zh-Hant"], ["en/index.html", "en"]]) {
      const html = await readFile(resolve(result.outputPath, page), "utf8");
      assert.ok(html.includes(`<link rel="canonical" href="${SITE}${page}">`));
      assert.ok(html.includes(`<link rel="alternate" hreflang="zh-Hant" href="${SITE}index.html">`));
      assert.ok(html.includes(`<link rel="alternate" hreflang="en" href="${SITE}en/index.html">`));
      assert.ok(html.includes(`<html lang="${lang}">`));
      assert.match(html, /<meta name="robots" content="index, follow">/);
      assert.doesNotMatch(html, /noindex/);
      assert.match(await readFile(resolve(path, "public", page), "utf8"), /noindex, nofollow/);
    }
    assert.equal(await readFile(resolve(result.outputPath, "robots.txt"), "utf8"),
      `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
    const sitemap = await readFile(resolve(result.outputPath, "sitemap.xml"), "utf8");
    assert.match(sitemap, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((entry) => entry[1]), [SITE + "index.html", SITE + "en/index.html"]);
    assert.equal((await checkReleaseOutput(result.outputPath, { siteUrl: SITE })).checkedFiles, 10);
    const preview = await build(path);
    assert.equal(preview.fileCount, 8);
    assert.equal(await readFile(resolve(preview.outputPath, "index.html"), "utf8"), await readFile(resolve(path, "public/index.html"), "utf8"));
    await assert.rejects(readFile(resolve(preview.outputPath, "robots.txt")), { code: "ENOENT" });
    await assert.rejects(readFile(resolve(preview.outputPath, "sitemap.xml")), { code: "ENOENT" });
  });
});

test("subdirectory release never creates an origin robots policy", async () => {
  await fixture(async (path) => {
    const siteUrl = SITE + "tools/dates/";
    const result = await build(path, { production: true, siteUrl });
    assert.equal(result.fileCount, 9);
    assert.ok((await readFile(resolve(result.outputPath, "en/index.html"), "utf8")).includes(`href="${siteUrl}en/index.html"`));
    await assert.rejects(readFile(resolve(result.outputPath, "robots.txt")), { code: "ENOENT" });
    await writeFile(resolve(result.outputPath, "robots.txt"), "User-agent: *\nAllow: /\n");
    await assert.rejects(checkReleaseOutput(result.outputPath, { siteUrl }), /unsupported release file/);
  });
});

test("invalid release input preserves an existing dist", async () => {
  await fixture(async (path) => {
    await mkdir(resolve(path, "dist"));
    const sentinel = resolve(path, "dist/keep.txt");
    await writeFile(sentinel, "keep");
    await assert.rejects(build(path, { production: true }), /site-url/);
    await assert.rejects(build(path, { siteUrl: SITE }), /production mode/);
    const page = resolve(path, "public/index.html");
    await writeFile(page, (await readFile(page, "utf8")).replace("noindex, nofollow", "index, follow"));
    await assert.rejects(build(path, { production: true, siteUrl: SITE }), /Unexpected preview SEO/);
    assert.equal(await readFile(sentinel, "utf8"), "keep");
    const original = await readFile(resolve(ROOT, "public/index.html"), "utf8");
    for (const wrap of [(tag) => `<!--${tag}-->`, (tag) => `<title>${tag}</title>`, (tag) => `<template>${tag}</template>`]) {
      await writeFile(page, original.replace(/<meta name="robots"[^>]*>/, wrap));
      await assert.rejects(build(path, { production: true, siteUrl: SITE }), /Unexpected preview SEO|Unsupported parsing context/);
      assert.equal(await readFile(sentinel, "utf8"), "keep");
    }
  });
});

test("release checker rejects wrong, duplicate, missing, misplaced or extended metadata", async () => {
  await fixture(async (path) => {
    const { outputPath } = await build(path, { production: true, siteUrl: SITE });
    const page = resolve(outputPath, "index.html");
    const original = await readFile(page, "utf8");
    const canonical = `<link rel="canonical" href="${SITE}index.html">`;
    const variants = [
      original.replace(canonical, canonical.replace("index.html", "en/index.html")),
      original.replace(canonical, canonical + canonical), original.replace(canonical, ""),
      original.replace(canonical, "").replace("<body>", "<body>" + canonical),
      original.replace(canonical, canonical.replace(">", ' onclick="bad()">')),
      original.replace(canonical, `<!--${canonical}-->`),
      original.replace(canonical, `<title>${canonical}</title>`),
      original.replace(canonical, `<template>${canonical}</template>`),
      original.replace("index, follow", "noindex, nofollow"),
      original.replace(`hreflang="en" href="${SITE}en/index.html"`, 'hreflang="en" href="./en/index.html"'),
    ];
    for (const changed of variants) {
      await writeFile(page, changed);
      await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }), /SEO metadata|inline execution|Unsupported parsing context/);
    }
  });
});

test("SEO allowance does not permit external assets, arbitrary text/XML, inline scripts or unsafe paths", async () => {
  await fixture(async (path) => {
    const { outputPath } = await build(path, { production: true, siteUrl: SITE });
    const page = resolve(outputPath, "index.html");
    const original = await readFile(page, "utf8");
    for (const markup of ['<script src="https://other.example.invalid/a.mjs"></script>',
      '<link rel="stylesheet" href="https://other.example.invalid/a.css">',
      `<a href="${SITE}index.html">link</a>`, '<script type="application/ld+json">{}</script>']) {
      await writeFile(page, original.replace("</body>", markup + "</body>"));
      await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }), /external or non-file|inline scripts/);
    }
    await writeFile(page, original);
    for (const name of ["extra.xml", "extra.txt", "en/robots.txt", ".hidden.html"]) {
      const target = resolve(outputPath, name);
      await writeFile(target, "unexpected");
      await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }));
      await rm(target);
    }
    const sitemapPath = resolve(outputPath, "sitemap.xml");
    const sitemap = await readFile(sitemapPath, "utf8");
    await writeFile(sitemapPath, sitemap.replace("en/index.html", "missing.html"));
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }), /SEO content differs/);
    await rm(sitemapPath);
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }), /Missing release file/);
    await writeFile(sitemapPath, sitemap);
    await symlink(resolve(path, "public"), resolve(outputPath, "escape"), "junction");
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE }), /regular, visible/);
  });
});
