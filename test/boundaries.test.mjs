import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseDate,
  parseDays,
} from "../public/js/core/dates.mjs";
import {
  addDays,
  dateDifference,
} from "../public/js/core/calculator.mjs";

const MIN_DATE = "0001-01-01";
const MAX_DATE = "9999-12-31";
const MAX_ORDINAL = 3652058;

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

function expectNoRawValue(result, raw) {
  assert.equal(JSON.stringify(result).includes(raw), false);
}

test("raw length gates run before trimming and count UTF-16 code units", () => {
  assert.equal(valueOf(parseDate("2024-02-29" + " ".repeat(22))).iso, "2024-02-29");
  expectCode(parseDate("2024-02-29" + " ".repeat(23)), "DATE_TOO_LONG");
  expectCode(parseDate("2024-02-29" + "😀".repeat(11)), "DATE_FORMAT");
  expectCode(parseDate("2024-02-29" + "😀".repeat(12)), "DATE_TOO_LONG");

  assert.equal(valueOf(parseDays(" ".repeat(15) + "7")), 7);
  expectCode(parseDays(" ".repeat(16) + "7"), "DAYS_RANGE");
  expectCode(parseDays("7" + "😀".repeat(7) + " "), "DAYS_FORMAT");
  expectCode(parseDays("7" + "😀".repeat(8)), "DAYS_RANGE");
});

test("only ASCII edge whitespace is trimmed; Unicode spaces and separators stay invalid", () => {
  assert.equal(valueOf(parseDate("\t\r\n2024-02-29 ")).iso, "2024-02-29");
  assert.equal(valueOf(parseDays("\t\r\n+7 ")), 7);

  for (const separator of ["\u00a0", "\u200b", "\u2028", "\u2029"]) {
    expectCode(parseDate(separator + "2024-02-29"), "DATE_FORMAT");
    expectCode(parseDate("2024-02-29" + separator), "DATE_FORMAT");
    expectCode(parseDays(separator + "7"), "DAYS_FORMAT");
    expectCode(parseDays("7" + separator), "DAYS_FORMAT");
  }
});

test("every calculator field position rejects non-string values without coercion", () => {
  const invalidValues = [
    null,
    undefined,
    false,
    true,
    0,
    2024,
    NaN,
    Infinity,
    -Infinity,
    new String("2024-02-29"),
    new Number(1),
    1n,
    Object(1n),
  ];

  for (const invalid of invalidValues) {
    expectCode(dateDifference({ start: invalid, end: MAX_DATE }), "INVALID_REQUEST");
    expectCode(dateDifference({ start: MIN_DATE, end: invalid }), "INVALID_REQUEST");
    expectCode(addDays({ date: invalid, days: "0" }), "INVALID_REQUEST");
    expectCode(addDays({ date: MIN_DATE, days: invalid }), "INVALID_REQUEST");
  }
});

test("calculator records reject missing own fields, symbols, hidden keys, and accessors safely", () => {
  const symbol = Symbol("unknown");
  const diffSymbol = { start: MIN_DATE, end: MAX_DATE, [symbol]: true };
  const offsetSymbol = { date: MIN_DATE, days: "0", [symbol]: true };
  const diffHidden = { start: MIN_DATE, end: MAX_DATE };
  const offsetHidden = { date: MIN_DATE, days: "0" };
  Object.defineProperty(diffHidden, "hidden", { value: true });
  Object.defineProperty(offsetHidden, "hidden", { value: true });

  expectCode(dateDifference(diffSymbol), "INVALID_REQUEST");
  expectCode(addDays(offsetSymbol), "INVALID_REQUEST");
  expectCode(dateDifference(diffHidden), "INVALID_REQUEST");
  expectCode(addDays(offsetHidden), "INVALID_REQUEST");

  const inheritedStart = Object.create({ start: MIN_DATE });
  inheritedStart.end = MAX_DATE;
  const inheritedEnd = Object.create({ end: MAX_DATE });
  inheritedEnd.start = MIN_DATE;
  const inheritedDate = Object.create({ date: MIN_DATE });
  inheritedDate.days = "0";
  const inheritedDays = Object.create({ days: "0" });
  inheritedDays.date = MIN_DATE;
  for (const request of [inheritedStart, inheritedEnd, { end: MAX_DATE }, { start: MIN_DATE }]) {
    expectCode(dateDifference(request), "INVALID_REQUEST");
  }
  for (const request of [inheritedDate, inheritedDays, { days: "0" }, { date: MIN_DATE }]) {
    expectCode(addDays(request), "INVALID_REQUEST");
  }

  let getterCalls = 0;
  const accessorRequests = [
    {
      make: () => {
        const request = { end: MAX_DATE };
        Object.defineProperty(request, "start", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error("start accessor");
          },
        });
        return request;
      },
      run: dateDifference,
    },
    {
      make: () => {
        const request = { start: MIN_DATE };
        Object.defineProperty(request, "end", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error("end accessor");
          },
        });
        return request;
      },
      run: dateDifference,
    },
    {
      make: () => {
        const request = { days: "0" };
        Object.defineProperty(request, "date", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error("date accessor");
          },
        });
        return request;
      },
      run: addDays,
    },
    {
      make: () => {
        const request = { date: MIN_DATE };
        Object.defineProperty(request, "days", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error("days accessor");
          },
        });
        return request;
      },
      run: addDays,
    },
  ];

  for (const item of accessorRequests) {
    expectCode(item.run(item.make()), "INVALID_REQUEST");
  }
  assert.equal(getterCalls, 0);
});

