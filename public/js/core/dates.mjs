const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MAX_ORDINAL = 3652058;
const ASCII_WHITESPACE = "\t\n\r ";
const PART_FIELDS = ["year", "month", "day"];

function error(code) {
  return { ok: false, code };
}

function success(value) {
  return { ok: true, value };
}

function trimAsciiWhitespace(value) {
  let start = 0;
  let end = value.length;

  while (start < end && ASCII_WHITESPACE.includes(value[start])) {
    start += 1;
  }

  while (end > start && ASCII_WHITESPACE.includes(value[end - 1])) {
    end -= 1;
  }

  return value.slice(start, end);
}

function readExactDataFields(record, expectedFields) {
  try {
    if (record === null || typeof record !== "object") {
      return null;
    }

    const keys = Reflect.ownKeys(record);
    if (keys.length !== expectedFields.length) {
      return null;
    }

    const expected = new Set(expectedFields);
    const values = Object.create(null);

    for (const key of keys) {
      if (typeof key !== "string" || !expected.has(key)) {
        return null;
      }

      const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }

      values[key] = descriptor.value;
    }

    return values;
  } catch {
    return null;
  }
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
}

function daysBeforeYear(year) {
  const priorYear = year - 1;
  return (
    365 * priorYear +
    Math.floor(priorYear / 4) -
    Math.floor(priorYear / 100) +
    Math.floor(priorYear / 400)
  );
}

function ordinalFromParts({ year, month, day }) {
  let ordinal = daysBeforeYear(year);
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    ordinal += daysInMonth(year, currentMonth);
  }
  return ordinal + day - 1;
}

function validateParts(parts) {
  const values = readExactDataFields(parts, PART_FIELDS);
  if (values === null) {
    return error("INVALID_REQUEST");
  }

  const { year, month, day } = values;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return error("INVALID_REQUEST");
  }

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return error("DATE_RANGE");
  }

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return error("INVALID_DATE");
  }

  return success({ year, month, day });
}

function formatValidatedDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDate(raw) {
  if (typeof raw !== "string") {
    return error("DATE_FORMAT");
  }

  if (raw.length > 32) {
    return error("DATE_TOO_LONG");
  }

  const text = trimAsciiWhitespace(raw);
  if (text.length === 0) {
    return error("EMPTY");
  }

  const match = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.exec(text);
  if (text.length !== 10 || match === null || match[0].length !== text.length) {
    return error("DATE_FORMAT");
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return error("DATE_RANGE");
  }

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return error("INVALID_DATE");
  }

  return success({
    year,
    month,
    day,
    ordinal: ordinalFromParts({ year, month, day }),
    iso: formatValidatedDate({ year, month, day }),
  });
}

export function parseDays(raw) {
  if (typeof raw !== "string") {
    return error("DAYS_FORMAT");
  }

  if (raw.length > 16) {
    return error("DAYS_RANGE");
  }

  const text = trimAsciiWhitespace(raw);
  if (text.length === 0) {
    return error("EMPTY");
  }

  const match = /^[+-]?[0-9]{1,7}$/.exec(text);
  if (match === null || match[0].length !== text.length) {
    return error("DAYS_FORMAT");
  }

  const days = Number(text);
  if (!Number.isSafeInteger(days) || days < -MAX_ORDINAL || days > MAX_ORDINAL) {
    return error("DAYS_RANGE");
  }

  return success(Object.is(days, -0) ? 0 : days);
}

export function toOrdinal(parts) {
  const validated = validateParts(parts);
  if (!validated.ok) {
    return validated;
  }

  return success(ordinalFromParts(validated.value));
}

export function fromOrdinal(ordinal) {
  if (
    !Number.isSafeInteger(ordinal) ||
    ordinal < 0 ||
    ordinal > MAX_ORDINAL
  ) {
    return error("DATE_RANGE");
  }

  let low = MIN_YEAR;
  let high = MAX_YEAR;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (daysBeforeYear(middle) <= ordinal) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  let remaining = ordinal - daysBeforeYear(low);
  let month = 1;
  while (month <= 12) {
    const monthLength = daysInMonth(low, month);
    if (remaining < monthLength) {
      break;
    }
    remaining -= monthLength;
    month += 1;
  }

  return success({ year: low, month, day: remaining + 1 });
}

export function formatDate(parts) {
  const validated = validateParts(parts);
  if (!validated.ok) {
    return validated;
  }

  return success(formatValidatedDate(validated.value));
}
