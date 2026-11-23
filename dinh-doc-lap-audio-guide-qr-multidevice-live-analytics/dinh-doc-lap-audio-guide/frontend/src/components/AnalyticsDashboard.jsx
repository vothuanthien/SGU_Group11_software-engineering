import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api.js";

const empty = {
  periodDays: 30,
  totals: {
    unique_visitors: 0,
    visitors_today: 0,
    active_now: 0,
    unique_listeners: 0,
    app_opens: 0,
    qr_scans: 0,
    place_opens: 0,
    confirmed_visits: 0,
    listens_started: 0,
    listens_completed: 0,
  },
  languageBreakdown: [],
  topAttractions: [],
  latestListener: null,
  visitorHistory: [],
  daily: [],
  mostUsedLanguage: null,
};

export default function AnalyticsDashboard({ lang = "vi" }) {
  const isVi = lang === "vi";
  const [days, setDays] = useState(30);
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const requestInFlight = useRef(false);

  const msg = (vi, en) => (isVi ? vi : en);

  const load = useCallback(
    async (options = {}) => {
      const silent = Boolean(options.silent);
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      if (!silent) setLoading(true);
      setError("");
      try {
        const response = await api.get(`/analytics/summary?days=${days}`);
        setData(response.data.data || empty);
        setRefreshedAt(new Date());
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            (isVi
              ? "Không tải được thống kê. Hãy kiểm tra đăng nhập và trạng thái dịch vụ analytics."
              : "Could not load analytics. Check your login and the analytics service status."),
        );
      } finally {
        requestInFlight.current = false;
        if (!silent) setLoading(false);
      }
    },
    [days, isVi],
  );

  // Poll while the dashboard is visible. The backend queries PostgreSQL on each
  // refresh, so new events from other phones appear without manually reloading.
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const totals = data.totals || empty.totals;
  const latestListener = data.latestListener;
  const locale = isVi ? "vi-VN" : "en-US";
  const peak = Math.max(
    1,
    ...(data.daily || []).map((x) =>
      Math.max(x.qr_scans || 0, x.listens || 0, x.visits || 0),
    ),
  );
  const langTotal = (data.languageBreakdown || []).reduce(
    (sum, item) => sum + Number(item.listens || 0),
    0,
  );
  const completionRate = Number(totals.listens_started || 0)
    ? Math.round(
        (Number(totals.listens_completed || 0) /
          Number(totals.listens_started)) *
          100,
      )
    : 0;

  const engagementRate = Number(totals.unique_visitors || 0)
    ? Math.round(
        (Number(totals.unique_listeners || 0) /
          Number(totals.unique_visitors)) *
          100,
      )
    : 0;
  const languageLabel = (value) =>
    value === "vi"
      ? msg("Tiếng Việt", "Vietnamese")
      : value === "en"
        ? msg("Tiếng Anh", "English")
        : msg("Chưa có dữ liệu", "No data yet");

  return (
    <section className="analytics-dashboard">
      <div className="section-head analytics-heading">
        <div>
          <p className="eyebrow">VISITOR INSIGHTS</p>
          <h2>{msg("Thống kê tham quan", "Visitor analytics")}</h2>
          <p className="small">
            {msg(
              "Số liệu lấy trực tiếp từ PostgreSQL và tự làm mới mỗi 5 giây. Lượt QR là số lần mở liên kết gắn source=qr; ứng dụng không thể biết camera đã quét nhưng khách chưa mở liên kết.",
              "Data is queried from PostgreSQL and refreshes every 5 seconds. QR counts are opens of links tagged source=qr; the app cannot detect a camera scan if the visitor does not open the link.",
            )}
          </p>
          <p className="small" aria-live="polite">
            {refreshedAt
              ? msg("Cập nhật lần cuối: ", "Last updated: ") + refreshedAt.toLocaleTimeString(isVi ? "vi-VN" : "en-US")
              : msg("Chưa có lần cập nhật thành công.", "No successful refresh yet.")}
          </p>
         
        </div>
        <div className="analytics-tools">
          <label>
            {msg("Khoảng thời gian", "Period")}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>{msg("7 ngày", "7 days")}</option>
              <option value={30}>{msg("30 ngày", "30 days")}</option>
              <option value={90}>{msg("90 ngày", "90 days")}</option>
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {msg("Làm mới", "Refresh")}
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="small" role="status">
          {msg("Đang tải số liệu…", "Loading analytics…")}
        </p>
      )}

      <section className="form-card">
        <h3>{msg("Người nghe gần nhất", "Latest listener")}</h3>
        {latestListener ? (
          <>
            <p className="small">
              {msg("Bắt đầu nghe lúc", "Started listening at")}{" "}
              {new Date(latestListener.last_listened_at).toLocaleString(locale)}
            </p>
            {latestListener.screen_views || latestListener.ui_interactions ? (
              <dl>
                <dt>{msg("Số lượt qua màn hình", "Screen views")}</dt>
                <dd>{latestListener.screen_views.toLocaleString(locale)}</dd>
                <dt>{msg("Số lần thao tác", "UI interactions")}</dt>
                <dd>{latestListener.ui_interactions.toLocaleString(locale)}</dd>
              </dl>
            ) : (
              <p>{msg("Chưa ghi nhận dữ liệu màn hình hoặc thao tác.", "No screen views or interactions recorded yet.")}</p>
            )}
          </>
        ) : (
          <p>{msg("Chưa có lượt nghe trong khoảng thời gian đã chọn.", "No listens in the selected period.")}</p>
        )}
      </section>

      <div className="stats analytics-stats">
        <div>
          <strong>
            {Number(totals.unique_visitors || 0).toLocaleString()}
          </strong>
          <span>{msg("Khách ẩn danh", "Unique anonymous visitors")}</span>
        </div>
        <div className="live-stat">
          <strong>
            <i />
            {Number(totals.active_now || 0).toLocaleString()}
          </strong>
          <span>
            {msg("Đang hoạt động (5 phút)", "Active now (5 minutes)")}
          </span>
        </div>
        <div>
          <strong>{Number(totals.visitors_today || 0).toLocaleString()}</strong>
          <span>{msg("Khách hôm nay", "Visitors today")}</span>
        </div>
        <div>
          <strong>
            {Number(totals.unique_listeners || 0).toLocaleString()}
          </strong>
          <span>
            {msg("Người đã nghe (ẩn danh)", "Unique listeners (anonymous)")}
          </span>
        </div>
        <div>
          <strong>{Number(totals.app_opens || 0).toLocaleString()}</strong>
          <span>{msg("Lượt mở ứng dụng", "App sessions opened")}</span>
        </div>
        <div>
          <strong>{Number(totals.qr_scans || 0).toLocaleString()}</strong>
          <span>{msg("Lượt mở liên kết QR", "QR link opens")}</span>
        </div>
        <div>
          <strong>
            {Number(totals.confirmed_visits || 0).toLocaleString()}
          </strong>
          <span>
            {msg("Lượt đánh dấu đã tham quan", "Visits marked by visitors")}
          </span>
        </div>
        <div>
          <strong>
            {Number(totals.listens_started || 0).toLocaleString()}
          </strong>
          <span>{msg("Lượt bắt đầu nghe", "Narration starts")}</span>
        </div>
        <div>
          <strong>
            {Number(totals.listens_completed || 0).toLocaleString()}
          </strong>
          <span>{msg("Lượt nghe hoàn tất", "Completed narrations")}</span>
        </div>
        <div>
          <strong>{Number(totals.place_opens || 0).toLocaleString()}</strong>
          <span>{msg("Lượt mở trang địa điểm", "Place page views")}</span>
        </div>
      </div>

      <section className="analytics-funnel form-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">ENGAGEMENT FUNNEL</p>
            <h3>{msg("Hành trình sử dụng", "Visitor journey")}</h3>
          </div>
          <span className="small">
            {msg("Không thu thập danh tính thật", "No real identity collected")}
          </span>
        </div>
        <div className="funnel-grid">
          <div>
            <span>{msg("Mở ứng dụng", "App opens")}</span>
            <strong>{Number(totals.app_opens || 0).toLocaleString()}</strong>
          </div>
          <b>→</b>
          <div>
            <span>{msg("Mở địa điểm", "Place views")}</span>
            <strong>{Number(totals.place_opens || 0).toLocaleString()}</strong>
          </div>
          <b>→</b>
          <div>
            <span>{msg("Bắt đầu nghe", "Started listening")}</span>
            <strong>
              {Number(totals.listens_started || 0).toLocaleString()}
            </strong>
          </div>
          <b>→</b>
          <div>
            <span>{msg("Nghe hoàn tất", "Completed")}</span>
            <strong>
              {Number(totals.listens_completed || 0).toLocaleString()}
            </strong>
          </div>
        </div>
        <div className="rate-grid">
          <div>
            <span>{msg("Tỷ lệ khách có nghe", "Visitor listening rate")}</span>
            <strong>{engagementRate}%</strong>
            <div className="bar-track">
              <i style={{ width: `${Math.min(100, engagementRate)}%` }} />
            </div>
          </div>
          <div>
            <span>{msg("Tỷ lệ nghe hoàn tất", "Completion rate")}</span>
            <strong>{completionRate}%</strong>
            <div className="bar-track">
              <i style={{ width: `${Math.min(100, completionRate)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="analytics-grid">
        <section className="form-card">
          <h3>
            {msg("Ngôn ngữ được nghe nhiều nhất", "Most-listened language")}
          </h3>
          <div className="language-leader">
            <strong>{languageLabel(data.mostUsedLanguage)}</strong>
            <span>
              {langTotal.toLocaleString()}{" "}
              {msg("lượt bắt đầu nghe", "listening starts")}
            </span>
          </div>
          {(data.languageBreakdown || []).length === 0 ? (
            <p className="small">
              {msg(
                "Chưa có lượt nghe trong khoảng thời gian này.",
                "No listening events in this period yet.",
              )}
            </p>
          ) : (
            (data.languageBreakdown || []).map((item) => (
              <div className="language-bar-row" key={item.language}>
                <div>
                  <span>{languageLabel(item.language)}</span>
                  <b>{Number(item.listens).toLocaleString()}</b>
                </div>
                <div className="bar-track">
                  <i
                    style={{
                      width: `${langTotal ? (Number(item.listens) / langTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </section>

        <section className="form-card">
          <h3>{msg("Hoạt động theo ngày", "Daily activity")}</h3>
          {(data.daily || []).length === 0 ? (
            <p className="small">
              {msg(
                "Chưa có sự kiện để vẽ biểu đồ.",
                "No events available for the chart yet.",
              )}
            </p>
          ) : null}
          {(data.daily || []).map((row) => (
            <div className="daily-row" key={row.day}>
              <span>{row.day}</span>
              <div className="daily-bars">
                <div title={`${msg("QR", "QR")}: ${row.qr_scans}`}>
                  <i
                    className="qr-bar"
                    style={{ width: `${(Number(row.qr_scans) / peak) * 100}%` }}
                  />
                </div>
                <div title={`${msg("Nghe", "Listens")}: ${row.listens}`}>
                  <i
                    className="listen-bar"
                    style={{ width: `${(Number(row.listens) / peak) * 100}%` }}
                  />
                </div>
                <div title={`${msg("Đã tham quan", "Visits")}: ${row.visits}`}>
                  <i
                    className="visit-bar"
                    style={{ width: `${(Number(row.visits) / peak) * 100}%` }}
                  />
                </div>
              </div>
              <small>
                {Number(row.qr_scans) +
                  Number(row.listens) +
                  Number(row.visits)}
              </small>
            </div>
          ))}
          <div className="chart-legend">
            <span>
              <i className="qr-bar" />
              QR
            </span>
            <span>
              <i className="listen-bar" />
              {msg("Lượt nghe", "Listens")}
            </span>
            <span>
              <i className="visit-bar" />
              {msg("Đã tham quan", "Visits")}
            </span>
          </div>
        </section>
      </div>

      <section className="form-card analytics-table-card">
        <div className="section-head">
          <h3>{msg("Địa điểm được quan tâm", "Most active attractions")}</h3>
          <span className="small">
            {msg("Xếp theo lượt nghe", "Ranked by listens")}
          </span>
        </div>
        {!(data.topAttractions || []).length ? (
          <p className="small">
            {msg("Chưa có dữ liệu hoạt động.", "No activity recorded yet.")}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>{msg("Địa điểm", "Attraction")}</th>
                  <th>QR</th>
                  <th>{msg("Đã tham quan", "Marked visits")}</th>
                  <th>{msg("Người nghe", "Listeners")}</th>
                  <th>{msg("Lượt nghe", "Listen starts")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topAttractions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{isVi ? row.name_vi : row.name_en}</strong>
                      <small>{row.id}</small>
                    </td>
                    <td>{row.qr_scans}</td>
                    <td>{row.confirmed_visits}</td>
                    <td>{row.unique_listeners}</td>
                    <td>{row.listens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="form-card analytics-table-card">
        <div className="section-head">
          <h3>
            {msg(
              "Lịch sử khách ẩn danh theo địa điểm",
              "Anonymous visitor activity by attraction",
            )}
          </h3>
          <span className="small">
            {msg("Tối đa 100 dòng gần nhất", "Up to 100 most recent records")}
          </span>
        </div>
        <p className="small">
          {msg(
            "Mã khách được tạo trên trình duyệt; không phải danh tính thật. Một người dùng thiết bị khác hoặc xóa dữ liệu trình duyệt có thể xuất hiện dưới mã mới.",
            "Visitor IDs are browser-generated pseudonyms, not real identities. A different device or cleared browser storage may produce a new ID.",
          )}
        </p>
        {!(data.visitorHistory || []).length ? (
          <p className="small">
            {msg("Chưa ghi nhận khách nào.", "No visitor records yet.")}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>{msg("Mã khách ẩn danh", "Anonymous visitor")}</th>
                  <th>{msg("Địa điểm", "Attraction")}</th>
                  <th>{msg("Hoạt động", "Activity")}</th>
                  <th>{msg("Ngôn ngữ nghe", "Language")}</th>
                  <th>{msg("Thời điểm cuối", "Last activity")}</th>
                </tr>
              </thead>
              <tbody>
                {data.visitorHistory.map((row, index) => (
                  <tr key={`${row.visitor_id}-${row.id}-${index}`}>
                    <td>
                      <code title={row.visitor_id}>
                        {String(row.visitor_id).slice(0, 8)}…
                      </code>
                    </td>
                    <td>{isVi ? row.name_vi : row.name_en}</td>
                    <td>
                      <div className="activity-tags">
                        {row.scanned_qr && <span>QR</span>}
                        {row.marked_visited && (
                          <span>{msg("Đã tham quan", "Visited")}</span>
                        )}
                        {row.listened && (
                          <span>{msg("Đã nghe", "Listened")}</span>
                        )}
                      </div>
                    </td>
                    <td>{row.language ? languageLabel(row.language) : "—"}</td>
                    <td>
                      {new Date(row.last_activity).toLocaleString(
                        isVi ? "vi-VN" : "en-US",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {refreshedAt && (
        <p className="small analytics-footnote">
          {msg("Tự cập nhật lúc", "Auto-refreshed at")}{" "}
          {refreshedAt.toLocaleTimeString(isVi ? "vi-VN" : "en-US")} ·{" "}
          {msg("chu kỳ 5 giây", "5-second interval")}.
        </p>
      )}
    </section>
  );
}
