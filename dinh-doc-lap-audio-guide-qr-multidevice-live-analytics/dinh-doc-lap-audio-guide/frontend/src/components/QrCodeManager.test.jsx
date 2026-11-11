import { describe, expect, it } from "vitest";
import { buildQrTargetUrl } from "./QrCodeManager.jsx";

describe("QR destination URLs", () => {
  it("creates a QR destination for the home page", () => {
    expect(buildQrTargetUrl("https://guide.example", "home")).toBe(
      "https://guide.example/?source=qr",
    );
  });

  it("continues to create QR destinations for selected attractions", () => {
    expect(
      buildQrTargetUrl("https://guide.example", "place", "main building"),
    ).toBe("https://guide.example/place/main%20building?source=qr");
  });

  it("does not create a destination without a website URL or attraction", () => {
    expect(buildQrTargetUrl("", "home")).toBe("");
    expect(buildQrTargetUrl("https://guide.example", "place")).toBe("");
  });
});
