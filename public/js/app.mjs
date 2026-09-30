import { addDays, dateDifference } from "./core/calculator.mjs";
import { parseDate, parseDays } from "./core/dates.mjs";
import { getMessages } from "./i18n.mjs";

const EMPTY_OUTPUT = "—";
const DATE_FIELDS = Object.freeze([
  { inputId: "date-start", helpId: "start-help", errorId: "start-error", kind: "date" },
  { inputId: "date-end", helpId: "end-help", errorId: "end-error", kind: "date" },
  { inputId: "date-base", helpId: "base-help", errorId: "base-error", kind: "date" },
  { inputId: "day-offset", helpId: "days-help", errorId: "days-error", kind: "days" },
]);

const messages = getMessages(document.documentElement.lang);
let dom = null;
let active = false;
let handlersBound = false;
let lifecycleBound = false;
let currentState = null;

function collectDom() {
  const ids = [
    "date-form", "calculator-controls", "page-title", "mode-diff", "mode-offset",
    "diff-panel", "date-start", "date-end", "swap-dates", "offset-panel",
    "date-base", "day-offset", "start-help", "start-error", "end-help", "end-error",
    "base-help", "base-error", "days-help", "days-error", "diff-results",
    "diff-result", "inclusive-result", "offset-results", "date-result", "result-note",
    "clear-input", "calculation-status", "unsupported-note",
  ];
  const elements = Object.create(null);

  for (const id of ids) {
    const element = document.getElementById(id);
    if (element === null || element.id !== id) {
      return null;
    }
    elements[id] = element;
  }

  const inputIds = [
    "mode-diff", "mode-offset", "date-start", "date-end", "date-base", "day-offset",
  ];
  if (inputIds.some((id) => elements[id].tagName !== "INPUT")) {
    return null;
  }
  if (
    elements["date-form"].tagName !== "FORM" ||
    elements["calculator-controls"].tagName !== "FIELDSET" ||
    elements["swap-dates"].tagName !== "BUTTON" ||
    elements["clear-input"].tagName !== "BUTTON" ||
    elements["diff-result"].tagName !== "OUTPUT" ||
    elements["inclusive-result"].tagName !== "OUTPUT" ||
    elements["date-result"].tagName !== "OUTPUT"
  ) {
    return null;
  }

  const fields = DATE_FIELDS.map((field) => ({
    ...field,
    input: elements[field.inputId],
    help: elements[field.helpId],
    error: elements[field.errorId],
  }));

  return {
    form: elements["date-form"],
    controls: elements["calculator-controls"],
    modeDiff: elements["mode-diff"],
    modeOffset: elements["mode-offset"],
    diffPanel: elements["diff-panel"],
    dateStart: elements["date-start"],
    dateEnd: elements["date-end"],
    swapButton: elements["swap-dates"],
    offsetPanel: elements["offset-panel"],
    dateBase: elements["date-base"],
    dayOffset: elements["day-offset"],
    fields,
    diffResults: elements["diff-results"],
    diffResult: elements["diff-result"],
    inclusiveResult: elements["inclusive-result"],
    offsetResults: elements["offset-results"],
    dateResult: elements["date-result"],
    resultNote: elements["result-note"],
    clearButton: elements["clear-input"],
    status: elements["calculation-status"],
    unsupportedNote: elements["unsupported-note"],
  };
}

function setModeVisibility(mode) {
  const showDiff = mode === "diff";
  dom.diffPanel.hidden = !showDiff;
  dom.diffResults.hidden = !showDiff;
  dom.offsetPanel.hidden = showDiff;
  dom.offsetResults.hidden = showDiff;
  dom.modeDiff.checked = showDiff;
  dom.modeOffset.checked = !showDiff;
}

function clearFieldError(field) {
  field.error.textContent = "";
  field.error.hidden = true;
  field.input.removeAttribute("aria-invalid");
  field.input.setAttribute("aria-describedby", field.helpId);
}

function clearAllFieldErrors() {
  for (const field of dom.fields) {
    clearFieldError(field);
  }
}

