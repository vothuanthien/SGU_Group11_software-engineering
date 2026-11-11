import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../api.js";

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

export default function MapPage({ attractions, lang, t, gps, auto, setAuto, setNotice }) {
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
