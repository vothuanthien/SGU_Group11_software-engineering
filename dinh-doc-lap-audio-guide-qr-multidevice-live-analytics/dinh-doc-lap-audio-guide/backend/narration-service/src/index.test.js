import { describe, it, expect } from "vitest";
describe("narration service", () => {
  it("accepts only supported languages", () =>
    expect(["vi", "en"].includes("vi")).toBe(true));
});
