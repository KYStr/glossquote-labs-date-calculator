import assert from "node:assert/strict";
import test from "node:test";

import { getMessages } from "../public/js/i18n.mjs";

const ERROR_CODES = [
  "DATE_TOO_LONG",
  "DATE_FORMAT",
  "DATE_RANGE",
  "INVALID_DATE",
  "DAYS_FORMAT",
  "DAYS_RANGE",
  "RESULT_RANGE",
  "INVALID_REQUEST",
];

function keysAtEveryLevel(value) {
  if (value === null || typeof value !== "object") {
    return typeof value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, keysAtEveryLevel(value[key])]),
  );
}

function placeholders(value) {
  return [...value.matchAll(/\{([^{}]+)\}/g)]
    .map((match) => match[1])
    .sort();
}

function assertDeeplyFrozen(value, path = "messages") {
  assert.equal(Object.isFrozen(value), true, path + " must be frozen");
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      assertDeeplyFrozen(value[key], path + "." + String(key));
    }
  }
}

function assertPlaceholderParity(zh, en, path = "messages") {
  if (typeof zh === "string") {
    assert.equal(typeof en, "string", path + " must be a string in both locales");
    assert.deepEqual(placeholders(zh), placeholders(en), path + " placeholders differ");
    return;
  }

  for (const key of Object.keys(zh)) {
    assertPlaceholderParity(zh[key], en[key], path + "." + key);
  }
}

test("both language dictionaries have the same nested key shape", () => {
  assert.deepEqual(
    keysAtEveryLevel(getMessages("zh-Hant")),
    keysAtEveryLevel(getMessages("en")),
  );
});

test("both dictionaries are deeply frozen", () => {
  assertDeeplyFrozen(getMessages("zh-Hant"), "zh-Hant");
  assertDeeplyFrozen(getMessages("en"), "en");
});

test("all fixed parser and calculator error codes have localized messages", () => {
  const zh = getMessages("zh-Hant");
  const en = getMessages("en");

  assert.deepEqual(Object.keys(zh.errors).sort(), [...ERROR_CODES].sort());
  assert.deepEqual(Object.keys(en.errors).sort(), [...ERROR_CODES].sort());
  assert.equal(Object.hasOwn(zh.errors, "EMPTY"), false);
  assert.equal(Object.hasOwn(en.errors, "EMPTY"), false);
  for (const code of ERROR_CODES) {
    assert.equal(typeof zh.errors[code], "string");
    assert.ok(zh.errors[code].length > 0);
    assert.equal(typeof en.errors[code], "string");
    assert.ok(en.errors[code].length > 0);
  }
});

test("required status placeholders match across locales and stay explicit", () => {
  const zh = getMessages("zh-Hant");
  const en = getMessages("en");

  assert.deepEqual(placeholders(zh.status.diff), ["delta", "inclusive"]);
  assert.deepEqual(placeholders(en.status.diff), ["delta", "inclusive"]);
  assert.deepEqual(placeholders(zh.status.offset), ["iso"]);
  assert.deepEqual(placeholders(en.status.offset), ["iso"]);
  assertPlaceholderParity(zh, en);
});

test("empty prompts, directions, and offset rule are present in both locales", () => {
  for (const lang of ["zh-Hant", "en"]) {
    const messages = getMessages(lang);
    assert.equal(typeof messages.empty.diff, "string");
    assert.equal(typeof messages.empty.offset, "string");
    assert.equal(typeof messages.direction.forward, "string");
    assert.equal(typeof messages.direction.backward, "string");
    assert.equal(typeof messages.direction.same, "string");
    assert.equal(typeof messages.offsetRule, "string");
    assert.ok(messages.offsetRule.length > 0);
  }
});

test("unknown locale inputs use the fixed default language dictionary", () => {
  const defaultMessages = getMessages("zh-Hant");
  for (const unknown of ["fr", "ZH-hant", "", undefined, null, new String("en")]) {
    assert.strictEqual(getMessages(unknown), defaultMessages);
  }
  assert.strictEqual(getMessages("en"), getMessages("en"));
});
