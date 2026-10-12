import axios from "axios";
import Cookies from "js-cookie";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Flag to prevent concurrent refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to attach token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for auto-refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for login/refresh endpoints to avoid infinite loops
      if (
        originalRequest.url?.includes("/login") ||
        originalRequest.url?.includes("/refresh-token")
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get("refresh_token");

      if (!refreshToken) {
        // No refresh token — force logout
        isRefreshing = false;
        Cookies.remove("token");
        Cookies.remove("refresh_token");
        Cookies.remove("keep_logged_in");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/refresh-token`,
          { refresh_token: refreshToken },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        const { access_token, refresh_token: newRefreshToken, expires_in } =
          response.data.data;

        // Calculate expiry in days for cookies
        const expiryDays = expires_in ? expires_in / 86400 : 1;
        const isKeepLoggedIn = Cookies.get("keep_logged_in") !== "false";

        // Save new tokens with secure flags
        Cookies.set("token", access_token, {
          expires: isKeepLoggedIn ? expiryDays : undefined,
          secure: window.location.protocol === "https:",
          sameSite: "strict",
        });

        Cookies.set("refresh_token", newRefreshToken, {
          expires: isKeepLoggedIn ? 30 : undefined,
          secure: window.location.protocol === "https:",
          sameSite: "strict",
        });

        // Update the original request header and retry
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Refresh failed — clear tokens and redirect to login
        Cookies.remove("token");
        Cookies.remove("refresh_token");
        Cookies.remove("keep_logged_in");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
