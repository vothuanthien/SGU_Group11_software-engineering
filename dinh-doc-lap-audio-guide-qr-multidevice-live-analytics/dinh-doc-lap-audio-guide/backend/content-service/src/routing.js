export const CONTENT_ROUTES = [
  { prefix: "/attractions", target: "attraction", resource: "/attractions" },
  { prefix: "/tours", target: "attraction", resource: "/tours" },
  { prefix: "/narrations", target: "narration", resource: "/narrations" },
];

export function rewriteContentPath(resource, path) {
  const suffix = path === "/" ? "" : path;
  return `${resource}${suffix}`;
}
