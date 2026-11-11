import React, { useState } from "react";
import api from "../api.js";

export default function FeedbackPage({ attractions, lang, t }) {
  const isVi = lang === "vi";
  const msg = (vi, en) => (isVi ? vi : en);
  const initialForm = {
    attractionId: "",
    rating: 5,
    message: "",
    type: "review",
  };
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const message = form.message.trim();
    if (!message) {
      setError(msg("Vui lòng nhập nội dung phản hồi.", "Please enter your feedback."));
      return;
    }
    if (message.length > 1000) {
      setError(msg("Phản hồi không được vượt quá 1000 ký tự.", "Feedback must be 1,000 characters or fewer."));
      return;
    }

    setSubmitting(true);
    setError("");
    setStatus("");
    try {
      await api.post("/feedback", { ...form, message });
      setStatus(msg("Đã gửi phản hồi. Cảm ơn bạn!", "Feedback sent. Thank you!"));
      setForm((current) => ({ ...current, message: "" }));
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          msg("Không gửi được phản hồi. Vui lòng thử lại.", "Could not send feedback. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="form-page">
      <p className="eyebrow">YOUR VOICE MATTERS</p>
      <h1>{t.send}</h1>
      <p className="small">
        {msg(
          "Ý kiến của bạn giúp nhóm cải thiện nội dung và trải nghiệm tham quan.",
          "Your feedback helps improve the content and visitor experience.",
        )}
      </p>
      <form onSubmit={submit} className="form-card" noValidate>
        <label htmlFor="feedback-attraction">
          {msg("Điểm tham quan", "Attraction")}
          <select
            id="feedback-attraction"
            value={form.attractionId}
            onChange={(event) => update("attractionId", event.target.value)}
          >
            <option value="">{msg("Không chọn", "General feedback")}</option>
            {attractions.map((attraction) => (
              <option key={attraction.id} value={attraction.id}>
                {isVi ? attraction.name_vi : attraction.name_en}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="feedback-rating">
          {t.rating}
          <select
            id="feedback-rating"
            value={form.rating}
            onChange={(event) => update("rating", Number(event.target.value))}
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>{rating} / 5</option>
            ))}
          </select>
        </label>
        <label htmlFor="feedback-type">
          {t.kind}
          <select
            id="feedback-type"
            value={form.type}
            onChange={(event) => update("type", event.target.value)}
          >
            <option value="review">{t.review}</option>
            <option value="accuracy">{t.accuracy}</option>
            <option value="audio">{t.audio}</option>
            <option value="location">{t.location}</option>
          </select>
        </label>
        <label htmlFor="feedback-message">
          {t.message}
          <textarea
            id="feedback-message"
            required
            minLength={1}
            maxLength={1000}
            rows={5}
            value={form.message}
            aria-describedby="feedback-message-count"
            onChange={(event) => update("message", event.target.value)}
          />
          <span id="feedback-message-count" className="small">
            {form.message.length}/1000
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {status && <p className="success-message" role="status">{status}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting
            ? msg("Đang gửi…", "Sending…")
            : `${t.send} →`}
        </button>
      </form>
    </section>
  );
}
