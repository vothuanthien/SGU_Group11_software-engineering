import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { localizedField, translatePair } from "../i18n.js";

const QR_BASE_URL_KEY = "dinh_qr_base_url";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopback(hostname) {
  return LOOPBACK_HOSTS.has(String(hostname || "").toLowerCase());
}

function initialBaseUrl() {
  try {
    const saved = localStorage.getItem(QR_BASE_URL_KEY);
    if (saved) return saved;
  } catch {
    // Storage may be unavailable; the field remains editable.
  }
  // If the admin opened the app using a LAN IP or public domain, that same
  // origin is reachable to other devices. Never silently encode localhost.
  return isLoopback(window.location.hostname) ? "" : window.location.origin;
}

function parseBaseUrl(value) {
  if (!value.trim()) return null;
  try {
    const parsed = new URL(value.trim().replace(/\/+$/, ""));
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname)
      return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildQrTargetUrl(normalizedBase, destination, selectedId) {
  if (!normalizedBase) return "";
  if (destination === "home") return `${normalizedBase}/?source=qr`;
  if (!selectedId) return "";
  return `${normalizedBase}/place/${encodeURIComponent(selectedId)}?source=qr`;
}

export default function QrCodeManager({ attractions = [], lang = "vi" }) {
  const msg = (vi, en) => translatePair(lang, vi, en);
  const [destination, setDestination] = useState("home");
  const [selectedId, setSelectedId] = useState(attractions[0]?.id || "");
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedId && attractions.length) setSelectedId(attractions[0].id);
  }, [attractions, selectedId]);

  useEffect(() => {
    try {
      if (baseUrl.trim()) localStorage.setItem(QR_BASE_URL_KEY, baseUrl.trim());
    } catch {
      // QR creation still works when browser storage is unavailable.
    }
  }, [baseUrl]);

  const selected = attractions.find((item) => item.id === selectedId);
  const parsedBase = useMemo(() => parseBaseUrl(baseUrl), [baseUrl]);
  const isLoopbackBase = parsedBase ? isLoopback(parsedBase.hostname) : false;
  const normalizedBase = parsedBase ? parsedBase.origin : "";
  const targetUrl = useMemo(
    () => buildQrTargetUrl(normalizedBase, destination, selected?.id),
    [destination, normalizedBase, selected?.id],
  );

  const downloadSvg = () => {
    const svg = document.querySelector("#qr-code-preview svg");
    if (!svg || !targetUrl) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      destination === "home" ? "qr-home.svg" : `qr-${selected.id}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const copyUrl = async () => {
    if (!targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The URL remains visible/selectable if the browser blocks clipboard.
      setCopied(false);
    }
  };

  return (
    <section className="form-page qr-manager">
      <p className="eyebrow">
        {msg("QUÉT ĐỂ KHÁM PHÁ", "SCAN TO EXPLORE")}
      </p>
      <h2>{msg("Quản lý mã QR", "QR codes")}</h2>
      <p className="small">
        {msg(
          "Tạo mã QR mở trang chủ hoặc mở thẳng trang thuyết minh của một địa điểm. Khi khách mở liên kết QR, bắt đầu nghe hoặc nghe hết, hệ thống ghi các sự kiện vào PostgreSQL để dashboard thống kê.",
          "Create a QR code for the home page or a specific attraction. Opening a QR link, starting narration and completing narration are saved to PostgreSQL for the dashboard.",
        )}
      </p>

      <div className="qr-manager-grid">
        <div className="form-card">
          <label>
            {msg("Nơi mở khi quét mã", "Open this page when scanned")}
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="home">{msg("Trang chủ", "Home page")}</option>
              <option value="place">
                {msg("Trang địa điểm", "Attraction page")}
              </option>
            </select>
          </label>

          {destination === "place" && (
            <label>
              {msg("Chọn địa điểm", "Choose attraction")}
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {attractions
                  .filter((item) => item.visible !== false)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {localizedField(item, "name", lang) ||
                        msg("Chưa có nội dung bằng ngôn ngữ này", "Content is not available in this language.")}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <label>
            {msg(
              "Địa chỉ website dùng trong mã QR",
              "Website URL embedded in the QR",
            )}
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={
                lang === "vi"
                  ? "http://192.168.1.20:8080 hoặc https://ten-mien-cua-ban.vn"
                  : lang === "zh"
                    ? "http://192.168.1.20:8080 或 https://your-domain.example"
                    : lang === "th"
                      ? "http://192.168.1.20:8080 หรือ https://your-domain.example"
                      : "http://192.168.1.20:8080 or https://your-domain.example"
              }
              aria-describedby="qr-url-help"
            />
          </label>
          <p id="qr-url-help" className="small">
            {msg(
              "Để thử bằng điện thoại cùng Wi-Fi: trên máy tính mở CMD, chạy ipconfig, tìm IPv4 Address của Wi-Fi/Ethernet rồi nhập http://IP-DO-MAY:8080 (ví dụ http://192.168.1.20:8080). Không nhập localhost hoặc 127.0.0.1 vì chúng trỏ về chính điện thoại khi quét.",
              "For phones on the same Wi-Fi: run ipconfig on the computer, find the Wi-Fi/Ethernet IPv4 Address, then enter http://YOUR-PC-IP:8080 (for example http://192.168.1.20:8080). Do not use localhost or 127.0.0.1: they point to the phone itself when scanned.",
            )}
          </p>
          {!baseUrl.trim() && (
            <p className="qr-url-warning" role="status">
              {msg(
                "Nhập IP LAN của máy tính hoặc domain công khai để tạo QR dùng được trên điện thoại.",
                "Enter the computer LAN IP or a public domain to create a QR usable by phones.",
              )}
            </p>
          )}
          {baseUrl.trim() && !parsedBase && (
            <p className="qr-url-warning" role="alert">
              {msg(
                "URL chưa hợp lệ. Hãy nhập đầy đủ http:// hoặc https:// và tên miền/IP.",
                "Invalid URL. Include http:// or https:// and a domain/IP address.",
              )}
            </p>
          )}
          {isLoopbackBase && (
            <p className="qr-url-warning" role="alert">
              {msg(
                "Cảnh báo: QR này chỉ mở được trên chính thiết bị đang chạy ứng dụng. Hãy thay localhost bằng IPv4 của máy tính để thử bằng điện thoại.",
                "Warning: this QR only works on the device running the app. Replace localhost with the computer IPv4 address to test on a phone.",
              )}
            </p>
          )}
          {parsedBase && !isLoopbackBase && parsedBase.protocol === "http:" && (
            <p className="small">
              {msg(
                "HTTP dùng được để thử trong mạng Wi-Fi nội bộ. Khi phục vụ khách bên ngoài mạng này, hãy triển khai lên domain công khai có HTTPS.",
                "HTTP is suitable for a same-Wi-Fi test. For visitors outside this network, deploy to a public HTTPS domain.",
              )}
            </p>
          )}

          {targetUrl && (
            <>
              <label>
                {msg("Liên kết đích", "Destination URL")}
                <input
                  readOnly
                  value={targetUrl}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="form-actions">
                <button type="button" className="primary" onClick={downloadSvg}>
                  {msg("Tải QR dạng SVG", "Download QR as SVG")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    window.open(targetUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  {msg("Mở thử liên kết", "Test link")}
                </button>
                <button type="button" className="secondary" onClick={copyUrl}>
                  {copied
                    ? msg("Đã sao chép", "Copied")
                    : msg("Sao chép liên kết", "Copy link")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => window.print()}
                >
                  {msg("In trang", "Print page")}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="form-card qr-preview-card">
          {targetUrl ? (
            <>
              <div id="qr-code-preview" className="qr-code-preview">
                <QRCodeSVG
                  value={targetUrl}
                  size={250}
                  level="H"
                  includeMargin
                  title={
                    destination === "home"
                      ? msg("Mã QR trang chủ", "Home page QR code")
                      : `${msg("Mã QR", "QR code")}: ${localizedField(selected, "name", lang) || msg("Chưa có nội dung bằng ngôn ngữ này", "Content is not available in this language.")}`
                  }
                />
              </div>
              <h3>
                {destination === "home"
                  ? msg("Trang chủ", "Home page")
                  : localizedField(selected, "name", lang) ||
                    msg("Chưa có nội dung bằng ngôn ngữ này", "Content is not available in this language.")}
              </h3>
              <p className="small">
                {msg(
                  "Quét bằng camera điện thoại. Nhiều điện thoại có thể dùng cùng mã; mỗi trình duyệt được nhận diện bằng mã ẩn danh riêng.",
                  "Scan with the phone camera. Multiple phones can use the same QR; each browser receives its own anonymous ID.",
                )}
              </p>
              {isLoopbackBase && (
                <p className="qr-url-warning">
                  {msg(
                    "Không in mã này để dùng trên điện thoại khác.",
                    "Do not print this QR for use on another phone.",
                  )}
                </p>
              )}
            </>
          ) : (
            <p>
              {msg(
                "Nhập địa chỉ website hợp lệ để hiển thị mã QR.",
                "Enter a valid website URL to display the QR code.",
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
