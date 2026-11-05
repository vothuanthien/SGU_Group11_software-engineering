import { describe, expect, it } from "vitest";
import { buildGatewayRoutes } from "./routes.js";

describe("API Gateway route mapping", () => {
  const routes = buildGatewayRoutes({
    AUTH_SERVICE_URL: "http://auth:4101",
    CONTENT_SERVICE_URL: "http://content:4106",
    NAVIGATION_SERVICE_URL: "http://navigation:4107",
    FEEDBACK_SERVICE_URL: "http://feedback:4104",
    ANALYTICS_SERVICE_URL: "http://analytics:4105",
  });

  it("routes attractions, tours and narrations through Content Service", () => {
    for (const prefix of ["/api/v1/attractions", "/api/v1/tours", "/api/v1/narrations"]) {
      expect(routes.find((route) => route.prefix === prefix)?.target).toBe("http://content:4106");
    }
  });

  it("routes navigation requests to Navigation Service", () => {
    expect(routes.find((route) => route.prefix === "/api/v1/navigation")).toMatchObject({
      target: "http://navigation:4107",
      resource: "/navigation",
    });
  });

  it("keeps authentication, feedback and analytics routes", () => {
    expect(routes.map((route) => route.prefix)).toEqual(
      expect.arrayContaining([
        "/api/v1/auth",
        "/api/v1/feedback",
        "/api/v1/analytics",
      ]),
    );
  });
});
