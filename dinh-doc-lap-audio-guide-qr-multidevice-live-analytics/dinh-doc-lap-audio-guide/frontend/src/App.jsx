import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import api from "./api.js";
import { trackEvent } from "./analytics.js";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import AnalyticsDashboard from "./components/AnalyticsDashboard.jsx";
import QrCodeManager from "./components/QrCodeManager.jsx";
import { attractionImages } from "./constants/appContent.js";
import {
  getInitialLanguage,
  LANGUAGES,
  localizedField,
  translatePair,
  words,
} from "./i18n.js";
const numberedMarkerIcon = (number, gold = false) =>
  L.divIcon({
    className: `attraction-marker${gold ? " attraction-marker-gold" : ""}`,
    html: `<span><b>${String(number).padStart(2, "0")}</b></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });
function App() {
  const location = useLocation();
  const [lang, setLang] = useState(getInitialLanguage);
  const [attractions, setAttractions] = useState([]);
  const [tours, setTours] = useState([]);
  const [error, setError] = useState("");
  const [visited, setVisited] = useState(() =>
    JSON.parse(localStorage.getItem("dinh_visited") || "[]"),
  );
  const [auto, setAuto] = useState(false);
  const [gps, setGps] = useState(null);
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const spoken = useRef(new Set());
  const trackedLocationRef = useRef("");
  const gpsAudioRef = useRef(null);
  const selectedLanguageRef = useRef(lang);
  const t = words[lang];
  const msg = (vi, en) => translatePair(lang, vi, en);
  const localized = (item, field) => localizedField(item, field, lang);
  const selectLanguage = (language) => {
    selectedLanguageRef.current = language;
    try {
      localStorage.setItem("dinh_lang", language);
    } catch {
      // The selected language remains active for the current page.
    }
    window.speechSynthesis?.cancel();
    gpsAudioRef.current?.pause();
    gpsAudioRef.current = null;
    setPlaying(false);
    setLang(language);
  };
  useEffect(() => {
    try {
      localStorage.setItem("dinh_lang", lang);
    } catch {
      // The selected language remains active for the current page.
    }
    document.documentElement.lang = LANGUAGES[lang].locale;
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("dinh_visited", JSON.stringify(visited));
  }, [visited]);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("dinh_app_opened")) return;
      sessionStorage.setItem("dinh_app_opened", "1");
    } catch {}
    trackEvent({
      eventType: "app_opened",
      language: lang,
      metadata: { entryPath: location.pathname },
    });
  }, [lang, location.pathname]);
  useEffect(() => {
    const match = location.pathname.match(/^\/place\/([^/]+)$/);
    const routeKey = `${location.key}:${location.pathname}${location.search}`;
    if (!match) {
      const params = new URLSearchParams(location.search);
      if (location.pathname === "/" && params.get("source") === "qr") {
        if (trackedLocationRef.current === routeKey) return;
        trackedLocationRef.current = routeKey;
        trackEvent({
          eventType: "qr_scan",
          language: lang,
          metadata: { source: "qr" },
        });
        return;
      }
      trackedLocationRef.current = `not-place:${location.key}:${location.pathname}`;
      return;
    }
    if (trackedLocationRef.current === routeKey) return;
    trackedLocationRef.current = routeKey;
    const attractionId = decodeURIComponent(match[1]);
    const params = new URLSearchParams(location.search);
    trackEvent({
      eventType: "place_opened",
      attractionId,
      language: lang,
      metadata: { source: params.get("source") === "qr" ? "qr" : "app" },
    });
    if (params.get("source") === "qr")
      trackEvent({
        eventType: "qr_scan",
        attractionId,
        language: lang,
        metadata: { source: "qr" },
      });
  }, [lang, location.key, location.pathname, location.search]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/attractions"), api.get("/tours")])
      .then(([a, b]) => {
        if (cancelled) return;
        setAttractions(a.data.data || []);
        setTours(b.data.data || []);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError(t.error);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, t.error]);
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
          setSelected(near);
          setNotice(
            `${t.near}: ${localized(near, "name") || t.unavailable}`,
          );
          if ("speechSynthesis" in window) {
            api
              .get(`/narrations/${near.id}/${lang}`)
              .then((r) => {
                if (!auto || selectedLanguageRef.current !== lang) return;
                const narration = r.data.data;
                if (
                  !narration?.text ||
                  (narration.language && narration.language !== lang)
                ) {
                  setNotice(t.narrationUnavailable);
                  return;
                }
                window.speechSynthesis.cancel();
                if (narration.audioUrl) {
                  const audio = new window.Audio(narration.audioUrl);
                  gpsAudioRef.current = audio;
                  audio.onplay = () => {
                    setPlaying(true);
                    trackEvent({
                      eventType: "narration_started",
                      attractionId: near.id,
                      language: lang,
                      metadata: { player: "gps_audio_file" },
                    });
                  };
                  audio.onended = () => {
                    setPlaying(false);
                    gpsAudioRef.current = null;
                    trackEvent({
                      eventType: "narration_completed",
                      attractionId: near.id,
                      language: lang,
                      metadata: { player: "gps_audio_file" },
                    });
                  };
                  audio.onerror = () => {
                    setPlaying(false);
                    gpsAudioRef.current = null;
                    setNotice(t.audioUnavailable);
                  };
                  audio.play().catch(() => {
                    setPlaying(false);
                    gpsAudioRef.current = null;
                    setNotice(t.audioUnavailable);
                  });
                  return;
                }
                const utterance = new SpeechSynthesisUtterance(
                  narration.text,
                );
                utterance.lang = LANGUAGES[lang].locale;
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
                    t.autoFailed,
                  );
                };
                window.speechSynthesis.speak(utterance);
              })
              .catch(() =>
                setNotice(
                  t.narrationNotReady,
                ),
              );
          } else
            setNotice(
              t.speechNotSupported,
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
  }, [
    auto,
    attractions,
    lang,
    playing,
    t.audioUnavailable,
    t.autoFailed,
    t.near,
    t.narrationNotReady,
    t.narrationUnavailable,
    t.speechNotSupported,
    t.unavailable,
  ]);
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
        t.speechUnsupported,
      );
      return;
    }
    try {
      const r = await api.get(`/narrations/${a.id}/${lang}`);
      if (selectedLanguageRef.current !== lang) return;
      if (r.data.data?.language && r.data.data.language !== lang) {
        throw new Error("Narration language mismatch");
      }
      if (!r.data.data?.text) {
        throw new Error("Narration text is missing");
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(r.data.data.text);
      u.lang = LANGUAGES[lang].locale;
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
        setNotice(t.speechFailed);
      };
      window.speechSynthesis.speak(u);
    } catch (e) {
      setNotice(
        lang === "zh" || lang === "th"
          ? t.narrationUnavailable
          : e.response?.data?.error?.message || t.narrationUnavailable,
      );
    }
  };
  const stop = () => {
    window.speechSynthesis?.cancel();
    gpsAudioRef.current?.pause();
    gpsAudioRef.current = null;
    setPlaying(false);
  };
  const detail = (id) => (
    <Detail
      id={id}
      lang={lang}
      t={t}
      attractions={attractions}
      visited={visited}
      toggleVisit={toggleVisit}
      speak={speak}
      playing={playing}
      stop={stop}
      setPlaying={setPlaying}
      setSelected={setSelected}
    />
  );
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
          <LanguageSwitcher language={lang} onChange={selectLanguage} />
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
                    <p className="eyebrow">{t.heroEyebrow}</p>
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
                              msg(
                                "Hãy cho phép định vị và tương tác với trang trước khi phát giọng đọc tự động.",
                                "Allow location access and interact with the page before automatic narration.",
                              ),
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
                      alt={t.heroAlt}
                      fetchPriority="high"
                    />
                    <span className="hero-art-caption">
                      {localized(attractions.find((item) => item.id === "main-building"), "name") || t.unavailable} · Dinh Độc Lập
                    </span>
                  </div>
                </section>
                <section className="section-head">
                  <div>
                    <p className="eyebrow">{t.visitEyebrow}</p>
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
                              {localized(a, "area") || t.unavailable}
                            </p>
                            <h3>{localized(a, "name") || t.unavailable}</h3>
                          </div>
                        </div>
                        <p>
                          {localized(a, "description") || t.unavailable}
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
                    <p className="eyebrow">{t.curatedEyebrow}</p>
                    <h2>{t.route}</h2>
                    <p>
                      {tours[0]
                        ? localized(tours[0], "description") || t.unavailable
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
          <Route path="/place/:id" element={<PlaceRoute render={detail} />} />
          <Route
            path="/feedback"
            element={<Feedback attractions={attractions} lang={lang} t={t} />}
          />
          <Route path="/admin" element={<Admin t={t} lang={lang} />} />
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
          {t.visitorAnalytics} · Demo
        </span>
      </footer>
    </>
  );
}
function distance(a, b, c, d) {
  const r = (x) => (x * Math.PI) / 180;
  const x = r(c - a),
    y = r(d - b);
  return (
    6371000 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(x / 2) ** 2 +
          Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(y / 2) ** 2,
      ),
    )
  );
}
function PlaceRoute({ render }) {
  const { id } = useParams();
  return render(id);
}
function Detail({
  id,
  lang,
  t,
  attractions,
  visited,
  toggleVisit,
  speak,
  playing,
  stop,
  setPlaying,
}) {
  const [n, setN] = useState(null);
  const [narrationError, setNarrationError] = useState("");
  const audioRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setN(null);
    setNarrationError("");
    api
      .get(`/narrations/${id}/${lang}`)
      .then((r) => {
        if (cancelled) return;
        const narration = r.data.data;
        if (
          !narration?.text ||
          (narration.language && narration.language !== lang)
        ) {
          setNarrationError(t.narrationUnavailable);
          return;
        }
        setN(narration);
      })
      .catch((e) => {
        if (cancelled) return;
        setNarrationError(
          lang === "zh" || lang === "th"
            ? t.narrationUnavailable
            : e.response?.data?.error?.message || t.narrationUnavailable,
        );
      });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, [id, lang, t.narrationUnavailable]);
  const a = attractions.find((x) => x.id === id);
  if (!a) return <div className="empty">{t.error}</div>;
  const image = attractionImages[a.id];
  const play = async () => {
    if (!n) return;
    if (n?.audioUrl && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        return;
      }
      try {
        await audioRef.current.play();
      } catch {
        setNarrationError(
          t.audioFallback,
        );
        speak(a);
      }
      return;
    }
    if (playing) stop();
    else speak(a);
  };
  return (
    <section className="detail">
      <Link to="/map" className="back">
        <span>{t.backMap}</span>
      </Link>
      <div className="detail-layout">
        {image && (
          <figure className="detail-photo">
                <img
                  src={image.src}
                  alt={localizedField(a, "name", lang) || t.unavailable}
                />
            <figcaption>
              {localizedField(a, "name", lang) || t.unavailable} · Dinh Độc Lập
            </figcaption>
          </figure>
        )}
        <div className="detail-copy">
          <p className="eyebrow">
            {localizedField(a, "area", lang) || t.unavailable}
          </p>
          <h1>{localizedField(a, "name", lang) || t.unavailable}</h1>
          <p className="lead">
            {localizedField(a, "description", lang) || t.unavailable}
          </p>
      <div className="player">
        <div className="player-icon">♫</div>
        <div className="player-info">
          <strong>{t.listen}</strong>
          <span>
            {a.duration_minutes} {t.duration} ·{" "}
            {n?.audioUrl ? t.audioFile : t.browserSpeech}
          </span>
        </div>
        <button
          className="play"
          onClick={play}
          disabled={!n}
          aria-label={playing ? t.stop : t.listen}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
      </div>
      {n?.audioUrl && (
        <audio
          ref={audioRef}
          src={n.audioUrl}
          preload="none"
          onPlay={() => {
            window.speechSynthesis?.cancel();
            setPlaying(true);
            trackEvent({
              eventType: "narration_started",
              attractionId: a.id,
              language: lang,
              metadata: { player: "audio_file" },
            });
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            trackEvent({
              eventType: "narration_completed",
              attractionId: a.id,
              language: lang,
              metadata: { player: "audio_file" },
            });
          }}
        />
      )}
      <h2>{t.text}</h2>
      <p className="narration">{n?.text || narrationError}</p>
      {narrationError && (
        <p className="small" role="status">
          {narrationError}
        </p>
      )}
      <div className="detail-actions">
        <button className="primary" onClick={() => toggleVisit(a.id)}>
          {visited.includes(a.id) ? `✓ ${t.visited}` : t.mark}
        </button>
        {a.source_url && (
          <a
            className="secondary"
            href={a.source_url}
            target="_blank"
            rel="noreferrer"
          >
            {t.source} ↗
          </a>
        )}
      </div>
        </div>
      </div>
      <section className="detail-gallery" aria-labelledby="detail-gallery-title">
        <div className="detail-gallery-heading">
          <h2 id="detail-gallery-title">
            {t.exploreAttractions}
          </h2>
          <span>
            {attractions.length} {t.places}
          </span>
        </div>
        <div className="detail-gallery-grid">
          {attractions.map((place) => {
            const placeImage = attractionImages[place.id];
            return (
              <Link
                className={`detail-gallery-card${place.id === a.id ? " is-current" : ""}`}
                to={`/place/${encodeURIComponent(place.id)}`}
                key={place.id}
                aria-current={place.id === a.id ? "page" : undefined}
              >
                {placeImage ? (
                  <img
                    src={placeImage.src}
                    alt={localizedField(place, "name", lang) || t.unavailable}
                    loading="lazy"
                  />
                ) : (
                  <span className="detail-gallery-placeholder" aria-hidden="true">⌖</span>
                )}
                <span className="detail-gallery-label">
                  {localizedField(place, "name", lang) || t.unavailable}
                  <small>
                    {localizedField(place, "area", lang) || t.unavailable}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function MapPage({ attractions, lang, t, gps, auto, setAuto, setNotice }) {
  return (
    <section className="map-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">{t.exploreEyebrow}</p>
          <h1>{t.map}</h1>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setAuto(!auto);
            if (!auto) setNotice(t.gpsDenied);
          }}
        >
          {t.auto}: {auto ? t.on : t.off}
        </button>
      </div>
      <div className="map-layout">
        <div className="map-list">
          {attractions.map((a, i) => (
            <Link className="map-row" to={`/place/${encodeURIComponent(a.id)}`} key={a.id}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>
                <strong>{localizedField(a, "name", lang) || t.unavailable}</strong>
                <small>{localizedField(a, "area", lang) || t.unavailable}</small>
              </span>
              <span>↗</span>
            </Link>
          ))}
        </div>
        <div className="map-frame">
          <MapContainer
            center={gps ? [gps.lat, gps.lng] : [10.7768, 106.6953]}
            zoom={17}
            scrollWheelZoom={false}
            style={{ height: "100%", minHeight: 420 }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {attractions
              .filter((a) => a.latitude && a.longitude)
              .map((a, i) => (
                <Marker
                  key={a.id}
                  position={[a.latitude, a.longitude]}
                  icon={numberedMarkerIcon(i + 1, i % 2 === 1)}
                >
                  <Popup>
                    <strong>{localizedField(a, "name", lang) || t.unavailable}</strong>
                    <br />
                    <Link to={`/place/${encodeURIComponent(a.id)}`}>{t.listen}</Link>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>
      <p className="small">
        {t.gps}:{" "}
        {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : t.gpsDenied} ·
        {t.directionsGps}
      </p>
    </section>
  );
}
function Feedback({ attractions, lang, t }) {
  const [form, setForm] = useState({
    attractionId: "",
    rating: 5,
    message: "",
    type: "review",
  });
  const [status, setStatus] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/feedback", form);
      setStatus(t.feedbackSent);
      setForm({ ...form, message: "" });
    } catch (e) {
      setStatus(e.response?.data?.error?.message || t.feedbackFailed);
    }
  };
  return (
    <section className="form-page">
      <p className="eyebrow">{t.feedbackEyebrow}</p>
      <h1>{t.send}</h1>
      <form onSubmit={submit} className="form-card">
        <label>
          {t.attractionField}
          <select
            value={form.attractionId}
            onChange={(e) => setForm({ ...form, attractionId: e.target.value })}
          >
            <option value="">{t.noAttraction}</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>
                {localizedField(a, "name", lang) || t.unavailable}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.rating}
          <select
            value={form.rating}
            onChange={(e) =>
              setForm({ ...form, rating: Number(e.target.value) })
            }
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.kind}
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="review">{t.review}</option>
            <option value="accuracy">{t.accuracy}</option>
            <option value="audio">{t.audio}</option>
            <option value="location">{t.location}</option>
          </select>
        </label>
        <label>
          {t.message}
          <textarea
            required
            minLength="1"
            maxLength="1000"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <button className="primary" type="submit">
          {t.send} →
        </button>
        {status && <p role="status">{status}</p>}
      </form>
    </section>
  );
}
function Admin({ t, lang }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [user, setUser] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("dinh_admin_user") || "null");
      } catch {
        return null;
      }
    }),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState("overview");
  const [attractions, setAttractions] = useState([]),
    [tours, setTours] = useState([]),
    [feedback, setFeedback] = useState([]);
  const empty = {
    id: "",
    name_vi: "",
    name_en: "",
    description_vi: "",
    description_en: "",
    narration_vi: "",
    narration_en: "",
    area_vi: "",
    area_en: "",
    latitude: "",
    longitude: "",
    sort_order: 1,
    duration_minutes: 2,
    source_url: "https://dinhdoclap.gov.vn",
    image_url: "",
    visible: true,
    narration_published: true,
    audio_vi: "",
    audio_en: "",
  };
  const [draft, setDraft] = useState(empty),
    [editing, setEditing] = useState(false),
    [tourDraft, setTourDraft] = useState({
      id: "",
      name_vi: "",
      name_en: "",
      description_vi: "",
      description_en: "",
      attractionIds: [],
    });
  const msg = (vi, en) => translatePair(lang, vi, en);
  const load = async () => {
    try {
      const [a, ts, f] = await Promise.all([
        api.get("/attractions/admin/all"),
        api.get("/tours"),
        api.get("/feedback"),
      ]);
      setAttractions(a.data.data || []);
      setTours(ts.data.data || []);
      setFeedback(f.data.data || []);
      setError("");
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          msg("Không tải được dữ liệu quản trị.", "Could not load admin data."),
      );
    }
  };
  useEffect(() => {
    if (user) load();
  }, [user, lang]);
  const login = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post("/auth/login", { email, password });
      localStorage.setItem("dinh_token", r.data.data.token);
      localStorage.setItem("dinh_admin_user", JSON.stringify(r.data.data.user));
      setUser(r.data.data.user);
      setError("");
    } catch {
      setError(
        msg(
          "Đăng nhập thất bại. Kiểm tra tài khoản trong README.",
          "Login failed. Check the demo credentials in README.",
        ),
      );
    }
  };
  const logout = () => {
    localStorage.removeItem("dinh_token");
    localStorage.removeItem("dinh_admin_user");
    setUser(null);
    setPassword("");
    setStatus("");
  };
  const startEdit = (a) => {
    setDraft({
      ...empty,
      ...a,
      latitude: a.latitude ?? "",
      longitude: a.longitude ?? "",
    });
    setEditing(true);
    setTab("attractions");
    setStatus("");
  };
  const saveAttraction = async (e) => {
    e.preventDefault();
    const payload = {
      ...draft,
      latitude: draft.latitude === "" ? null : Number(draft.latitude),
      longitude: draft.longitude === "" ? null : Number(draft.longitude),
      sort_order: Number(draft.sort_order),
      duration_minutes: Number(draft.duration_minutes),
    };
    try {
      if (editing) {
        await api.put(`/attractions/${encodeURIComponent(draft.id)}`, payload);
      } else {
        await api.post("/attractions", payload);
      }
      setStatus(msg("Đã lưu điểm tham quan.", "Attraction saved."));
      setDraft(empty);
      setEditing(false);
      await load();
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          msg("Không lưu được điểm tham quan.", "Could not save attraction."),
      );
    }
  };
  const hideAttraction = async (a) => {
    const name = localizedField(a, "name", lang) || a.id;
    const confirmation =
      lang === "zh"
        ? `隐藏景点“${name}”？`
        : lang === "th"
          ? `ซ่อนสถานที่ “${name}” หรือไม่`
          : `${msg("Ẩn điểm", "Hide")} “${name}”?`;
    if (!window.confirm(confirmation))
      return;
    try {
      await api.delete(`/attractions/${encodeURIComponent(a.id)}`);
      setStatus(msg("Đã ẩn điểm tham quan.", "Attraction hidden."));
      await load();
    } catch (e) {
      setError(e.response?.data?.error?.message || t.error);
    }
  };
  const saveNarration = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/narrations/${encodeURIComponent(draft.id)}`, {
        narration_vi: draft.narration_vi,
        narration_en: draft.narration_en,
        narration_published: !!draft.narration_published,
        audio_vi: draft.audio_vi || "",
        audio_en: draft.audio_en || "",
      });
      setStatus(
        msg("Đã cập nhật kịch bản song ngữ.", "Bilingual narration updated."),
      );
      await load();
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          msg("Không lưu được kịch bản.", "Could not save narration."),
      );
    }
  };
  const chooseTour = (t) =>
    setTourDraft({
      id: t.id,
      name_vi: t.name_vi,
      name_en: t.name_en,
      description_vi: t.description_vi,
      description_en: t.description_en,
      attractionIds: (t.stops || [])
        .sort((a, b) => a.stop_order - b.stop_order)
        .map((s) => s.id),
    });
  const saveTour = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...tourDraft };
      if (tours.some((t) => t.id === payload.id))
        await api.put(`/tours/${encodeURIComponent(payload.id)}`, payload);
      else await api.post("/tours", payload);
      setStatus(msg("Đã lưu lộ trình.", "Tour saved."));
      setTourDraft({
        id: "",
        name_vi: "",
        name_en: "",
        description_vi: "",
        description_en: "",
        attractionIds: [],
      });
      await load();
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          msg("Không lưu được lộ trình.", "Could not save tour."),
      );
    }
  };
  const updateFeedback = async (id, next) => {
    try {
      await api.patch(`/feedback/${id}/status`, { status: next });
      setFeedback((v) =>
        v.map((f) => (f.id === id ? { ...f, status: next } : f)),
      );
      setStatus(
        msg("Đã cập nhật trạng thái phản hồi.", "Feedback status updated."),
      );
    } catch (e) {
      setError(e.response?.data?.error?.message || t.error);
    }
  };
  if (!user)
    return (
      <section className="form-page">
        <p className="eyebrow">{t.controlRoomEyebrow}</p>
        <h1>{t.admin}</h1>
        <form className="form-card" onSubmit={login}>
          <h2>{t.login}</h2>
          <label>
            {t.email}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary">{t.login} →</button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    );
  const tabs = [
    ["overview", msg("Tổng quan", "Overview")],
    ["attractions", msg("Điểm tham quan", "Attractions")],
    ["narration", msg("Thuyết minh", "Narration")],
    ["tours", msg("Lộ trình", "Routes")],
    ["feedback", msg("Phản hồi", "Feedback")],
    ["analytics", msg("Thống kê", "Analytics")],
    ["qr", msg("Mã QR", "QR codes")],
  ];
  return (
    <section className="form-page admin-page">
      <p className="eyebrow">{t.controlRoomEyebrow}</p>
      <div className="section-head">
        <div>
          <h1>{t.admin}</h1>
          <p className="small">
            {user.email} · {msg("Quản trị viên", "Administrator")}
          </p>
        </div>
        <button className="secondary" onClick={logout}>
          {t.logout}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="notice" role="status">
          {status}
          <button onClick={() => setStatus("")}>×</button>
        </p>
      )}
      <div className="admin-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setError("");
              setStatus("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="stats">
            <div>
              <strong>{attractions.filter((a) => a.visible).length}</strong>
              <span>{msg("Điểm đang hiển thị", "Published attractions")}</span>
            </div>
            <div>
              <strong>
                {
                  attractions.filter((a) => a.narration_vi && a.narration_en)
                    .length
                }
              </strong>
              <span>{msg("Có nội dung song ngữ", "Bilingual scripts")}</span>
            </div>
            <div>
              <strong>{tours.length}</strong>
              <span>{msg("Lộ trình", "Routes")}</span>
            </div>
            <div>
              <strong>{feedback.length}</strong>
              <span>{msg("Phản hồi", "Feedback items")}</span>
            </div>
          </div>
          <div className="form-card">
            <h2>{msg("Tình trạng dữ liệu", "Data status")}</h2>
            <p>
              {msg(
                "Thống kê được lấy trực tiếp từ API backend.",
                "Statistics are loaded from the backend API.",
              )}
            </p>
            <button className="secondary" onClick={load}>
              {msg("Làm mới dữ liệu", "Refresh data")}
            </button>
          </div>
        </>
      )}
      {tab === "attractions" && (
        <div className="admin-grid">
          <div className="form-card">
            <h2>
              {editing
                ? msg("Chỉnh sửa điểm", "Edit attraction")
                : msg("Thêm điểm tham quan", "Add attraction")}
            </h2>
            <form onSubmit={saveAttraction} className="admin-form">
              <label>
                {t.idSlug}
                <input
                  required
                  disabled={editing}
                  value={draft.id}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      id: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  placeholder="main-building"
                />
              </label>
              <div className="two-fields">
                <label>
                  {msg("Tên tiếng Việt", "Vietnamese name")}
                  <input
                    required
                    value={draft.name_vi}
                    onChange={(e) =>
                      setDraft({ ...draft, name_vi: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Tên tiếng Anh", "English name")}
                  <input
                    required
                    value={draft.name_en}
                    onChange={(e) =>
                      setDraft({ ...draft, name_en: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="two-fields">
                <label>
                  {msg("Mô tả tiếng Việt", "Vietnamese summary")}
                  <textarea
                    required
                    value={draft.description_vi}
                    onChange={(e) =>
                      setDraft({ ...draft, description_vi: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Mô tả tiếng Anh", "English summary")}
                  <textarea
                    required
                    value={draft.description_en}
                    onChange={(e) =>
                      setDraft({ ...draft, description_en: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="two-fields">
                <label>
                  {msg("Khu vực (VI)", "Area (VI)")}
                  <input
                    value={draft.area_vi}
                    onChange={(e) =>
                      setDraft({ ...draft, area_vi: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Khu vực (EN)", "Area (EN)")}
                  <input
                    value={draft.area_en}
                    onChange={(e) =>
                      setDraft({ ...draft, area_en: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="two-fields">
                <label>
                  {t.latitude}
                  <input
                    type="number"
                    step="any"
                    value={draft.latitude}
                    onChange={(e) =>
                      setDraft({ ...draft, latitude: e.target.value })
                    }
                  />
                </label>
                <label>
                  {t.longitude}
                  <input
                    type="number"
                    step="any"
                    value={draft.longitude}
                    onChange={(e) =>
                      setDraft({ ...draft, longitude: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="two-fields">
                <label>
                  {msg("Thứ tự", "Sort order")}
                  <input
                    type="number"
                    min="1"
                    value={draft.sort_order}
                    onChange={(e) =>
                      setDraft({ ...draft, sort_order: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Thời lượng (phút)", "Duration (minutes)")}
                  <input
                    type="number"
                    min="1"
                    value={draft.duration_minutes}
                    onChange={(e) =>
                      setDraft({ ...draft, duration_minutes: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                {msg("URL nguồn tham khảo", "Reference URL")}
                <input
                  type="url"
                  value={draft.source_url || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, source_url: e.target.value })
                  }
                />
              </label>
              <div className="two-fields">
                <label>
                  {msg("Thuyết minh VI", "Narration VI")}
                  <textarea
                    required
                    rows="5"
                    value={draft.narration_vi}
                    onChange={(e) =>
                      setDraft({ ...draft, narration_vi: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Thuyết minh EN", "Narration EN")}
                  <textarea
                    required
                    rows="5"
                    value={draft.narration_en}
                    onChange={(e) =>
                      setDraft({ ...draft, narration_en: e.target.value })
                    }
                  />
                </label>
              </div>
              {editing && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!draft.visible}
                      onChange={(e) =>
                        setDraft({ ...draft, visible: e.target.checked })
                      }
                    />
                    {msg("Hiển thị điểm tham quan", "Attraction visible")}
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!draft.narration_published}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          narration_published: e.target.checked,
                        })
                      }
                    />
                    {msg("Công bố nội dung thuyết minh", "Publish narration")}
                  </label>
                </>
              )}
              <div className="form-actions">
                <button className="primary" type="submit">
                  {msg("Lưu điểm tham quan", "Save attraction")}
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setDraft(empty);
                    setEditing(false);
                  }}
                >
                  {msg("Làm mới form", "Clear form")}
                </button>
              </div>
            </form>
          </div>
          <div className="form-card">
            <h2>{msg("Danh sách địa điểm", "Attraction catalogue")}</h2>
            <div className="admin-list">
              {attractions.map((a) => (
                <div className="admin-list-row" key={a.id}>
                  <div>
                    <strong>{localizedField(a, "name", lang) || t.unavailable}</strong>
                    <small>
                      {a.id} ·{" "}
                      {a.visible
                        ? msg("Đang hiển thị", "Published")
                        : msg("Đã ẩn", "Hidden")}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button
                      className="secondary small-button"
                      onClick={() => startEdit(a)}
                    >
                      {msg("Sửa", "Edit")}
                    </button>
                    {a.visible && (
                      <button
                        className="secondary small-button"
                        onClick={() => hideAttraction(a)}
                      >
                        {msg("Ẩn", "Hide")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === "narration" && (
        <div className="form-card">
          <h2>
            {msg("Quản lý kịch bản song ngữ", "Manage bilingual narration")}
          </h2>
          <label>
            {msg("Chọn điểm tham quan", "Choose attraction")}
            <select
              value={draft.id}
              onChange={async (e) => {
                const a = attractions.find((x) => x.id === e.target.value);
                if (a) {
                  setDraft({
                    ...empty,
                    ...a,
                    latitude: a.latitude ?? "",
                    longitude: a.longitude ?? "",
                  });
                  try {
                    const r = await api.get(
                      `/narrations/admin/${encodeURIComponent(a.id)}`,
                    );
                    setDraft((v) => ({
                      ...v,
                      audio_vi:
                        r.data.data.audio?.find((x) => x.language === "vi")
                          ?.audio_url || "",
                      audio_en:
                        r.data.data.audio?.find((x) => x.language === "en")
                          ?.audio_url || "",
                    }));
                  } catch {}
                } else setDraft({ ...empty, id: e.target.value });
              }}
            >
              <option value="">—</option>
              {attractions.map((a) => (
                <option key={a.id} value={a.id}>
                  {localizedField(a, "name", "vi")} / {localizedField(a, "name", "en")}
                </option>
              ))}
            </select>
          </label>
          {draft.id && (
            <form className="admin-form" onSubmit={saveNarration}>
              <label>
                {msg("Kịch bản tiếng Việt", "Vietnamese narration")}
                <textarea
                  rows="8"
                  required
                  value={draft.narration_vi}
                  onChange={(e) =>
                    setDraft({ ...draft, narration_vi: e.target.value })
                  }
                />
              </label>
              <label>
                {msg("Kịch bản tiếng Anh", "English narration")}
                <textarea
                  rows="8"
                  required
                  value={draft.narration_en}
                  onChange={(e) =>
                    setDraft({ ...draft, narration_en: e.target.value })
                  }
                />
              </label>
              <div className="two-fields">
                <label>
                  {msg("URL audio tiếng Việt", "Vietnamese audio URL")}
                  <input
                    type="url"
                    value={draft.audio_vi || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, audio_vi: e.target.value })
                    }
                    placeholder="https://.../vi.mp3"
                  />
                </label>
                <label>
                  {msg("URL audio tiếng Anh", "English audio URL")}
                  <input
                    type="url"
                    value={draft.audio_en || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, audio_en: e.target.value })
                    }
                    placeholder="https://.../en.mp3"
                  />
                </label>
              </div>
              <p className="small">
                {msg(
                  "Có thể gắn audio bằng URL; chức năng tải tệp trực tiếp chưa được bật trong MVP.",
                  "Audio can be linked by URL; local file upload is not enabled in this MVP.",
                )}
              </p>
              <button className="primary">
                {msg("Lưu kịch bản", "Save narration")}
              </button>
            </form>
          )}
        </div>
      )}
      {tab === "tours" && (
        <div className="admin-grid">
          <div className="form-card">
            <h2>{msg("Tạo / chỉnh sửa lộ trình", "Create / edit route")}</h2>
            <form className="admin-form" onSubmit={saveTour}>
              <label>
                ID
                <input
                  required
                  disabled={tours.some((t) => t.id === tourDraft.id)}
                  value={tourDraft.id}
                  onChange={(e) =>
                    setTourDraft({
                      ...tourDraft,
                      id: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
              </label>
              <div className="two-fields">
                <label>
                  {msg("Tên tiếng Việt", "Vietnamese name")}
                  <input
                    required
                    value={tourDraft.name_vi}
                    onChange={(e) =>
                      setTourDraft({ ...tourDraft, name_vi: e.target.value })
                    }
                  />
                </label>
                <label>
                  {msg("Tên tiếng Anh", "English name")}
                  <input
                    required
                    value={tourDraft.name_en}
                    onChange={(e) =>
                      setTourDraft({ ...tourDraft, name_en: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="two-fields">
                <label>
                  {msg("Mô tả tiếng Việt", "Vietnamese description")}
                  <textarea
                    value={tourDraft.description_vi}
                    onChange={(e) =>
                      setTourDraft({
                        ...tourDraft,
                        description_vi: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {msg("Mô tả tiếng Anh", "English description")}
                  <textarea
                    value={tourDraft.description_en}
                    onChange={(e) =>
                      setTourDraft({
                        ...tourDraft,
                        description_en: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <fieldset>
                <legend>
                  {msg(
                    "Các điểm trong lộ trình (theo thứ tự chọn)",
                    "Route stops (selection order)",
                  )}
                </legend>
                {attractions
                  .filter((a) => a.visible)
                  .map((a) => (
                    <label className="check-label" key={a.id}>
                      <input
                        type="checkbox"
                        checked={tourDraft.attractionIds.includes(a.id)}
                        onChange={(e) =>
                          setTourDraft({
                            ...tourDraft,
                            attractionIds: e.target.checked
                              ? [...tourDraft.attractionIds, a.id]
                              : tourDraft.attractionIds.filter(
                                  (id) => id !== a.id,
                                ),
                          })
                        }
                      />
                      {localizedField(a, "name", lang) || t.unavailable}
                    </label>
                  ))}
              </fieldset>
              <button className="primary">
                {msg("Lưu lộ trình", "Save route")}
              </button>
            </form>
          </div>
          <div className="form-card">
            <h2>{msg("Lộ trình hiện có", "Existing routes")}</h2>
            {tours.map((t) => (
              <div className="admin-list-row" key={t.id}>
                <div>
                  <strong>{localizedField(t, "name", lang) || t.unavailable}</strong>
                  <small>
                    {t.id} · {(t.stops || []).length} {msg("điểm", "stops")}
                  </small>
                </div>
                <button
                  className="secondary small-button"
                  onClick={() =>
                    setTourDraft({
                      id: t.id,
                      name_vi: t.name_vi,
                      name_en: t.name_en,
                      description_vi: t.description_vi,
                      description_en: t.description_en,
                      attractionIds: (t.stops || [])
                        .sort((a, b) => a.stop_order - b.stop_order)
                        .map((s) => s.id),
                    })
                  }
                >
                  {msg("Sửa", "Edit")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "feedback" && (
        <div className="form-card">
          <h2>{msg("Hộp thư phản hồi", "Feedback inbox")}</h2>
          {feedback.length === 0 ? (
            <p>{msg("Chưa có phản hồi.", "No feedback yet.")}</p>
          ) : (
            <div className="admin-list">
              {feedback.map((f) => (
                <div className="feedback-row" key={f.id}>
                  <div>
                    <strong>
                      {f.rating}/5 · {f.type}
                    </strong>
                    <p>{f.message}</p>
                    <small>
                      {f.attraction_id ||
                        msg("Không gắn địa điểm", "No attraction")}{" "}
                      ·{" "}
                      {new Date(f.created_at).toLocaleString(
                        LANGUAGES[lang].locale,
                      )}
                    </small>
                  </div>
                  <label>
                    {msg("Trạng thái", "Status")}
                    <select
                      value={f.status}
                      onChange={(e) => updateFeedback(f.id, e.target.value)}
                    >
                      <option value="new">{t.feedbackNew}</option>
                      <option value="reviewing">{t.feedbackReviewing}</option>
                      <option value="resolved">{t.feedbackResolved}</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "analytics" && <AnalyticsDashboard lang={lang} />}
      {tab === "qr" && (
        <QrCodeManager
          attractions={attractions.filter((a) => a.visible)}
          lang={lang}
        />
      )}
    </section>
  );
}

export default App;
