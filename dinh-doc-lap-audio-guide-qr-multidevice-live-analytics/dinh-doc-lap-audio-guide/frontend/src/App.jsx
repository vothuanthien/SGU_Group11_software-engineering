import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import api from "./api.js";
import { trackEvent } from "./analytics.js";
import { words, attractionImages } from "./constants/appContent.js";
import usePersistentState from "./hooks/usePersistentState.js";
import usePublicContent from "./hooks/usePublicContent.js";
import useVisitorTracking from "./hooks/useVisitorTracking.js";
import PlaceDetailPage from "./pages/PlaceDetailPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import FeedbackPage from "./pages/FeedbackPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

function App() {
  const location = useLocation();
  const [lang, setLang] = usePersistentState("dinh_lang", "vi", {
    parse: (raw) => raw === "en" ? "en" : "vi",
    serialize: (value) => value,
  });
  const [visited, setVisited] = usePersistentState("dinh_visited", [], {
    parse: (raw) => {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    },
    serialize: (value) => JSON.stringify(value),
  });
  const { attractions, tours, error } = usePublicContent(lang);
  const [auto, setAuto] = useState(false);
  const [gps, setGps] = useState(null);
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const spoken = useRef(new Set());
  const t = words[lang];
  useVisitorTracking(location, lang);
  useEffect(() => {
    if (!auto) return;
    if (!navigator.geolocation) {
      setNotice(t.gpsDenied);
      setAuto(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(p);
        const near = !playing
          ? attractions.find(
              (a) =>
                a.latitude &&
                a.longitude &&
                distance(p.lat, p.lng, a.latitude, a.longitude) < 80 &&
                !spoken.current.has(a.id),
            )
          : null;
        if (near) {
          spoken.current.add(near.id);
          setNotice(
            `${lang === "vi" ? "Bạn đang gần" : "You are near"}: ${lang === "vi" ? near.name_vi : near.name_en}`,
          );
          if ("speechSynthesis" in window) {
            api
              .get(`/narrations/${near.id}/${lang}`)
              .then((r) => {
                if (!auto) return;
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(
                  r.data.data.text,
                );
                utterance.lang = lang === "vi" ? "vi-VN" : "en-US";
                utterance.onstart = () => {
                  setPlaying(true);
                  trackEvent({
                    eventType: "narration_started",
                    attractionId: near.id,
                    language: lang,
                    metadata: { player: "gps_auto" },
                  });
                };
                utterance.onend = () => {
                  setPlaying(false);
                  trackEvent({
                    eventType: "narration_completed",
                    attractionId: near.id,
                    language: lang,
                    metadata: { player: "gps_auto" },
                  });
                };
                utterance.onerror = () => {
                  setPlaying(false);
                  setNotice(
                    lang === "vi"
                      ? "Không phát được tự động; hãy mở điểm và nhấn Nghe."
                      : "Auto playback failed; open the stop and press Play.",
                  );
                };
                window.speechSynthesis.speak(utterance);
              })
              .catch(() =>
                setNotice(
                  lang === "vi"
                    ? "Nội dung chưa sẵn sàng; hãy chọn điểm thủ công."
                    : "Narration unavailable; choose a stop manually.",
                ),
              );
          } else
            setNotice(
              lang === "vi"
                ? "Trình duyệt không hỗ trợ đọc tự động; hãy chọn điểm thủ công."
                : "Speech is unsupported; choose a stop manually.",
            );
        }
      },
      () => {
        setNotice(t.gpsDenied);
        setAuto(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [auto, attractions, lang, playing]);
  const toggleVisit = (id) => {
    const isMarking = !visited.includes(id);
    setVisited((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
    if (isMarking)
      trackEvent({
        eventType: "visit_marked",
        attractionId: id,
        language: lang,
      });
  };
  const speak = async (a) => {
    if (!a) return;
    if (!("speechSynthesis" in window)) {
      setNotice(
        lang === "vi"
          ? "Trình duyệt không hỗ trợ đọc văn bản."
          : "This browser does not support speech synthesis.",
      );
      return;
    }
    try {
      const r = await api.get(`/narrations/${a.id}/${lang}`);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(r.data.data.text);
      u.lang = lang === "vi" ? "vi-VN" : "en-US";
      u.onstart = () => {
        setPlaying(true);
        trackEvent({
          eventType: "narration_started",
          attractionId: a.id,
          language: lang,
        });
      };
      u.onend = () => {
        setPlaying(false);
        trackEvent({
          eventType: "narration_completed",
          attractionId: a.id,
          language: lang,
        });
      };
      u.onerror = () => {
        setPlaying(false);
        setNotice(
          lang === "vi"
            ? "Không phát được giọng đọc trên trình duyệt này."
            : "Speech playback failed in this browser.",
        );
      };
      window.speechSynthesis.speak(u);
    } catch (e) {
      setNotice(
        e.response?.data?.error?.message ||
          (lang === "vi"
            ? "Chưa có nội dung thuyết minh được công bố."
            : "No published narration is available."),
      );
    }
  };
  const stop = () => {
    window.speechSynthesis?.cancel();
    setPlaying(false);
  };
  return (
    <>
      <header>
        <Link className="brand" to="/">
          D<span>DL</span> Audio Guide
        </Link>
        <nav>
          <Link to="/">{t.home}</Link>
          <Link to="/map">{t.map}</Link>
          <Link to="/feedback">{t.send}</Link>
          <Link to="/admin">{t.admin}</Link>
          <button
            className="language"
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          >
            {t.language}
          </button>
        </nav>
      </header>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <p className="eyebrow">HISTORICAL AUDIO WALK</p>
                    <h1>{t.home}</h1>
                    <p>{t.sub}</p>
                    <div className="hero-actions">
                      <Link className="primary" to="/map">
                        {t.start}
                      </Link>
                      <button
                        className="secondary"
                        onClick={() => {
                          setAuto((v) => !v);
                          if (!auto)
                            setNotice(
                              "Hãy cho phép định vị và tương tác với trang trước khi phát giọng đọc tự động.",
                            );
                        }}
                      >
                        {t.auto}: {auto ? t.on : t.off}
                      </button>
                    </div>
                    <p className="small">{t.playTip}</p>
                  </div>
                  <div className="hero-art">
                    <img
                      src="/images/main-building.jpg"
                      alt="Mặt tiền Dinh Độc Lập"
                      fetchPriority="high"
                    />
                    <span className="hero-art-caption">
                      {lang === "vi"
                        ? "Tòa nhà chính · Dinh Độc Lập"
                        : "Main Building · Independence Palace"}
                    </span>
                  </div>
                </section>
                <section className="section-head">
                  <div>
                    <p className="eyebrow">YOUR VISIT</p>
                    <h2>{t.all}</h2>
                  </div>
                  <span>
                    {visited.length}/{attractions.length} {t.visited}
                  </span>
                </section>
                <div className="progress">
                  <i
                    style={{
                      width: `${attractions.length ? (visited.length / attractions.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="cards">
                  {attractions.map((a, i) => (
                    <article className="place-card" key={a.id}>
                      {attractionImages[a.id] && (
                        <Link
                          to={`/place/${encodeURIComponent(a.id)}`}
                          className="place-card-image-link"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          <img
                            className="place-card-image"
                            src={attractionImages[a.id].src}
                            alt=""
                            loading="lazy"
                          />
                        </Link>
                      )}
                      <div className="place-card-content">
                        <div className="place-card-heading">
                          <span className="card-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <p className="muted">
                              {lang === "vi" ? a.area_vi : a.area_en}
                            </p>
                            <h3>{lang === "vi" ? a.name_vi : a.name_en}</h3>
                          </div>
                        </div>
                        <p>
                          {lang === "vi" ? a.description_vi : a.description_en}
                        </p>
                        <Link to={`/place/${encodeURIComponent(a.id)}`} className="text-link">
                          {t.listen} ↗
                        </Link>
                      </div>
                      {visited.includes(a.id) && (
                        <span className="visited-mark">✓</span>
                      )}
                    </article>
                  ))}
                </div>
                <section className="tour-banner">
                  <div>
                    <p className="eyebrow">CURATED WALK</p>
                    <h2>{t.route}</h2>
                    <p>
                      {tours[0]
                        ? lang === "vi"
                          ? tours[0].description_vi
                          : tours[0].description_en
                        : ""}
                    </p>
                  </div>
                  <Link className="primary" to="/map">
                    {t.map} →
                  </Link>
                </section>
              </>
            }
          />
          <Route
            path="/map"
            element={
              <MapPage
                attractions={attractions}
                lang={lang}
                t={t}
                gps={gps}
                auto={auto}
                setAuto={setAuto}
                setNotice={setNotice}
              />
            }
          />
          <Route
            path="/place/:id"
            element={
              <PlaceDetailPage
                lang={lang}
                t={t}
                attractions={attractions}
                visited={visited}
                toggleVisit={toggleVisit}
                speak={speak}
                playing={playing}
                stop={stop}
              />
            }
          />
          <Route
            path="/feedback"
            element={<FeedbackPage attractions={attractions} lang={lang} t={t} />}
          />
          <Route path="/admin" element={<AdminPage t={t} lang={lang} />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h2>404</h2>
                <Link to="/">{t.back}</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <span>Dinh Doc Lap Audio Guide</span>
        <span>
          {lang === "vi"
            ? "Thống kê dùng mã ẩn danh"
            : "Analytics use anonymous IDs"}{" "}
          · Demo • Việt / English
        </span>
      </footer>
    </>
  );
}

export default App;
