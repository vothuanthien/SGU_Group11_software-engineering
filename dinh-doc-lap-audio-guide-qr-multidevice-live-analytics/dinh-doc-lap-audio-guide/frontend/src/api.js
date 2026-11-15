import axios from "axios";
const api = axios.create({ baseURL: "/api/v1", timeout: 7000 });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("dinh_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
export default api;
