import { describe, it, expect } from "vitest";
import { isValidFeedback } from "./validation.js";

describe("feedback validation", () => {
  it("validates rating, message, and feedback type", () => {
    expect(isValidFeedback({ rating: 5, message: "Useful" })).toBe(true);
    expect(isValidFeedback({ rating: 0, message: "Useful" })).toBe(false);
    expect(isValidFeedback({ rating: 5, message: "   " })).toBe(false);
    expect(isValidFeedback({ rating: 5, message: "Useful", type: "other" })).toBe(false);
  });
});