test("throwing and revoked proxy reflection traps return INVALID_REQUEST", () => {
  const ownKeysFailure = new Proxy({}, {
    ownKeys() {
      throw new Error("ownKeys trap");
    },
  });
  const descriptorFailure = new Proxy(
    { start: MIN_DATE, end: MAX_DATE },
    {
      getOwnPropertyDescriptor() {
        throw new Error("descriptor trap");
      },
    },
  );
  const revokedDifference = Proxy.revocable({}, {});
  const revokedOffset = Proxy.revocable({}, {});
  revokedDifference.revoke();
  revokedOffset.revoke();

  expectCode(dateDifference(ownKeysFailure), "INVALID_REQUEST");
  expectCode(addDays(ownKeysFailure), "INVALID_REQUEST");
  expectCode(dateDifference(descriptorFailure), "INVALID_REQUEST");
  expectCode(dateDifference(revokedDifference.proxy), "INVALID_REQUEST");
  expectCode(addDays(revokedOffset.proxy), "INVALID_REQUEST");
});

test("HTML-shaped strings remain rejected data and are not returned in Results", () => {
  const payloads = [
    { raw: "<svg>x</svg>", dateCode: "DATE_FORMAT", daysCode: "DAYS_FORMAT" },
    { raw: "<script>x</script>", dateCode: "DATE_FORMAT", daysCode: "DAYS_RANGE" },
    {
      raw: "<svg onload='boundary-canary'></svg>",
      dateCode: "DATE_TOO_LONG",
      daysCode: "DAYS_RANGE",
    },
  ];

  for (const { raw, dateCode, daysCode } of payloads) {
    const dateResult = parseDate(raw);
    const daysResult = parseDays(raw);
    const differenceResult = dateDifference({ start: raw, end: MAX_DATE });
    const offsetDateResult = addDays({ date: raw, days: "0" });
    const offsetDaysResult = addDays({ date: MIN_DATE, days: raw });

    expectCode(dateResult, dateCode);
    expectCode(daysResult, daysCode);
    expectCode(differenceResult, dateCode);
    expectCode(offsetDateResult, dateCode);
    expectCode(offsetDaysResult, daysCode);
    for (const result of [dateResult, daysResult, differenceResult, offsetDateResult, offsetDaysResult]) {
      expectNoRawValue(result, raw);
    }
  }
});

test("maximum numeric spans work in both directions and same-date results stay exact", () => {
  assert.deepEqual(valueOf(dateDifference({ start: MIN_DATE, end: MAX_DATE })), {
    deltaDays: MAX_ORDINAL,
    inclusiveDays: MAX_ORDINAL + 1,
    direction: "forward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: MAX_DATE, end: MIN_DATE })), {
    deltaDays: -MAX_ORDINAL,
    inclusiveDays: MAX_ORDINAL + 1,
    direction: "backward",
  });
  assert.deepEqual(valueOf(dateDifference({ start: MIN_DATE, end: MIN_DATE })), {
    deltaDays: 0,
    inclusiveDays: 1,
    direction: "same",
  });
  assert.deepEqual(valueOf(dateDifference({ start: MAX_DATE, end: MAX_DATE })), {
    deltaDays: 0,
    inclusiveDays: 1,
    direction: "same",
  });
  assert.deepEqual(valueOf(addDays({ date: MIN_DATE, days: "0" })), {
    iso: MIN_DATE,
    offsetDays: 0,
  });
  assert.deepEqual(valueOf(addDays({ date: MAX_DATE, days: "0" })), {
    iso: MAX_DATE,
    offsetDays: 0,
  });
  assert.deepEqual(valueOf(addDays({ date: MIN_DATE, days: String(MAX_ORDINAL) })), {
    iso: MAX_DATE,
    offsetDays: MAX_ORDINAL,
  });
  assert.deepEqual(valueOf(addDays({ date: MAX_DATE, days: String(-MAX_ORDINAL) })), {
    iso: MIN_DATE,
    offsetDays: -MAX_ORDINAL,
  });
  expectCode(addDays({ date: MIN_DATE, days: String(-MAX_ORDINAL) }), "RESULT_RANGE");
  expectCode(addDays({ date: MAX_DATE, days: String(MAX_ORDINAL) }), "RESULT_RANGE");
});

test("core time/calendar API check is static source evidence only", async () => {
  const datesUrl = new URL("../public/js/core/dates.mjs", import.meta.url);
  const calculatorUrl = new URL("../public/js/core/calculator.mjs", import.meta.url);
  const [datesSource, calculatorSource] = await Promise.all([
    readFile(datesUrl, "utf8"),
    readFile(calculatorUrl, "utf8"),
  ]);
  const forbiddenDateApis = [
    /\bnew\s+Date\b/,
    /\bDate\s*\(/,
    /\bDate\s*\.\s*(?:parse|now|UTC)\b/,
    /\bIntl\b/,
    /\bTemporal\b/,
    /\b(?:setTimeout|setInterval)\b/,
    /\bperformance\s*\.\s*now\b/,
    /\b(?:getTimezoneOffset|toLocaleDateString|toISOString|getFullYear|getMonth|getDate)\b/,
  ];

  for (const pattern of forbiddenDateApis) {
    assert.doesNotMatch(datesSource, pattern);
    assert.doesNotMatch(calculatorSource, pattern);
  }
  assert.doesNotMatch(datesSource, /^\s*import\b/m);
  assert.deepEqual(
    [...calculatorSource.matchAll(/^\s*import\s+[^;]+?\s+from\s+["']([^"']+)["'];?$/gm)]
      .map((match) => match[1]),
    ["./dates.mjs"],
  );
});
