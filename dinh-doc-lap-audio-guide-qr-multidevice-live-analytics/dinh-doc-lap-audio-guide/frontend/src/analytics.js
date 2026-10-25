import api from "./api.js";

const VISITOR_KEY = "dinh_anon_visitor_id";

export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export async function trackEvent({
  eventType,
  attractionId,
  language = "vi",
  metadata = {},
}) {
  if (!eventType || (!attractionId && eventType !== "app_opened")) return;
  try {
    await api.post("/analytics/events", {
      visitorId: getVisitorId(),
      eventType,
      attractionId,
      language,
      metadata,
    });
  } catch (error) {
    // Analytics must not block the visitor from using narration or navigation.
    if (import.meta.env.DEV)
      console.warn("Analytics event was not saved:", error?.message);
  }
}
