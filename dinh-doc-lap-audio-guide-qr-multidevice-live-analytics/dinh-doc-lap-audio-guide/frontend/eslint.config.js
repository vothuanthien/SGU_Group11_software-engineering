import js from "@eslint/js";
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        SpeechSynthesisUtterance: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        crypto: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        XMLSerializer: "readonly",
        Blob: "readonly",
        document: "readonly",
      },
    },
    rules: { "no-unused-vars": "off" },
  },
];
