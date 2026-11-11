const requiredAttractionFields = [
  "id",
  "name_vi",
  "name_en",
  "description_vi",
  "description_en",
  "narration_vi",
  "narration_en",
];

export function hasRequiredAttractionFields(body) {
  return requiredAttractionFields.every((field) => Boolean(body?.[field]));
}
