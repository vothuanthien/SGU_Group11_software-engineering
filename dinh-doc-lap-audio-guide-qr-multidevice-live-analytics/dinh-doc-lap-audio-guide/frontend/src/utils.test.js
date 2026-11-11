import { describe, it, expect } from "vitest";
function validRating(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}
describe("feedback rating validation", () => {
  it("accepts 1-5", () =>
    expect([1, 2, 3, 4, 5].every(validRating)).toBe(true));
  it("rejects invalid values", () =>
    expect([0, 6, 2.5].some(validRating)).toBe(false));
});
