import { describe, expect, it } from "vitest";
import { CONTENT_ROUTES, rewriteContentPath } from "./routing.js";

describe("Content Service routing", () => {
  it("routes attraction and tour endpoints to Attraction Service", () => {
    expect(CONTENT_ROUTES.filter((route) => route.target === "attraction")).toHaveLength(2);
  });

  it("routes narration endpoints to Narration Service", () => {
    expect(CONTENT_ROUTES.find((route) => route.prefix === "/narrations").target).toBe("narration");
  });

  it("preserves resource paths and query strings", () => {
    expect(rewriteContentPath("/attractions", "/room-1?lang=vi")).toBe("/attractions/room-1?lang=vi");
    expect(rewriteContentPath("/narrations", "/")).toBe("/narrations");
  });
});
