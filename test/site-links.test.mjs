import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, rmdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "../scripts/build.mjs";
import { runProjectCheck, checkReleaseOutput } from "../scripts/check.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP = resolve(ROOT, "test/.tmp");
const SITE = "https://date.glossquote.com/";
const HOME = "https://glossquote.com/index.html";

function inside(root, target) {
  const diff = relative(root, target);
  return diff !== "" && !isAbsolute(diff) && diff.split(sep)[0] !== "..";
}

async function fixture(action) {
  await mkdir(TEMP, { recursive: true });
  assert.equal((await lstat(TEMP)).isSymbolicLink(), false);
  assert.ok(inside(await realpath(ROOT), await realpath(TEMP)));
  const path = await mkdtemp(resolve(TEMP, "family-"));
  try {
    for (const name of ["public", "scripts", "package.json"]) {
      await cp(resolve(ROOT, name), resolve(path, name), { recursive: true });
    }
    await mkdir(resolve(path, "test"));
    await writeFile(resolve(path, "test/scaffold.test.mjs"), "export {};\n");
    await action(path);
  } finally {
    assert.equal((await lstat(path)).isSymbolicLink(), false);
    const actual = await realpath(path);
    assert.ok(inside(await realpath(TEMP), actual));
    await rm(actual, { recursive: true });
    try { await rmdir(TEMP); } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
    }
  }
}

test("both languages link to the matching home and unit tool without passing inputs", async () => {
  for (const prefix of ["", "en/"]) {
    const html = await readFile(resolve(ROOT, "public", prefix, "index.html"), "utf8");
    assert.ok(html.includes(`<a class="brand" href="https://glossquote.com/${prefix}index.html">`));
    const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes(`href="https://glossquote.com/${prefix}index.html"`));
    assert.ok(footer.includes(`href="https://units.glossquote.com/${prefix}index.html"`));
    assert.doesNotMatch(footer, /[?#]|target=|ping=/);
  }
});

test("source and release allow exact family navigation, rejecting arbitrary links and resource exceptions", async () => {
  await fixture(async (path) => {
    const sourcePage = resolve(path, "public/index.html");
    const original = await readFile(sourcePage, "utf8");
    const { outputPath } = await buildProject({ projectPath: path, production: true, cloudflare: true, siteUrl: SITE });
    await checkReleaseOutput(outputPath, { siteUrl: SITE, cloudflare: true });
    const outputPage = resolve(outputPath, "index.html");
    const production = await readFile(outputPage, "utf8");
    const mutations = [
      '<a href="https://unrelated.example/index.html">bad</a>',
      `<a href="${HOME}?value=1">bad</a>`,
      '<a href="//glossquote.com/index.html">bad</a>',
      `<script src="${HOME}"></script>`,
      `<img src="${HOME}" alt="bad">`,
      `<form action="${HOME}"></form>`,
      `<link rel="stylesheet" href="${HOME}">`,
      `<a href="${HOME}" ping="https://unrelated.example/">bad</a>`,
    ];
    for (const addition of mutations) {
      await writeFile(sourcePage, original.replace("</body>", addition + "</body>"));
      await assert.rejects(runProjectCheck(path), /not allowed|external|local reference/, addition);
      await writeFile(outputPage, production.replace("</body>", addition + "</body>"));
      await assert.rejects(checkReleaseOutput(outputPath, { siteUrl: SITE, cloudflare: true }), undefined, addition);
    }
  });
});
