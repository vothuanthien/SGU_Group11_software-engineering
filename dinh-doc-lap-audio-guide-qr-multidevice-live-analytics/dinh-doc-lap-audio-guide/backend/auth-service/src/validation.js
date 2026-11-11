export function hasLoginCredentials(body) {
  return Boolean(body?.email && body?.password);
}
