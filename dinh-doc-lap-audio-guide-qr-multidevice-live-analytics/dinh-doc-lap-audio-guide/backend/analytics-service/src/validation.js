const allowedEvents = new Set([
  "app_opened",
  "qr_scan",
  "place_opened",
  "visit_marked",
  "narration_started",
  "narration_completed",
]);
const allowedLanguages = new Set(["vi", "en"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAnalyticsEvent(body) {
  const { visitorId, eventType, attractionId, language } = body || {};
  const needsAttraction = !["app_opened", "qr_scan"].includes(eventType);
  const validAttractionId =
    typeof attractionId === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(attractionId);

  return (
    uuidPattern.test(String(visitorId || "")) &&
    allowedEvents.has(eventType) &&
    allowedLanguages.has(language) &&
    (!needsAttraction || validAttractionId) &&
    (needsAttraction || attractionId == null || validAttractionId)
  );
}
