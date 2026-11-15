import { useEffect, useRef, useState } from "react";
import { LANGUAGES, LANGUAGE_CODES } from "../i18n.js";

export default function LanguageSwitcher({ language, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const current = LANGUAGES[language] || LANGUAGES.vi;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="language-switcher" ref={rootRef}>
      <button
        className="language"
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.name}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          className="language-globe"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 12h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        <span className="language-name">{current.name}</span>
        <span className="language-code">{current.code}</span>
        <svg
          aria-hidden="true"
          className={`language-chevron${open ? " is-open" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="m3.5 6 4.5 4 4.5-4" />
        </svg>
      </button>
      {open && (
        <div className="language-menu" role="listbox" aria-label={current.name}>
          {LANGUAGE_CODES.map((code) => {
            const option = LANGUAGES[code];
            const selected = code === language;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`language-option${selected ? " is-selected" : ""}`}
                key={code}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(code);
                }}
              >
                <span className="language-option-name">{option.name}</span>
                <span className="language-option-code">{option.code}</span>
                {selected && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
