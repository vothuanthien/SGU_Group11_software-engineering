import { describe, it, expect } from "vitest";
import { isSupportedLanguage } from "./validation.js";

describe("narration service", () => {
  it("accepts all supported narration languages", () => {
    expect(isSupportedLanguage("vi")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("zh")).toBe(true);
    expect(isSupportedLanguage("th")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });
});
