// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LanguageSwitcher from "./LanguageSwitcher.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function renderSwitcher(onChange = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <LanguageSwitcher language="vi" onChange={onChange} />,
    );
  });
  return onChange;
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("LanguageSwitcher", () => {
  it("offers all four languages and selects the requested language", () => {
    const onChange = renderSwitcher();
    click(container.querySelector(".language"));

    const options = [...container.querySelectorAll('[role="option"]')];
    expect(options.map((option) => option.textContent)).toEqual([
      "Tiếng Việtvi✓",
      "Englishen",
      "中文zh",
      "ภาษาไทยth",
    ]);
    click(options[2]);

    expect(onChange).toHaveBeenCalledWith("zh");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("closes on Escape and on an outside click", () => {
    renderSwitcher();
    click(container.querySelector(".language"));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    click(container.querySelector(".language"));
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});