function showFieldError(field, code) {
  const safeCode = Object.prototype.hasOwnProperty.call(messages.errors, code)
    ? code
    : "INVALID_REQUEST";
  field.error.textContent = messages.errors[safeCode];
  field.error.hidden = false;
  field.input.setAttribute("aria-invalid", "true");
  field.input.setAttribute("aria-describedby", field.helpId + " " + field.errorId);
  return safeCode;
}

function clearResults(mode) {
  dom.diffResult.textContent = EMPTY_OUTPUT;
  dom.inclusiveResult.textContent = EMPTY_OUTPUT;
  dom.dateResult.textContent = EMPTY_OUTPUT;
  dom.resultNote.textContent = mode === "offset"
    ? messages.offsetRule
    : messages.empty.diff;
}

function readMode() {
  return dom.modeOffset.checked ? "offset" : "diff";
}

function updateLiveStatus(mode, state, result, firstErrorCode) {
  if (state === "empty") {
    dom.status.textContent = messages.empty[mode];
    return;
  }

  if (state === "invalid") {
    dom.status.textContent = messages.errors[firstErrorCode ?? "INVALID_REQUEST"];
    return;
  }

  if (mode === "diff") {
    dom.status.textContent = messages.status.diff
      .replace("{delta}", String(result.deltaDays))
      .replace("{inclusive}", String(result.inclusiveDays));
  } else {
    dom.status.textContent = messages.status.offset.replace("{iso}", result.iso);
  }
}

function parseDateField(input) {
  if (input.value === "" && input.validity?.badInput === true) {
    return { ok: false, code: "DATE_FORMAT" };
  }
  return parseDate(input.value);
}

function resultCode(result) {
  return result !== null &&
      typeof result === "object" &&
      result.ok === false &&
      typeof result.code === "string"
    ? result.code
    : "INVALID_REQUEST";
}

function parseCurrentFields(mode) {
  const fields = mode === "diff"
    ? [dom.fields[0], dom.fields[1]]
    : [dom.fields[2], dom.fields[3]];

  return fields.map((field) => {
    try {
      const result = field.kind === "date"
        ? parseDateField(field.input)
        : parseDays(field.input.value);
      return { field, result };
    } catch {
      return { field, result: { ok: false, code: "INVALID_REQUEST" } };
    }
  });
}

function showParserErrors(parsed) {
  let firstErrorCode = null;
  let hasEmpty = false;

  for (const item of parsed) {
    if (item.result?.ok === true) {
      continue;
    }

    const code = resultCode(item.result);
    if (code === "EMPTY") {
      hasEmpty = true;
      continue;
    }

    const safeCode = showFieldError(item.field, code);
    firstErrorCode ??= safeCode;
  }

  return { firstErrorCode, hasEmpty };
}

function showCalculationError(mode, code) {
  const field = mode === "offset"
    ? (code === "RESULT_RANGE" || code === "DAYS_FORMAT" || code === "DAYS_RANGE"
      ? dom.fields[3]
      : dom.fields[2])
    : dom.fields[0];
  return showFieldError(field, code);
}

function renderNote(mode, state, result) {
  if (mode === "offset") {
    dom.resultNote.textContent = messages.offsetRule;
  } else if (state === "valid") {
    dom.resultNote.textContent = messages.direction[result.direction];
  } else if (state === "empty") {
    dom.resultNote.textContent = messages.empty.diff;
  } else {
    dom.resultNote.textContent = "";
  }
}

