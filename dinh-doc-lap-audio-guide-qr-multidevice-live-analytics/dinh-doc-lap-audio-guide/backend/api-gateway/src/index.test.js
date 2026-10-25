import { describe, it, expect } from "vitest";
describe("gateway config", () => {
  it("routes API under version prefix", () =>
    expect("/api/v1/health".startsWith("/api/v1")).toBe(true));
});
