import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API language headers", () => {
  it.each(["vi", "en", "zh", "th"])(
    "sends the selected %s locale in Accept-Language",
    async (language) => {
      vi.stubGlobal("localStorage", {
        getItem: (key) =>
          key === "dinh_lang" ? language : key === "dinh_token" ? "token" : null,
      });

      const response = await api.get("/attractions", {
        adapter: async (config) => ({
          config,
          data: {},
          headers: {},
          status: 200,
          statusText: "OK",
        }),
      });

      expect(response.config.headers.get("Accept-Language")).toBe(language);
      expect(response.config.headers.get("Authorization")).toBe("Bearer token");
    },
  );
});
