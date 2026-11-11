import { describe, it, expect } from "vitest";
import {
  normalizeFeedbackMessage,
  validateFeedbackMessage,
} from "./utils/feedbackValidation.js";

describe("feedback message validation", () => {
  it("rejects empty and whitespace-only messages", () => {
    expect(validateFeedbackMessage("")).toBe("EMPTY_MESSAGE");
    expect(validateFeedbackMessage("   \n  ")).toBe("EMPTY_MESSAGE");
  });

  it("accepts a trimmed message within the API limit", () => {
    expect(validateFeedbackMessage("  Nội dung hữu ích  ")).toBeNull();
    expect(normalizeFeedbackMessage("  Xin cảm ơn  ")).toBe("Xin cảm ơn");
  });

  it("rejects messages longer than 1000 characters", () => {
    expect(validateFeedbackMessage("a".repeat(1001))).toBe("MESSAGE_TOO_LONG");
  });
});
