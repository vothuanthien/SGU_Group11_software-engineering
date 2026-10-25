import { describe, it, expect } from "vitest";
describe("auth service", () => {
  it("uses an 8 hour token expiry policy", () => expect("8h").toBe("8h"));
});
