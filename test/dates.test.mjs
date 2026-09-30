import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDate,
  fromOrdinal,
  parseDate,
  parseDays,
  toOrdinal,
} from "../public/js/core/dates.mjs";

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

function expectParts(result, expected) {
  const parts = valueOf(result);
  assert.deepEqual(parts, expected);
  assert.deepEqual(Reflect.ownKeys(parts).sort(), ["day", "month", "year"]);
}

test("D01: supported endpoints map to their fixed ordinals and round-trip", () => {
  const first = { year: 1, month: 1, day: 1 };
  const last = { year: 9999, month: 12, day: 31 };

  assert.deepEqual(valueOf(parseDate("0001-01-01")), {
    year: 1,
    month: 1,
    day: 1,
    ordinal: 0,
    iso: "0001-01-01",
  });
  assert.deepEqual(valueOf(parseDate("9999-12-31")), {
    year: 9999,
    month: 12,
    day: 31,
    ordinal: 3652058,
    iso: "9999-12-31",
  });
  assert.equal(valueOf(toOrdinal(first)), 0);
  assert.equal(valueOf(toOrdinal(last)), 3652058);
  expectParts(fromOrdinal(0), first);
  expectParts(fromOrdinal(3652058), last);
});

test("D02-D05: strict date parsing, calendar validity, and exact error codes", () => {
  expectCode(parseDate("1900-02-29"), "INVALID_DATE");
  assert.deepEqual(valueOf(parseDate("2000-02-29")), {
    year: 2000,
    month: 2,
    day: 29,
    ordinal: 730178,
    iso: "2000-02-29",
  });
  expectCode(parseDate("2100-02-29"), "INVALID_DATE");

  expectCode(parseDate("2024-02-30"), "INVALID_DATE");
  expectCode(parseDate("2024-04-31"), "INVALID_DATE");
  expectCode(parseDate("2024-13-01"), "INVALID_DATE");
  expectCode(parseDate("2024-00-01"), "INVALID_DATE");
  expectCode(parseDate("2024-01-00"), "INVALID_DATE");
  expectCode(parseDate("2024-01-32"), "INVALID_DATE");

  expectCode(parseDate("0000-01-01"), "DATE_RANGE");
  expectCode(parseDate("10000-01-01"), "DATE_FORMAT");
  expectCode(parseDate("2024-2-09"), "DATE_FORMAT");
  expectCode(parseDate("２０２４-02-29"), "DATE_FORMAT");
  expectCode(parseDate("٢٠٢٤-٠٢-٢٩"), "DATE_FORMAT");

  assert.equal(valueOf(parseDate(" 2024-02-29 ")).iso, "2024-02-29");
  assert.equal(valueOf(parseDate("\t\n2024-02-29\r ")).ordinal, 738944);
  expectCode(parseDate(""), "EMPTY");
  expectCode(parseDate(" \t\r\n "), "EMPTY");
  expectCode(parseDate("0".repeat(33)), "DATE_TOO_LONG");
  expectCode(parseDate("2024-02-29\u00a0"), "DATE_FORMAT");
  expectCode(parseDate("\u00a02024-02-29"), "DATE_FORMAT");
  expectCode(parseDate("2024-02-29\u2028"), "DATE_FORMAT");
  expectCode(parseDate("2024-02-29\u2029"), "DATE_FORMAT");

  expectCode(parseDate(null), "DATE_FORMAT");
  expectCode(parseDate(undefined), "DATE_FORMAT");
  expectCode(parseDate(20240229), "DATE_FORMAT");
  expectCode(parseDate(new String("2024-02-29")), "DATE_FORMAT");

  // The raw UTF-16 limit is checked before ASCII trimming and parsing.
  assert.equal(valueOf(parseDate("2024-02-29" + " ".repeat(22))).iso, "2024-02-29");
  expectCode(parseDate("2024-02-29" + " ".repeat(23)), "DATE_TOO_LONG");
  expectCode(parseDate("2024-02-29" + "😀".repeat(11)), "DATE_FORMAT");
  expectCode(parseDate("2024-02-29" + "😀".repeat(12)), "DATE_TOO_LONG");
});

