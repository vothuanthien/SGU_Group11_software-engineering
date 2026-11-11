import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import api from "./api.js";
import { trackEvent } from "./analytics.js";
import AnalyticsDashboard from "./components/AnalyticsDashboard.jsx";
import QrCodeManager from "./components/QrCodeManager.jsx";
const words = {
  vi: {
    home: "Khám phá Dinh Độc Lập",
    sub: "Lắng nghe những câu chuyện lịch sử theo cách của bạn.",
    start: "Bắt đầu tham quan",
    map: "Bản đồ & điểm tham quan",
    route: "Lộ trình gợi ý",
    manual: "Chọn điểm thủ công",
    auto: "Thuyết minh tự động",
    on: "Bật",
    off: "Tắt",
    listen: "Nghe thuyết minh",
    stop: "Dừng đọc",
    text: "Nội dung thuyết minh",
    all: "Tất cả điểm tham quan",
    back: "Quay lại",
    backMap: "Quay lại bản đồ tham quan",
    area: "Khu vực",
    duration: "phút",
    visited: "Đã tham quan",
    mark: "Đánh dấu đã tham quan",
    send: "Gửi phản hồi",
    rating: "Đánh giá",
    message: "Nhận xét của bạn",
    kind: "Loại phản hồi",
    review: "Đánh giá trải nghiệm",
    accuracy: "Báo cáo nội dung",
    audio: "Lỗi âm thanh",
    location: "Lỗi vị trí",
    admin: "Quản trị",
    login: "Đăng nhập quản trị",
    email: "Email",
    password: "Mật khẩu",
    logout: "Đăng xuất",
    dashboard: "Tổng quan",
    error: "Không tải được dữ liệu. Hãy thử tải lại.",
    gps: "Định vị",
    gpsDenied: "Không lấy được GPS; bạn vẫn có thể chọn điểm thủ công.",
    language: "English",
    progress: "Tiến độ",
    source: "Nguồn tham khảo",
    playTip: "Âm thanh dùng giọng đọc có sẵn trên trình duyệt.",
  },
  en: {
    home: "Explore Independence Palace",
    sub: "Listen to history in your own way.",
    start: "Start your visit",
    map: "Map & attractions",
    route: "Suggested tour",
    manual: "Choose a stop",
    auto: "Automatic narration",
    on: "On",
    off: "Off",
    listen: "Listen to narration",
    stop: "Stop reading",
    text: "Narration text",
    all: "All attractions",
    back: "Back",
    backMap: "Back to map & attractions",
    area: "Area",
    duration: "min",
    visited: "Visited",
    mark: "Mark as visited",
    send: "Send feedback",
    rating: "Rating",
    message: "Your comment",
    kind: "Feedback type",
    review: "Visitor review",
    accuracy: "Content report",
    audio: "Audio issue",
    location: "Location issue",
    admin: "Admin",
    login: "Admin login",
    email: "Email",
    password: "Password",
    logout: "Log out",
    dashboard: "Dashboard",
    error: "Could not load data. Please retry.",
    gps: "Location",
    gpsDenied: "Location unavailable; manual selection still works.",
    language: "Tiếng Việt",
    progress: "Progress",
    source: "Reference",
    playTip: "Speech uses voices available in your browser.",
  },
};
const attractionImages = {
  "main-building": { src: "/images/main-building.jpg", alt: "Mặt tiền Tòa nhà chính" },
  "front-lawn": { src: "/images/front-lawn.jpg", alt: "Thảm cỏ và khuôn viên phía trước Dinh Độc Lập" },
  "helicopter-pad": { src: "/images/helicopter-pad.jpg", alt: "Sân đáp trực thăng trên sân thượng" },
  "conference-room": { src: "/images/ceremonial-hall.jpg", alt: "Không gian phòng khánh tiết" },
  "cabinet-room": { src: "/images/carbinet-room.jpg", alt: "Nội thất phòng nội các" },
  exhibition: { src: "/images/ceremonial-area.jpg", alt: "Không gian trưng bày tư liệu" },
  basement: { src: "/images/basement.jpg", alt: "Thiết bị trong khu tầng hầm" },
  garden: { src: "/images/garden.jpg", alt: "Vườn và khuôn viên Dinh Độc Lập" },
};
const numberedMarkerIcon = (number, gold = false) =>
  L.divIcon({
    className: `attraction-marker${gold ? " attraction-marker-gold" : ""}`,
    html: `<span><b>${String(number).padStart(2, "0")}</b></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });

const routeOriginIcon = L.divIcon({
  className: "route-origin-marker",
  html: "<span>A</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 19 });
    }
  }, [map, points]);
  return null;
}
function App() {
  const location = useLocation();
  const [lang, setLang] = useState(localStorage.getItem("dinh_lang") || "vi");
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
  const t = words[lang];
  useEffect(() => {
    localStorage.setItem("dinh_lang", lang);
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
    if (!match) {
      trackedLocationRef.current = `not-place:${location.key}:${location.pathname}`;
      return;
    }
    const routeKey = `${location.key}:${location.pathname}${location.search}`;
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
    Promise.all([api.get("/attractions"), api.get("/tours")])
      .then(([a, b]) => {
        setAttractions(a.data.data || []);
        setTours(b.data.data || []);
        setError("");
      })
      .catch(() => setError(t.error));
  }, []);
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
          {lang === "vi"
            ? "Thống kê dùng mã ẩn danh"
            : "Analytics use anonymous IDs"}{" "}
          · Demo • Việt / English
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
}) {
  const [n, setN] = useState(null);
  const [narrationError, setNarrationError] = useState("");
  const audioRef = useRef(null);
  useEffect(() => {
    setN(null);
    setNarrationError("");
    api
      .get(`/narrations/${id}/${lang}`)
      .then((r) => setN(r.data.data))
      .catch((e) =>
        setNarrationError(
          e.response?.data?.error?.message ||
            (lang === "vi"
              ? "Chưa có nội dung thuyết minh được công bố."
              : "No published narration is available."),
        ),
      );
    return () => {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, [id, lang]);
  const a = attractions.find((x) => x.id === id);
  if (!a) return <div className="empty">{t.error}</div>;
  const image = attractionImages[a.id];
  const play = async () => {
    if (n?.audioUrl && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        return;
      }
      try {
        await audioRef.current.play();
      } catch {
        setNarrationError(
          lang === "vi"
            ? "Không phát được tệp audio; thử dùng giọng đọc trình duyệt."
            : "Audio could not play; trying browser speech.",
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
            <img src={image.src} alt={image.alt} />
            <figcaption>
              {lang === "vi" ? a.name_vi : a.name_en} · Dinh Độc Lập
            </figcaption>
          </figure>
        )}
        <div className="detail-copy">
          <p className="eyebrow">{lang === "vi" ? a.area_vi : a.area_en}</p>
          <h1>{lang === "vi" ? a.name_vi : a.name_en}</h1>
          <p className="lead">
            {lang === "vi" ? a.description_vi : a.description_en}
          </p>
      <div className="player">
        <div className="player-icon">♫</div>
        <div className="player-info">
          <strong>{t.listen}</strong>
          <span>
            {a.duration_minutes} {t.duration} ·{" "}
            {n?.audioUrl ? "Audio file" : "Web Speech"}
          </span>
        </div>
        <button
          className="play"
          onClick={play}
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
        <Link
          className="secondary"
          to={`/map?destination=${encodeURIComponent(a.id)}`}
        >
          {lang === "vi" ? "Chỉ đường đến đây" : "Get directions"} ↗
        </Link>
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
            {lang === "vi" ? "Địa điểm tham quan" : "Explore attractions"}
          </h2>
          <span>{attractions.length} {lang === "vi" ? "điểm" : "places"}</span>
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
                  <img src={placeImage.src} alt={placeImage.alt} loading="lazy" />
                ) : (
                  <span className="detail-gallery-placeholder" aria-hidden="true">⌖</span>
                )}
                <span className="detail-gallery-label">
                  {lang === "vi" ? place.name_vi : place.name_en}
                  <small>{lang === "vi" ? place.area_vi : place.area_en}</small>
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
  const location = useLocation();
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [originMode, setOriginMode] = useState(gps ? "gps" : "attraction");
  const [originAttractionId, setOriginAttractionId] = useState("front-lawn");
  const [currentGps, setCurrentGps] = useState(gps || null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const queryDestinationRef = useRef("");

  useEffect(() => {
    if (gps) {
      setCurrentGps(gps);
      setOriginMode((current) => current === "gps" ? "gps" : current);
    }
  }, [gps]);

  const requestRoute = useCallback(async (destinationId) => {
    if (!destinationId) return;
    const fallbackOrigin = attractions.find(
      (item) => item.id === originAttractionId && item.id !== destinationId &&
        item.latitude != null && item.longitude != null,
    ) || attractions.find(
      (item) => item.id !== destinationId && item.latitude != null && item.longitude != null,
    );

    const useGps = originMode === "gps" && currentGps;
    const effectiveOriginId = fallbackOrigin?.id || originAttractionId;
    if (!useGps && effectiveOriginId !== originAttractionId) {
      setOriginAttractionId(effectiveOriginId);
    }
    const payload = {
      destinationId,
      ...(useGps
        ? { origin: currentGps }
        : { originAttractionId: effectiveOriginId }),
    };

    setRouteLoading(true);
    setRouteError("");
    setRoute(null);
    try {
      const response = await api.post("/navigation/route", payload);
      const data = response.data?.data;
      if (!data || !Array.isArray(data.coordinates) || data.coordinates.length < 1) {
        throw new Error(lang === "vi" ? "Dịch vụ điều hướng không trả về tọa độ tuyến đường." : "Navigation did not return route coordinates.");
      }
      setRoute(data);
    } catch (error) {
      setRouteError(
        error.response?.data?.error?.message || error.message ||
          (lang === "vi" ? "Không tạo được lộ trình. Vui lòng thử lại." : "Could not build the route. Please try again."),
      );
    } finally {
      setRouteLoading(false);
    }
  }, [attractions, currentGps, lang, originAttractionId, originMode]);

  const selectDestination = (destinationId) => {
    setSelectedDestinationId(destinationId);
    requestRoute(destinationId);
  };

  useEffect(() => {
    const destinationId = new URLSearchParams(location.search).get("destination");
    if (!destinationId || !attractions.length || queryDestinationRef.current === destinationId) return;
    if (!attractions.some((item) => item.id === destinationId)) return;
    queryDestinationRef.current = destinationId;
    setSelectedDestinationId(destinationId);
    requestRoute(destinationId);
  }, [attractions, location.search, requestRoute]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setRouteError(lang === "vi" ? "Trình duyệt không hỗ trợ định vị." : "Geolocation is not supported by this browser.");
      return;
    }
    setRouteError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentGps({ lat: position.coords.latitude, lng: position.coords.longitude });
        setOriginMode("gps");
        setNotice(lang === "vi" ? "Đã lấy vị trí hiện tại." : "Current location acquired.");
      },
      () => setRouteError(lang === "vi"
        ? "Không lấy được GPS. Bạn có thể chọn điểm xuất phát thủ công."
        : "Could not get GPS. You can choose a starting point manually."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 },
    );
  };

  const mapPoints = useMemo(() => {
    if (route?.coordinates?.length) return route.coordinates;
    return attractions
      .filter((item) => item.latitude != null && item.longitude != null)
      .map((item) => [Number(item.latitude), Number(item.longitude)]);
  }, [attractions, route]);

  const selectedDestination = attractions.find((item) => item.id === selectedDestinationId);
  const routeDistance = route?.distanceMeters >= 1000
    ? `${(route.distanceMeters / 1000).toFixed(2)} km`
    : `${Math.round(route?.distanceMeters || 0)} m`;

  return (
    <section className="map-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">EXPLORE</p>
          <h1>{t.map}</h1>
          <p className="map-intro">
            {lang === "vi"
              ? "Chọn một điểm tham quan để xem hướng di chuyển từ vị trí hiện tại hoặc điểm xuất phát bạn chọn."
              : "Choose an attraction to see guidance from your current location or a starting point you select."}
          </p>
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
        <aside className="map-sidebar">
          <div className="map-list" aria-label={lang === "vi" ? "Danh sách điểm tham quan" : "Attraction list"}>
            {attractions.map((a, i) => (
              <button
                type="button"
                className={`map-row${selectedDestinationId === a.id ? " is-selected" : ""}`}
                onClick={() => selectDestination(a.id)}
                key={a.id}
                aria-pressed={selectedDestinationId === a.id}
              >
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span>
                  <strong>{lang === "vi" ? a.name_vi : a.name_en}</strong>
                  <small>{lang === "vi" ? a.area_vi : a.area_en}</small>
                </span>
                <span aria-hidden="true">{selectedDestinationId === a.id ? "●" : "↗"}</span>
              </button>
            ))}
          </div>

          <section className="map-route-card" aria-live="polite">
            <p className="eyebrow">{lang === "vi" ? "HƯỚNG DẪN DI CHUYỂN" : "DIRECTIONS"}</p>
            <h2>{lang === "vi" ? "Lộ trình của bạn" : "Your route"}</h2>
            <label className="map-origin-label" htmlFor="map-origin">
              {lang === "vi" ? "Điểm xuất phát" : "Starting point"}
            </label>
            <select
              id="map-origin"
              value={originMode === "gps" && currentGps ? "__gps__" : originAttractionId}
              onChange={(event) => {
                if (event.target.value === "__gps__") setOriginMode("gps");
                else {
                  setOriginAttractionId(event.target.value);
                  setOriginMode("attraction");
                }
              }}
            >
              <option value="__gps__" disabled={!currentGps}>
                {lang === "vi" ? "Vị trí hiện tại (GPS)" : "Current location (GPS)"}
                {!currentGps ? (lang === "vi" ? " – chưa lấy được" : " – unavailable") : ""}
              </option>
              {attractions.filter((item) => item.latitude != null && item.longitude != null).map((item) => (
                <option value={item.id} key={item.id}>
                  {lang === "vi" ? item.name_vi : item.name_en}
                </option>
              ))}
            </select>
            <div className="map-route-controls">
              <button type="button" className="secondary" onClick={requestCurrentLocation}>
                {lang === "vi" ? "Lấy vị trí GPS" : "Use my location"}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!selectedDestinationId || routeLoading}
                onClick={() => requestRoute(selectedDestinationId)}
              >
                {routeLoading
                  ? (lang === "vi" ? "Đang tính..." : "Calculating...")
                  : (lang === "vi" ? "Cập nhật lộ trình" : "Update route")}
              </button>
            </div>

            {!selectedDestination && (
              <p className="map-route-empty">
                {lang === "vi" ? "Chọn một điểm trong danh sách hoặc chạm vào marker trên bản đồ." : "Choose a stop from the list or tap a map marker."}
              </p>
            )}
            {routeLoading && <p className="map-route-status">{lang === "vi" ? "Đang lấy hướng dẫn..." : "Loading directions..."}</p>}
            {routeError && <p className="map-route-error" role="alert">{routeError}</p>}
            {route && selectedDestination && (
              <div className="map-route-result">
                <strong>{lang === "vi" ? selectedDestination.name_vi : selectedDestination.name_en}</strong>
                <div className="map-route-stats">
                  <span><b>{routeDistance}</b><small>{lang === "vi" ? "Khoảng cách ước tính" : "Estimated distance"}</small></span>
                  <span><b>{route.durationMinutes} {lang === "vi" ? "phút" : "min"}</b><small>{lang === "vi" ? "Thời gian đi bộ ước tính" : "Estimated walking time"}</small></span>
                </div>
                <p>{lang === "vi" ? route.instructionVi : route.instructionEn}</p>
                <p className="map-route-notice">
                  {lang === "vi"
                    ? "Đường nét đứt là hướng nối tham khảo theo tọa độ, không phải sơ đồ lối đi trong nhà. GPS trong nhà có thể sai lệch; hãy theo biển chỉ dẫn và hướng dẫn của nhân viên."
                    : "The dashed line is a coordinate-based reference, not an indoor floor plan. GPS may be inaccurate indoors; follow on-site signs and staff guidance."}
                </p>
                <Link className="map-route-narration" to={`/place/${encodeURIComponent(selectedDestination.id)}`}>
                  {lang === "vi" ? "Mở thuyết minh điểm này" : "Open this attraction"} →
                </Link>
              </div>
            )}
          </section>
        </aside>

        <div className="map-frame">
          <MapContainer
            center={gps ? [gps.lat, gps.lng] : [10.7768, 106.6953]}
            zoom={18}
            scrollWheelZoom
            style={{ height: "100%", minHeight: 500, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <MapViewport points={mapPoints} />
            {attractions
              .filter((a) => a.latitude != null && a.longitude != null)
              .map((a, i) => (
                <Marker
                  key={a.id}
                  position={[Number(a.latitude), Number(a.longitude)]}
                  icon={numberedMarkerIcon(i + 1, selectedDestinationId === a.id || i % 2 === 1)}
                  eventHandlers={{ click: () => selectDestination(a.id) }}
                >
                  <Popup>
                    <strong>{lang === "vi" ? a.name_vi : a.name_en}</strong>
                    <br />
                    <button type="button" className="map-popup-action" onClick={() => selectDestination(a.id)}>
                      {lang === "vi" ? "Chọn làm điểm đến" : "Set as destination"}
                    </button>
                    <br />
                    <Link to={`/place/${encodeURIComponent(a.id)}`}>{t.listen}</Link>
                  </Popup>
                </Marker>
              ))}
            {route?.coordinates?.length > 1 && (
              <>
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{ color: "#c28d43", weight: 5, opacity: 0.95, dashArray: "10 8" }}
                />
                <Marker position={route.coordinates[0]} icon={routeOriginIcon}>
                  <Popup>{lang === "vi" ? "Điểm xuất phát" : "Starting point"}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        </div>
      </div>
      <p className="small map-gps-note">
        {t.gps}: {currentGps ? `${currentGps.lat.toFixed(4)}, ${currentGps.lng.toFixed(4)}` : t.gpsDenied} ·
        {lang === "vi" ? " GPS trong nhà có thể không chính xác." : " Indoor GPS may be inaccurate."}
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
      setStatus(
        lang === "vi"
          ? "Đã gửi phản hồi. Cảm ơn bạn!"
          : "Feedback sent. Thank you!",
      );
      setForm({ ...form, message: "" });
    } catch (e) {
      setStatus(e.response?.data?.error?.message || "Không gửi được phản hồi.");
    }
  };
  return (
    <section className="form-page">
      <p className="eyebrow">YOUR VOICE MATTERS</p>
      <h1>{t.send}</h1>
      <form onSubmit={submit} className="form-card">
        <label>
          Điểm tham quan
          <select
            value={form.attractionId}
            onChange={(e) => setForm({ ...form, attractionId: e.target.value })}
          >
            <option value="">Không chọn</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>
                {lang === "vi" ? a.name_vi : a.name_en}
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
  const isVi = lang === "vi";
  const [email, setEmail] = useState("admin@dinhguide.local"),
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
  const msg = (vi, en) => (isVi ? vi : en);
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
  }, [user]);
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
    if (!window.confirm(msg(`Ẩn điểm “${a.name_vi}”?`, `Hide “${a.name_en}”?`)))
      return;
    try {
      await api.delete(`/attractions/${encodeURIComponent(a.id)}`);
      setStatus(msg("Đã ẩn điểm tham quan.", "Attraction hidden."));
      await load();
    } catch (e) {
      setError(e.response?.data?.error?.message || "Request failed");
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
      setError(e.response?.data?.error?.message || "Request failed");
    }
  };
  if (!user)
    return (
      <section className="form-page">
        <p className="eyebrow">CONTROL ROOM</p>
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
          <p className="small">Demo: admin@dinhguide.local / Admin123!</p>
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
      <p className="eyebrow">CONTROL ROOM</p>
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
                ID (slug)
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
                  Latitude
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
                  Longitude
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
                    <strong>{isVi ? a.name_vi : a.name_en}</strong>
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
                  {a.name_vi} / {a.name_en}
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
                      {isVi ? a.name_vi : a.name_en}
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
                  <strong>{isVi ? t.name_vi : t.name_en}</strong>
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
                      · {new Date(f.created_at).toLocaleString()}
                    </small>
                  </div>
                  <label>
                    {msg("Trạng thái", "Status")}
                    <select
                      value={f.status}
                      onChange={(e) => updateFeedback(f.id, e.target.value)}
                    >
                      <option value="new">new</option>
                      <option value="reviewing">reviewing</option>
                      <option value="resolved">resolved</option>
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
