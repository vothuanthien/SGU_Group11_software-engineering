export function buildGatewayRoutes(env = process.env) {
  return [
    { prefix: "/api/v1/auth", target: env.AUTH_SERVICE_URL, resource: "" },
    {
      prefix: "/api/v1/attractions",
      target: env.CONTENT_SERVICE_URL,
      resource: "/attractions",
    },
    {
      prefix: "/api/v1/tours",
      target: env.CONTENT_SERVICE_URL,
      resource: "/tours",
    },
    {
      prefix: "/api/v1/narrations",
      target: env.CONTENT_SERVICE_URL,
      resource: "/narrations",
    },
    {
      prefix: "/api/v1/navigation",
      target: env.NAVIGATION_SERVICE_URL,
      resource: "/navigation",
    },
    {
      prefix: "/api/v1/feedback",
      target: env.FEEDBACK_SERVICE_URL,
      resource: "/feedback",
    },
    {
      prefix: "/api/v1/analytics",
      target: env.ANALYTICS_SERVICE_URL,
      resource: "/analytics",
    },
  ];
}
