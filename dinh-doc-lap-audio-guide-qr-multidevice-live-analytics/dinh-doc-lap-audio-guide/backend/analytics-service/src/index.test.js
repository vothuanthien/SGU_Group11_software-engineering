import { describe, expect, it } from "vitest";
import { isValidAnalyticsEvent } from "./validation.js";

describe("analytics input rules", () => {
  const event = {
    visitorId: "a1c2e3f4-1234-4123-8123-aabbccddeeff",
    eventType: "app_opened",
    language: "vi",
  };

  it("accepts a valid anonymous app-open event", () => {
    expect(isValidAnalyticsEvent(event)).toBe(true);
  });

  it("accepts a QR scan event for the home page without an attraction", () => {
    expect(isValidAnalyticsEvent({ ...event, eventType: "qr_scan" })).toBe(true);
  });

  it("rejects invalid visitor IDs, event types, and languages", () => {
    expect(isValidAnalyticsEvent({ ...event, visitorId: "visitor-123" })).toBe(false);
    expect(isValidAnalyticsEvent({ ...event, eventType: "arbitrary" })).toBe(false);
    expect(isValidAnalyticsEvent({ ...event, language: "fr" })).toBe(false);
  });

  it("requires an attraction for attraction-specific events", () => {
    expect(
      isValidAnalyticsEvent({
        ...event,
        eventType: "place_opened",
        attractionId: "main-building",
      }),
    ).toBe(true);
    expect(isValidAnalyticsEvent({ ...event, eventType: "place_opened" })).toBe(false);
  });
});
