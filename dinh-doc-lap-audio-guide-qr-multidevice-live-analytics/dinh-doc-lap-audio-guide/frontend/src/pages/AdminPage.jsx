import React, { useEffect, useState } from "react";
import api from "../api.js";
import AnalyticsDashboard from "../components/AnalyticsDashboard.jsx";
import QrCodeManager from "../components/QrCodeManager.jsx";

export default function AdminPage({ t, lang }) {
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
    narration_zh: "",
    narration_th: "",
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
    audio_zh: "",
    audio_th: "",
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
        narration_zh: draft.narration_zh || "",
        narration_th: draft.narration_th || "",
        narration_published: !!draft.narration_published,
        audio_vi: draft.audio_vi || "",
        audio_en: draft.audio_en || "",
        audio_zh: draft.audio_zh || "",
        audio_th: draft.audio_th || "",
      });
      setStatus(
        msg("Đã cập nhật kịch bản đa ngôn ngữ.", "Multilingual narration updated."),
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
            {msg("Quản lý kịch bản đa ngôn ngữ", "Manage multilingual narration")}
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
                      narration_zh: r.data.data.narration_zh || "",
                      narration_th: r.data.data.narration_th || "",
                      audio_vi:
                        r.data.data.audio?.find((x) => x.language === "vi")
                          ?.audio_url || "",
                      audio_en:
                        r.data.data.audio?.find((x) => x.language === "en")
                          ?.audio_url || "",
                      audio_zh:
                        r.data.data.audio?.find((x) => x.language === "zh")
                          ?.audio_url || "",
                      audio_th:
                        r.data.data.audio?.find((x) => x.language === "th")
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
              <label>
                Kịch bản tiếng Trung giản thể (Chinese narration)
                <textarea
                  rows="8"
                  value={draft.narration_zh || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, narration_zh: e.target.value })
                  }
                />
              </label>
              <label>
                Kịch bản tiếng Thái (Thai narration)
                <textarea
                  rows="8"
                  value={draft.narration_th || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, narration_th: e.target.value })
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
                <label>
                  URL audio tiếng Trung (Chinese audio URL)
                  <input
                    type="url"
                    value={draft.audio_zh || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, audio_zh: e.target.value })
                    }
                    placeholder="https://.../zh.mp3"
                  />
                </label>
                <label>
                  URL audio tiếng Thái (Thai audio URL)
                  <input
                    type="url"
                    value={draft.audio_th || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, audio_th: e.target.value })
                    }
                    placeholder="https://.../th.mp3"
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
