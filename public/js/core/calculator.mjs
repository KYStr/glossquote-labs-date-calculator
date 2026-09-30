import { formatDate, fromOrdinal, parseDate, parseDays } from "./dates.mjs";

const MAX_ORDINAL = 3652058;

function error(code) {
  return { ok: false, code };
}

function success(value) {
  return { ok: true, value };
}

function readExactStringFields(request, expectedFields) {
  try {
    if (request === null || typeof request !== "object") {
      return null;
    }

    const keys = Reflect.ownKeys(request);
    if (keys.length !== expectedFields.length) {
      return null;
    }

    const expected = new Set(expectedFields);
    const values = Object.create(null);

    for (const key of keys) {
      if (typeof key !== "string" || !expected.has(key)) {
        return null;
      }

      const descriptor = Reflect.getOwnPropertyDescriptor(request, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        typeof descriptor.value !== "string"
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

export function dateDifference(request) {
  const fields = readExactStringFields(request, ["start", "end"]);
  if (fields === null) {
    return error("INVALID_REQUEST");
  }

  const start = parseDate(fields.start);
  if (!start.ok) {
    return start;
  }

  const end = parseDate(fields.end);
  if (!end.ok) {
    return end;
  }

  const deltaDays = end.value.ordinal - start.value.ordinal;
  return success({
    deltaDays,
    inclusiveDays: Math.abs(deltaDays) + 1,
    direction:
      deltaDays > 0 ? "forward" : deltaDays < 0 ? "backward" : "same",
  });
}

export function addDays(request) {
  const fields = readExactStringFields(request, ["date", "days"]);
  if (fields === null) {
    return error("INVALID_REQUEST");
  }

  const date = parseDate(fields.date);
  if (!date.ok) {
    return date;
  }

  const days = parseDays(fields.days);
  if (!days.ok) {
    return days;
  }

  const ordinal = date.value.ordinal + days.value;
  if (ordinal < 0 || ordinal > MAX_ORDINAL) {
    return error("RESULT_RANGE");
  }

  const converted = fromOrdinal(ordinal);
  if (!converted.ok) {
    return error("RESULT_RANGE");
  }

  const formatted = formatDate(converted.value);
  if (!formatted.ok) {
    return error("RESULT_RANGE");
  }

  return success({ iso: formatted.value, offsetDays: days.value });
}
