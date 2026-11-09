import { describe, it, expect } from "vitest";
import { hasLoginCredentials } from "./validation.js";

describe("auth service", () => {
  it("requires both login fields", () => {
    expect(hasLoginCredentials({ email: "admin@example.com", password: "p" })).toBe(true);
    expect(hasLoginCredentials({ email: "admin@example.com" })).toBe(false);
    expect(hasLoginCredentials(null)).toBe(false);
  });
});
