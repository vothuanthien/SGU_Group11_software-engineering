const allowedTypes = new Set(["review", "accuracy", "audio", "location"]);

export function isValidFeedback(body) {
  return (
    Number.isInteger(body?.rating) &&
    body.rating >= 1 &&
    body.rating <= 5 &&
    typeof body.message === "string" &&
    Boolean(body.message.trim()) &&
    body.message.length <= 1000 &&
    allowedTypes.has(body.type || "review")
  );
}
