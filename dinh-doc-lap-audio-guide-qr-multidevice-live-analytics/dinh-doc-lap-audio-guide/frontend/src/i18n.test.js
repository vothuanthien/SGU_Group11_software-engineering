import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  localizedField,
  resolveLanguage,
  translatePair,
  words,
} from "./i18n.js";

describe("frontend language configuration", () => {
  it("uses the saved choice before the browser language", () => {
    expect(resolveLanguage("en", "th-TH")).toBe("en");
    expect(resolveLanguage("zh", "en-US")).toBe("zh");
  });

  it.each([
    ["vi-VN", "vi"],
    ["en-GB", "en"],
    ["zh-CN", "zh"],
    ["th-TH", "th"],
  ])("detects supported browser locale %s as %s", (browserLocale, expected) => {
    expect(resolveLanguage(null, browserLocale)).toBe(expected);
  });

  it("uses the configured default for an unsupported browser locale", () => {
    expect(resolveLanguage(null, "fr-FR")).toBe(DEFAULT_LANGUAGE);
  });

  it("has a complete common interface dictionary for each selectable locale", () => {
    expect(Object.keys(words)).toEqual(["vi", "en", "zh", "th"]);
    expect(new Set(Object.keys(words.vi))).toEqual(
      new Set(Object.keys(words.en)),
    );
    expect(new Set(Object.keys(words.vi))).toEqual(
      new Set(Object.keys(words.zh)),
    );
    expect(new Set(Object.keys(words.vi))).toEqual(
      new Set(Object.keys(words.th)),
    );
    for (const language of Object.keys(LANGUAGES)) {
      expect(words[language].home).toBeTruthy();
      expect(words[language].narrationUnavailable).toBeTruthy();
    }
  });

  it("translates shared interface phrases without translating narration content", () => {
    expect(translatePair("zh", "Tiếng Việt", "Vietnamese")).toBe("越南语");
    expect(translatePair("th", "English name", "English name")).toBe(
      "ชื่อภาษาอังกฤษ",
    );
    expect(
      localizedField(
        {
          name_vi: "Tên tiếng Việt",
          name_en: "English name",
        },
        "name",
        "zh",
      ),
    ).toBe("");
  });

  it("reads translated content from the agreed translations payload shape", () => {
    expect(
      localizedField(
        { translations: { zh: { name: "中文名称" } } },
        "name",
        "zh",
      ),
    ).toBe("中文名称");
    expect(
      localizedField({ name_th: "ชื่อภาษาไทย" }, "name", "th"),
    ).toBe("ชื่อภาษาไทย");
  });
});