function calculate(trigger) {
  if (!active || dom === null) {
    return;
  }

  const mode = readMode();
  clearAllFieldErrors();
  clearResults(mode);

  const parsed = parseCurrentFields(mode);
  const { firstErrorCode, hasEmpty } = showParserErrors(parsed);
  let nextState = firstErrorCode !== null
    ? "invalid"
    : hasEmpty
      ? "empty"
      : "valid";
  let result = null;
  let calculationErrorCode = null;

  if (nextState === "valid") {
    try {
      const calculation = mode === "diff"
        ? dateDifference({ start: dom.dateStart.value, end: dom.dateEnd.value })
        : addDays({ date: dom.dateBase.value, days: dom.dayOffset.value });

      if (calculation?.ok === true) {
        result = calculation.value;
      } else {
        calculationErrorCode = showCalculationError(mode, resultCode(calculation));
        nextState = "invalid";
      }
    } catch {
      calculationErrorCode = showCalculationError(mode, "INVALID_REQUEST");
      nextState = "invalid";
    }
  }

  if (nextState === "valid" && mode === "diff") {
    dom.diffResult.textContent = String(result.deltaDays);
    dom.inclusiveResult.textContent = String(result.inclusiveDays);
  } else if (nextState === "valid") {
    dom.dateResult.textContent = result.iso;
  }

  renderNote(mode, nextState, result);
  const statusErrorCode = firstErrorCode ?? calculationErrorCode;
  if (trigger === "change" || nextState !== currentState) {
    updateLiveStatus(mode, nextState, result, statusErrorCode);
  }
  currentState = nextState;
}

function resetWork(mode, announceEmpty) {
  dom.dateStart.value = "";
  dom.dateEnd.value = "";
  dom.dateBase.value = "";
  dom.dayOffset.value = "0";
  setModeVisibility(mode);
  clearAllFieldErrors();
  clearResults(mode);
  dom.status.textContent = announceEmpty ? messages.empty[mode] : "";
  currentState = "empty";
}

function handleModeChange() {
  if (active) {
    resetWork(readMode(), true);
  }
}

function handleSwap(event) {
  event.preventDefault();
  if (!active || readMode() !== "diff") {
    return;
  }

  const startValue = dom.dateStart.value;
  dom.dateStart.value = dom.dateEnd.value;
  dom.dateEnd.value = startValue;
  calculate("change");
}

function handleClear(event) {
  event.preventDefault();
  if (!active) {
    return;
  }

  const mode = readMode();
  resetWork(mode, true);
  (mode === "diff" ? dom.dateStart : dom.dateBase).focus();
}

function handleFieldKeydown(event) {
  if (
    event.defaultPrevented ||
    event.key !== "Enter" ||
    event.isComposing === true ||
    event.keyCode === 229 ||
    event.repeat === true
  ) {
    return;
  }

  event.preventDefault();
  calculate("change");
}

function bindHandlersOnce() {
  if (handlersBound) {
    return;
  }

  for (const field of dom.fields) {
    field.input.addEventListener("input", () => calculate("input"));
    field.input.addEventListener("change", () => calculate("change"));
    field.input.addEventListener("keydown", handleFieldKeydown);
  }
  dom.modeDiff.addEventListener("change", handleModeChange);
  dom.modeOffset.addEventListener("change", handleModeChange);
  dom.swapButton.addEventListener("click", handleSwap);
  dom.clearButton.addEventListener("click", handleClear);
  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate("change");
  });
  handlersBound = true;
}

function markUnsupported() {
  active = false;
  const controls = dom?.controls ?? document.getElementById("calculator-controls");
  const note = dom?.unsupportedNote ?? document.getElementById("unsupported-note");
  if (controls) {
    controls.disabled = true;
  }
  if (note) {
    note.hidden = false;
  }
}

function initialize() {
  if (active) {
    return;
  }

  try {
    const collected = collectDom();
    if (collected === null) {
      markUnsupported();
      return;
    }

    dom = collected;
    dom.form.noValidate = true;
    bindHandlersOnce();
    resetWork("diff", true);
    dom.controls.disabled = false;
    dom.unsupportedNote.hidden = true;
    active = true;
  } catch {
    markUnsupported();
  }
}

function suspend() {
  if (dom === null) {
    markUnsupported();
    return;
  }

  active = false;
  try {
    resetWork("diff", false);
  } catch {
    // Keep the controls disabled even if a document is being torn down.
  }
  dom.controls.disabled = true;
  dom.unsupportedNote.hidden = false;
}

function bindLifecycleOnce() {
  if (lifecycleBound) {
    return;
  }
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", initialize);
  lifecycleBound = true;
}

bindLifecycleOnce();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
