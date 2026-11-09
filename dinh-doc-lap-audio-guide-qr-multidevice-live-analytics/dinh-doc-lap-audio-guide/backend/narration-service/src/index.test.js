import { describe, it, expect } from "vitest";
import { isSupportedLanguage } from "./validation.js";

describe("narration service", () => {
  it("accepts Vietnamese and English only", () => {
    expect(isSupportedLanguage("vi")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });
});
