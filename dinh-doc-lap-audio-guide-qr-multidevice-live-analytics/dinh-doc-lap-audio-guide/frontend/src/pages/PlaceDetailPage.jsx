import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api.js";
import { trackEvent } from "../analytics.js";
import { attractionImages } from "../constants/appContent.js";

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

export default function PlaceDetailPage(props) {
  const { id } = useParams();
  return <Detail {...props} id={id} />;
}
