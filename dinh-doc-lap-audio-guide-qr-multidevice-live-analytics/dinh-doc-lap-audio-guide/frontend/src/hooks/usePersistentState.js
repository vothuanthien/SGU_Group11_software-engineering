import { useEffect, useState } from "react";

/**
 * Store a value in localStorage while tolerating disabled storage and malformed
 * legacy values. parse/serialize keep compatibility with existing key formats.
 */
export default function usePersistentState(key, initialValue, options = {}) {
  const parse = options.parse || ((raw) => raw);
  const serialize = options.serialize || ((value) => String(value));
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch {
      // The app remains usable when browser storage is unavailable or full.
    }
  }, [key, serialize, value]);

  return [value, setValue];
}
