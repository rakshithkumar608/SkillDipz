import { useAuthStore } from "@/store/authStore";
import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {"Content-Type": "application/json"},
    withCredentials: true, // sends HttpOnly cookies autometically on EVERY request
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // don't retry if it's already the refresh call itself or a company session route
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    const isCompanyRoute = original?.url?.includes("/company/auth") || original?.url?.includes("/admin/companies");
    
    if (error.response?.status === 401 && !original._retry && !isRefreshCall && !isCompanyRoute) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          return Promise.reject(error);
        }
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { withCredentials: true }
        );
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.access_token,
          data.refresh_token
        );
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;