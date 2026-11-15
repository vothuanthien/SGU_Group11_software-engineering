import assert from "node:assert/strict";
import test from "node:test";

const apiBase =
  process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  throw new Error("TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be configured");
}

async function request(
  path,
  { method = "GET", body, rawBody, token, headers = {} } = {},
) {
  headers = { ...headers };
  let requestBody;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    requestBody = JSON.stringify(body);
  } else if (rawBody !== undefined) {
    headers["content-type"] = "application/json";
    requestBody = rawBody;
  }
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${apiBase}${path}`, { method, headers, body: requestBody });
}

async function assertApiError(response, status, code) {
  assert.equal(response.status, status);
  const payload = await response.json();
  assert.equal(typeof payload.error?.code, "string");
  assert.equal(payload.error.code, code);
  assert.equal(typeof payload.error.message, "string");
  assert.ok(payload.error.message.length > 0);
  return payload.error;
}

async function waitForGateway(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await request("/health");
      if (response.ok) return;
      lastError = new Error(`Gateway health returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Gateway did not become healthy: ${lastError?.message}`);
}

test(
  "Gateway, services, PostgreSQL, JWT narration admin, and API error contract",
  { timeout: 120_000 },
  async () => {
    await waitForGateway();

    const attractionsResponse = await request("/attractions");
    assert.equal(attractionsResponse.status, 200);
    const attractions = (await attractionsResponse.json()).data;
    assert.ok(attractions.some((attraction) => attraction.id === "main-building"));

    const toursResponse = await request("/tours");
    assert.equal(toursResponse.status, 200);
    assert.ok((await toursResponse.json()).data.length > 0);

    const narrationResponse = await request("/narrations/main-building/vi");
    assert.equal(narrationResponse.status, 200);
    assert.ok((await narrationResponse.json()).data.text.length > 0);

    for (const language of ["en", "zh", "th"]) {
      const localizedNarrationResponse = await request(
        `/narrations/main-building/${language}`,
        { headers: { "Accept-Language": language } },
      );
      assert.equal(localizedNarrationResponse.status, 200);
      const localizedNarration = (await localizedNarrationResponse.json()).data;
      assert.equal(localizedNarration.language, language);
      assert.ok(localizedNarration.text.length > 0);
      assert.equal(localizedNarration.audioUrl, null);
      assert.equal(localizedNarration.audioMode, "web-speech-fallback");
      if (language === "zh" || language === "th")
        assert.equal(localizedNarration.translationStatus, "draft");
    }

    await assertApiError(
      await request("/narrations/main-building/fr"),
      400,
      "INVALID_LANGUAGE",
    );
    await assertApiError(
      await request("/auth/login", { method: "POST", rawBody: "{" }),
      400,
      "INVALID_JSON",
    );
    await assertApiError(
      await request("/auth/unknown-endpoint"),
      404,
      "NOT_FOUND",
    );
    await assertApiError(
      await request("/unknown-endpoint"),
      404,
      "ROUTE_NOT_FOUND",
    );
    await assertApiError(
      await request("/feedback", { method: "POST", body: { rating: 0 } }),
      400,
      "VALIDATION_ERROR",
    );
    await assertApiError(
      await request("/auth/login", {
        method: "POST",
        body: { email: adminEmail, password: "invalid-password" },
      }),
      401,
      "INVALID_CREDENTIALS",
    );

    await assertApiError(
      await request("/narrations/admin/main-building"),
      401,
      "UNAUTHORIZED",
    );
    const loginResponse = await request("/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    });
    assert.equal(loginResponse.status, 200);
    const { token } = (await loginResponse.json()).data;
    assert.ok(token);

    const adminAttractionsResponse = await request("/attractions/admin/all", {
      token,
    });
    assert.equal(adminAttractionsResponse.status, 200);
    assert.ok((await adminAttractionsResponse.json()).data.length > 0);

    const feedbackMessage = `integration-check-${Date.now()}`;
    const feedbackResponse = await request("/feedback", {
      method: "POST",
      body: {
        attractionId: "main-building",
        rating: 5,
        message: feedbackMessage,
        type: "review",
      },
    });
    assert.equal(feedbackResponse.status, 201);
    assert.equal((await feedbackResponse.json()).data.message, feedbackMessage);
    const feedbackListResponse = await request("/feedback", { token });
    assert.equal(feedbackListResponse.status, 200);
    assert.ok(
      (await feedbackListResponse.json()).data.some(
        (feedback) => feedback.message === feedbackMessage,
      ),
    );

    const analyticsEventResponse = await request("/analytics/events", {
      method: "POST",
      body: {
        visitorId: "a1c2e3f4-1234-4123-8123-aabbccddeeff",
        eventType: "app_opened",
        language: "zh",
      },
    });
    assert.equal(analyticsEventResponse.status, 201);
    const analyticsSummaryResponse = await request(
      "/analytics/summary?days=30",
      { token },
    );
    assert.equal(analyticsSummaryResponse.status, 200);
    assert.ok((await analyticsSummaryResponse.json()).data.totals);

    const adminNarrationResponse = await request(
      "/narrations/admin/main-building",
      { token },
    );
    assert.equal(adminNarrationResponse.status, 200);
    const narration = (await adminNarrationResponse.json()).data;
    const updateResponse = await request("/narrations/main-building", {
      method: "PUT",
      token,
      body: {
        narration_vi: narration.narration_vi,
        narration_en: narration.narration_en,
        narration_zh: narration.narration_zh,
        narration_th: narration.narration_th,
      },
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.updated, true);

    const persistedNarrationResponse = await request(
      "/narrations/main-building/vi",
    );
    assert.equal(persistedNarrationResponse.status, 200);
    assert.equal(
      (await persistedNarrationResponse.json()).data.text,
      narration.narration_vi,
    );
    for (const language of ["zh", "th"]) {
      const response = await request(`/narrations/main-building/${language}`);
      assert.equal(response.status, 200);
      assert.equal(
        (await response.json()).data.text,
        narration[`narration_${language}`],
      );
    }

    const clearThaiResponse = await request("/narrations/main-building", {
      method: "PUT",
      token,
      body: {
        narration_vi: narration.narration_vi,
        narration_en: narration.narration_en,
        narration_zh: narration.narration_zh,
        narration_th: "",
      },
    });
    assert.equal(clearThaiResponse.status, 200);
    await assertApiError(
      await request("/narrations/main-building/th"),
      404,
      "TRANSLATION_UNAVAILABLE",
    );
    const restoreThaiResponse = await request("/narrations/main-building", {
      method: "PUT",
      token,
      body: {
        narration_vi: narration.narration_vi,
        narration_en: narration.narration_en,
        narration_zh: narration.narration_zh,
        narration_th: narration.narration_th,
      },
    });
    assert.equal(restoreThaiResponse.status, 200);
  },
);
