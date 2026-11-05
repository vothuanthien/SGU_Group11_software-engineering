import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", fetch: "readonly", AbortSignal: "readonly", setTimeout: "readonly", clearTimeout: "readonly" },
    },
    rules: { "no-unused-vars": "off" },
  },
];
