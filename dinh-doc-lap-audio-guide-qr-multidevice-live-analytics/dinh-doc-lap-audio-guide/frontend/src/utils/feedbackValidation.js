export function validateFeedbackMessage(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "EMPTY_MESSAGE";
  }
  if (value.trim().length > 1000) {
    return "MESSAGE_TOO_LONG";
  }
  return null;
}

export function normalizeFeedbackMessage(value) {
  return typeof value === "string" ? value.trim() : "";
}
