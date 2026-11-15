import axios from "axios";
const api = axios.create({ baseURL: "/api/v1", timeout: 7000 });
api.interceptors.request.use((c) => {
  let token = null;
  let language = "vi";
  try {
    token = localStorage.getItem("dinh_token");
    language = localStorage.getItem("dinh_lang") || language;
  } catch {
    // Requests remain available when browser storage is disabled.
  }
  if (token) c.headers.Authorization = `Bearer ${token}`;
  c.headers["Accept-Language"] = language;
  return c;
});
export default api;