test("toOrdinal and formatDate enforce exact own data-field schemas", () => {
  const good = { year: 2024, month: 2, day: 29 };
  assert.equal(valueOf(toOrdinal(good)), 738944);
  assert.equal(valueOf(formatDate(good)), "2024-02-29");
  assert.equal(valueOf(formatDate({ year: 1, month: 1, day: 1 })), "0001-01-01");

  const extraString = { ...good, extra: true };
  const extraSymbol = { ...good, [Symbol("extra")]: true };
  const extraHidden = { ...good };
  Object.defineProperty(extraHidden, "hidden", { value: true });
  const inheritedYear = Object.create({ year: 2024 });
  inheritedYear.month = 2;
  inheritedYear.day = 29;

  for (const input of [null, undefined, [], "2024-02-29", {}, { year: 2024, month: 2 }, extraString, extraSymbol, extraHidden, inheritedYear]) {
    expectCode(toOrdinal(input), "INVALID_REQUEST");
    expectCode(formatDate(input), "INVALID_REQUEST");
  }

  let getterCalls = 0;
  const accessor = { month: 2, day: 29 };
  Object.defineProperty(accessor, "year", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("year getter must not run");
    },
  });
  expectCode(toOrdinal(accessor), "INVALID_REQUEST");
  expectCode(formatDate(accessor), "INVALID_REQUEST");
  assert.equal(getterCalls, 0);

  for (const badValue of [2024.5, NaN, Infinity, "2024", new Number(2024), null]) {
    expectCode(toOrdinal({ year: badValue, month: 2, day: 29 }), "INVALID_REQUEST");
    expectCode(formatDate({ year: badValue, month: 2, day: 29 }), "INVALID_REQUEST");
  }
  for (const [year, expected] of [[0, "DATE_RANGE"], [10000, "DATE_RANGE"]]) {
    expectCode(toOrdinal({ year, month: 1, day: 1 }), expected);
    expectCode(formatDate({ year, month: 1, day: 1 }), expected);
  }
  for (const parts of [
    { year: 2024, month: 0, day: 1 },
    { year: 2024, month: 13, day: 1 },
    { year: 2024, month: 2, day: 0 },
    { year: 2024, month: 2, day: 30 },
    { year: 1900, month: 2, day: 29 },
  ]) {
    expectCode(toOrdinal(parts), "INVALID_DATE");
    expectCode(formatDate(parts), "INVALID_DATE");
  }
  expectCode(toOrdinal({ year: 2024, month: 2.5, day: 29 }), "INVALID_REQUEST");
  expectCode(toOrdinal({ year: 2024, month: 2, day: 29.5 }), "INVALID_REQUEST");
});

test("fromOrdinal accepts only safe integer ordinals within both endpoints", () => {
  expectParts(fromOrdinal(0), { year: 1, month: 1, day: 1 });
  expectParts(fromOrdinal(730178), { year: 2000, month: 2, day: 29 });
  expectParts(fromOrdinal(3652058), { year: 9999, month: 12, day: 31 });
  expectCode(fromOrdinal(-1), "DATE_RANGE");
  expectCode(fromOrdinal(3652059), "DATE_RANGE");
  for (const invalid of [NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, "0", null, undefined, true, 1n]) {
    expectCode(fromOrdinal(invalid), "DATE_RANGE");
  }
});

test("D14-D15: day parsing uses ASCII syntax, bounded raw length, and normalized zero", () => {
  assert.equal(valueOf(parseDays("+007")), 7);
  assert.equal(valueOf(parseDays("-0")), 0);
  assert.equal(Object.is(valueOf(parseDays("-0")), -0), false);
  assert.equal(valueOf(parseDays(" \t+007\r\n ")), 7);
  assert.equal(valueOf(parseDays("3652058")), 3652058);
  assert.equal(valueOf(parseDays("-3652058")), -3652058);

  expectCode(parseDays(""), "EMPTY");
  expectCode(parseDays(" \t\r\n "), "EMPTY");
  for (const invalid of ["1.5", "1e2", "7天", "１２", "١٢", "+", "--1", "1\n2", "\u00a01\u00a0"]) {
    expectCode(parseDays(invalid), "DAYS_FORMAT");
  }
  for (const invalid of [null, undefined, NaN, Infinity, true, 7, new String("7")]) {
    expectCode(parseDays(invalid), "DAYS_FORMAT");
  }
  expectCode(parseDays("3652059"), "DAYS_RANGE");
  expectCode(parseDays("-3652059"), "DAYS_RANGE");
  expectCode(parseDays("1".repeat(17)), "DAYS_RANGE");
  expectCode(parseDays(" ".repeat(17)), "DAYS_RANGE");
});

test("D17: all 129,987 annual-start and month-end dates round-trip monotonically", () => {
  const commonYearMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let yearStartOrdinal = 0;
  let previousOrdinal = -1;
  let rows = 0;

  for (let year = 1; year <= 9999; year += 1) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const first = { year, month: 1, day: 1 };
    const actualFirst = valueOf(toOrdinal(first));
    assert.equal(actualFirst, yearStartOrdinal, "Jan 1 ordinal mismatch for year " + year);
    assert.ok(actualFirst > previousOrdinal, "Jan 1 ordinal is not increasing for year " + year);
    expectParts(fromOrdinal(actualFirst), first);
    previousOrdinal = actualFirst;
    rows += 1;

    let monthStartOrdinal = yearStartOrdinal;
    for (let month = 1; month <= 12; month += 1) {
      const monthLength = commonYearMonths[month - 1] + (month === 2 && leap ? 1 : 0);
      const expectedOrdinal = monthStartOrdinal + monthLength - 1;
      const parts = { year, month, day: monthLength };
      const actualOrdinal = valueOf(toOrdinal(parts));

      assert.equal(actualOrdinal, expectedOrdinal, "month-end ordinal mismatch at " + year + "-" + month);
      assert.ok(actualOrdinal > previousOrdinal, "month-end ordinal is not increasing at " + year + "-" + month);
      expectParts(fromOrdinal(actualOrdinal), parts);
      previousOrdinal = actualOrdinal;
      monthStartOrdinal += monthLength;
      rows += 1;
    }

    const yearLength = leap ? 366 : 365;
    assert.equal(monthStartOrdinal - yearStartOrdinal, yearLength, "calendar year length mismatch for " + year);
    assert.equal(monthStartOrdinal - actualFirst, yearLength, "ordinal year length mismatch for " + year);
    yearStartOrdinal = monthStartOrdinal;
  }

  assert.equal(rows, 129987);
  assert.equal(previousOrdinal, 3652058);
});
