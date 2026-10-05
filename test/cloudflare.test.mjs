import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, rmdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "../scripts/build.mjs";
import { checkReleaseOutput } from "../scripts/check.mjs";
import { CLOUDFLARE_SITE_URL } from "../scripts/cloudflare.mjs";
import { parseReleaseArgs } from "../scripts/release.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP = resolve(ROOT, "test/.tmp");
const HEADERS = [
  "/*",
  "  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: no-referrer",
  "",
  "/js/*.mjs",
  "  Content-Type: text/javascript; charset=utf-8",
  "",
].join("\n");
const REDIRECTS = [
  "/ /index.html 301",
  "/en /en/index.html 301",
  "/en/ /en/index.html 301",
  "",
].join("\n");

function contained(root, path) {
  const part = relative(root, path);
  return part !== "" && !isAbsolute(part) && part.split(sep)[0] !== "..";
}

async function fixture(action) {
  await mkdir(TEMP, { recursive: true });
  assert.equal((await lstat(TEMP)).isSymbolicLink(), false);
  const actualRoot = await realpath(ROOT);
  const actualTemp = await realpath(TEMP);
  assert.ok(contained(actualRoot, actualTemp));
  const path = await mkdtemp(resolve(TEMP, "cloudflare-"));
  try {
    await cp(resolve(ROOT, "public"), resolve(path, "public"), { recursive: true });
    await action(path);
  } finally {
    const actual = await realpath(path);
    assert.ok(contained(actualTemp, actual));
    assert.equal((await lstat(path)).isSymbolicLink(), false);
    await rm(actual, { recursive: true });
    try { await rmdir(TEMP); } catch (error) {
      if (error.code !== "ENOTEMPTY" && error.code !== "ENOENT") throw error;
    }
  }
}

const build = (path, options = {}) => buildProject({
  projectPath: path,
  check: async () => ({ ok: true }),
  ...options,
});

test("Cloudflare flags require production and the exact normalized root origin", async () => {
  assert.deepEqual(parseReleaseArgs([]), { production: false });
  assert.deepEqual(parseReleaseArgs(["--production", "--site-url", CLOUDFLARE_SITE_URL]), {
    production: true,
    siteUrl: CLOUDFLARE_SITE_URL,
  });
  assert.deepEqual(parseReleaseArgs(["--production", "--cloudflare", "--site-url", CLOUDFLARE_SITE_URL]), {
    production: true,
    siteUrl: CLOUDFLARE_SITE_URL,
    cloudflare: true,
  });
  assert.deepEqual(parseReleaseArgs(["--site-url", CLOUDFLARE_SITE_URL, "--cloudflare", "--production"]).cloudflare, true);

  for (const args of [
    ["--cloudflare"],
    ["--cloudflare", "--site-url", CLOUDFLARE_SITE_URL],
    ["--production", "--cloudflare"],
    ["--production", "--cloudflare", "--site-url", "https://date.glossquote.com"],
    ["--production", "--cloudflare", "--site-url", "https://date.glossquote.com:443/"],
    ["--production", "--cloudflare", "--site-url", "https://www.date.glossquote.com/"],
    ["--production", "--cloudflare", "--site-url", "https://date.glossquote.com/en/"],
    ["--production", "--cloudflare", "--site-url", "http://date.glossquote.com/"],
    ["--production", "--cloudflare", "--cloudflare", "--site-url", CLOUDFLARE_SITE_URL],
  ]) {
    assert.throws(() => parseReleaseArgs(args));
  }
  await assert.rejects(build("unused", { cloudflare: true }), /production mode/);
  await assert.rejects(build("unused", { production: true, cloudflare: true, siteUrl: "https://date.glossquote.com/en/" }), /requires --site-url/);
});

