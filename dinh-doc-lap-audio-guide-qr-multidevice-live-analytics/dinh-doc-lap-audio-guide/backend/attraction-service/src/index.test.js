import { describe, it, expect } from "vitest";
import { hasRequiredAttractionFields } from "./validation.js";

describe("attraction service", () => {
  it("requires each field needed to create an attraction", () => {
    const attraction = {
      id: "main-building",
      name_vi: "Tòa nhà chính",
      name_en: "Main Building",
      description_vi: "Mô tả",
      description_en: "Description",
      narration_vi: "Thuyết minh",
      narration_en: "Narration",
    };
    expect(hasRequiredAttractionFields(attraction)).toBe(true);
    expect(hasRequiredAttractionFields({ ...attraction, narration_en: "" })).toBe(false);
  });
});
