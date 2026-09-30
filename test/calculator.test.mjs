import assert from "node:assert/strict";
import test from "node:test";

import { addDays, dateDifference } from "../public/js/core/calculator.mjs";

function valueOf(result) {
  assert.equal(result?.ok, true);
  assert.deepEqual(Object.keys(result).sort(), ["ok", "value"]);
  return result.value;
}

function expectCode(result, code) {
  assert.equal(result?.ok, false);
  assert.deepEqual(Object.keys(result).sort(), ["code", "ok"]);
  assert.equal(result.code, code);
}

test("D06-D10: difference returns a signed distance and positive inclusive count", () => {
  assert.deepEqual(valueOf(dateDifference({ start: "2024-02-28", end: "2024-03-01" })), {
    deltaDays: 2,
    inclusiveDays: 3,
    direction: "forward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: "2023-02-28", end: "2023-03-01" })), {
    deltaDays: 1,
    inclusiveDays: 2,
    direction: "forward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: "2024-03-01", end: "2024-02-28" })), {
    deltaDays: -2,
    inclusiveDays: 3,
    direction: "backward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: "2026-09-23", end: "2026-09-23" })), {
    deltaDays: 0,
    inclusiveDays: 1,
    direction: "same",
  });
  assert.deepEqual(valueOf(dateDifference({ start: "0001-01-01", end: "9999-12-31" })), {
    deltaDays: 3652058,
    inclusiveDays: 3652059,
    direction: "forward",
  });
});

test("D11-D13: adding days crosses leap years and fails closed at result endpoints", () => {
  assert.deepEqual(valueOf(addDays({ date: "2024-02-28", days: "1" })), {
    iso: "2024-02-29",
    offsetDays: 1,
  });
  assert.deepEqual(valueOf(addDays({ date: "2024-03-01", days: "-1" })), {
    iso: "2024-02-29",
    offsetDays: -1,
  });
  assert.deepEqual(valueOf(addDays({ date: "2023-12-31", days: "1" })), {
    iso: "2024-01-01",
    offsetDays: 1,
  });
  assert.deepEqual(valueOf(addDays({ date: "2024-01-01", days: "-1" })), {
    iso: "2023-12-31",
    offsetDays: -1,
  });
  assert.deepEqual(valueOf(addDays({ date: "2024-02-29", days: "0" })), {
    iso: "2024-02-29",
    offsetDays: 0,
  });
  expectCode(addDays({ date: "0001-01-01", days: "-1" }), "RESULT_RANGE");
  expectCode(addDays({ date: "9999-12-31", days: "1" }), "RESULT_RANGE");
});

test("D16: seasonal-transition dates differ by one calendar day without time arithmetic", () => {
  assert.deepEqual(valueOf(dateDifference({ start: "2024-03-10", end: "2024-03-11" })), {
    deltaDays: 1,
    inclusiveDays: 2,
    direction: "forward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: "2024-11-03", end: "2024-11-04" })), {
    deltaDays: 1,
    inclusiveDays: 2,
    direction: "forward",
  });
});

test("calculation errors preserve parser codes and inspect fields in visual order", () => {
  expectCode(dateDifference({ start: "bad", end: "2024-02-30" }), "DATE_FORMAT");
  expectCode(dateDifference({ start: "0000-01-01", end: "bad" }), "DATE_RANGE");
  expectCode(addDays({ date: "bad", days: "1.5" }), "DATE_FORMAT");
  expectCode(addDays({ date: "2024-01-01", days: "1.5" }), "DAYS_FORMAT");
  expectCode(addDays({ date: "2024-01-01", days: "3652059" }), "DAYS_RANGE");
});

test("D15: difference and offset accept only exact own data-field records", () => {
  const validDifference = { start: "2024-02-28", end: "2024-03-01" };
  const validOffset = { date: "2024-02-28", days: "1" };

  const extraString = { ...validDifference, extra: true };
  const extraSymbol = { ...validDifference, [Symbol("extra")]: true };
  const extraHidden = { ...validDifference };
  Object.defineProperty(extraHidden, "hidden", { value: true });
  const extraOffsetSymbol = { ...validOffset, [Symbol("extra")]: true };
  const extraOffsetHidden = { ...validOffset };
  Object.defineProperty(extraOffsetHidden, "hidden", { value: true });

  for (const input of [null, undefined, [], "2024-02-28", {}, { start: "2024-02-28" }, extraString, extraSymbol, extraHidden]) {
    expectCode(dateDifference(input), "INVALID_REQUEST");
  }
  for (const input of [null, undefined, [], "2024-02-28", {}, { date: "2024-02-28" }, extraOffsetSymbol, extraOffsetHidden]) {
    expectCode(addDays(input), "INVALID_REQUEST");
  }

  const inheritedStart = Object.create({ start: "2024-02-28" });
  inheritedStart.end = "2024-03-01";
  const inheritedDate = Object.create({ date: "2024-02-28" });
  inheritedDate.days = "1";
  expectCode(dateDifference(inheritedStart), "INVALID_REQUEST");
  expectCode(addDays(inheritedDate), "INVALID_REQUEST");

  let getterCalls = 0;
  const accessorDifference = { end: "2024-03-01" };
  Object.defineProperty(accessorDifference, "start", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("start getter must not run");
    },
  });
  const accessorOffset = { days: "1" };
  Object.defineProperty(accessorOffset, "date", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("date getter must not run");
    },
  });
  expectCode(dateDifference(accessorDifference), "INVALID_REQUEST");
  expectCode(addDays(accessorOffset), "INVALID_REQUEST");
  assert.equal(getterCalls, 0);
});

test("calculation inputs are unchanged and value types are not coerced", () => {
  const differenceInput = { start: "2024-02-28", end: "2024-03-01" };
  const offsetInput = { date: "2024-02-28", days: "+1" };
  const differenceBefore = { ...differenceInput };
  const offsetBefore = { ...offsetInput };

  assert.equal(valueOf(dateDifference(differenceInput)).deltaDays, 2);
  assert.equal(valueOf(addDays(offsetInput)).iso, "2024-02-29");
  assert.deepEqual(differenceInput, differenceBefore);
  assert.deepEqual(offsetInput, offsetBefore);

  expectCode(dateDifference({ start: new String("2024-02-28"), end: "2024-03-01" }), "INVALID_REQUEST");
  expectCode(addDays({ date: "2024-02-28", days: new String("1") }), "INVALID_REQUEST");
});
