import { useEffect, useState } from "react";
import api from "../api.js";

/** Load the visitor-facing attraction catalogue and tours. */
export default function usePublicContent(lang) {
  const [attractions, setAttractions] = useState([]);
  const [tours, setTours] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/attractions"), api.get("/tours")])
      .then(([attractionResponse, tourResponse]) => {
        if (cancelled) return;
        setAttractions(attractionResponse.data?.data || []);
        setTours(tourResponse.data?.data || []);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          lang === "vi"
            ? "Không tải được dữ liệu. Hãy thử tải lại."
            : "Could not load data. Please try again.",
        );
      });
    return () => { cancelled = true; };
  }, [lang]);

  return { attractions, tours, error };
}