test("Cloudflare production emits exact hosting policy and preserves preview and ordinary production", async () => {
  await fixture(async (path) => {
    const hosting = await build(path, { production: true, cloudflare: true, siteUrl: CLOUDFLARE_SITE_URL });
    assert.equal(hosting.fileCount, 12);
    assert.equal(await readFile(resolve(hosting.outputPath, "_headers"), "utf8"), HEADERS);
    assert.equal(await readFile(resolve(hosting.outputPath, "_redirects"), "utf8"), REDIRECTS);
    assert.equal((await checkReleaseOutput(hosting.outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true })).checkedFiles, 12);
    await assert.rejects(checkReleaseOutput(hosting.outputPath, { siteUrl: CLOUDFLARE_SITE_URL }), /unsupported release file extension/);

    const ordinary = await build(path, { production: true, siteUrl: CLOUDFLARE_SITE_URL });
    assert.equal(ordinary.fileCount, 10);
    assert.equal((await checkReleaseOutput(ordinary.outputPath, { siteUrl: CLOUDFLARE_SITE_URL })).checkedFiles, 10);
    await assert.rejects(readFile(resolve(ordinary.outputPath, "_headers")), { code: "ENOENT" });

    const preview = await build(path);
    assert.equal(preview.fileCount, 8);
    await assert.rejects(readFile(resolve(preview.outputPath, "_headers")), { code: "ENOENT" });
    await assert.rejects(readFile(resolve(preview.outputPath, "_redirects")), { code: "ENOENT" });
  });
});

test("Cloudflare output checker rejects missing, changed, and extra hosting files", async () => {
  await fixture(async (path) => {
    const { outputPath } = await build(path, { production: true, cloudflare: true, siteUrl: CLOUDFLARE_SITE_URL });
    const headersPath = resolve(outputPath, "_headers");
    const redirectsPath = resolve(outputPath, "_redirects");
    await rm(headersPath);
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true }), /Missing release file: _headers/);
    await writeFile(headersPath, HEADERS);

    await writeFile(headersPath, HEADERS.replace("Referrer-Policy: no-referrer", "Referrer-Policy: unsafe-url"));
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true }), /generated Cloudflare content differs/);
    await writeFile(headersPath, HEADERS);

    await writeFile(redirectsPath, REDIRECTS.replace("/en/ /en/index.html 301", "/en/ /index.html 301"));
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true }), /generated Cloudflare content differs/);
    await writeFile(redirectsPath, REDIRECTS);

    await writeFile(resolve(outputPath, "_extra"), "unexpected\n");
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true }), /unsupported release file extension/);
    await rm(resolve(outputPath, "_extra"));

    await rm(redirectsPath);
    await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: CLOUDFLARE_SITE_URL, cloudflare: true }), /Missing release file: _redirects/);
  });
});

test("Wrangler config selects static-only production assets and an unconditional Cloudflare build", async () => {
  const config = JSON.parse(await readFile(resolve(ROOT, "wrangler.jsonc"), "utf8"));
  assert.deepEqual(Object.keys(config).sort(), [
    "assets", "build", "compatibility_date", "dependencies_instrumentation", "name", "observability",
    "preview_urls", "route", "send_metrics", "workers_dev",
  ].sort());
  assert.equal(config.name, "glossquote-date-calculator");
  assert.equal(config.compatibility_date, "2026-10-05");
  assert.equal(config.assets.directory, "./dist");
  assert.equal(config.assets.html_handling, "none");
  assert.equal(config.assets.not_found_handling, "none");
  assert.deepEqual(config.route, { pattern: "date.glossquote.com", custom_domain: true });
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.build.command, `node scripts/build.mjs --production --cloudflare --site-url ${CLOUDFLARE_SITE_URL}`);
  assert.equal(config.build.cwd, ".");
  assert.equal(config.observability.enabled, false);
  assert.equal(config.observability.logs.enabled, false);
  assert.equal(config.observability.logs.invocation_logs, false);
  assert.equal(config.observability.traces.enabled, false);
  assert.equal(config.send_metrics, false);
  assert.equal(config.dependencies_instrumentation.enabled, false);
  assert.equal(Object.hasOwn(config, "main"), false);
  assert.equal(Object.hasOwn(config.assets, "binding"), false);
});
