import { useEffect, useRef } from "react";
import { trackEvent } from "../analytics.js";

/** Track one app-open event per browser tab and place/QR route openings. */
export default function useVisitorTracking(location, lang) {
  const trackedLocationRef = useRef("");
  const appOpenHandledRef = useRef(false);

  useEffect(() => {
    if (appOpenHandledRef.current) return;
    appOpenHandledRef.current = true;
    try {
      if (window.sessionStorage.getItem("dinh_app_opened")) return;
      window.sessionStorage.setItem("dinh_app_opened", "1");
    } catch {
      // Continue with a single in-memory event when sessionStorage is blocked.
    }
    trackEvent({
      eventType: "app_opened",
      language: lang,
      metadata: { entryPath: location.pathname },
    });
  }, [lang, location.pathname]);

  useEffect(() => {
    const match = location.pathname.match(/^\/place\/([^/]+)$/);
    if (!match) {
      trackedLocationRef.current = `not-place:${location.key}:${location.pathname}`;
      return;
    }

    const routeKey = `${location.key}:${location.pathname}${location.search}`;
    if (trackedLocationRef.current === routeKey) return;
    trackedLocationRef.current = routeKey;

    const attractionId = decodeURIComponent(match[1]);
    const params = new URLSearchParams(location.search);
    const source = params.get("source") === "qr" ? "qr" : "app";
    trackEvent({
      eventType: "place_opened",
      attractionId,
      language: lang,
      metadata: { source },
    });
    if (source === "qr") {
      trackEvent({
        eventType: "qr_scan",
        attractionId,
        language: lang,
        metadata: { source: "qr" },
      });
    }
  }, [lang, location.key, location.pathname, location.search]);
}
