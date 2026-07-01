// server/public/js/api.js
// Why this file exists: Every EJS page needs to call the REST API
// (/api/auth/login, /api/resume/upload, etc.). This module wraps the
// native fetch() API with consistent header injection (JWT token),
// JSON parsing, and error handling so individual pages never repeat
// that boilerplate.
// How it connects: Loaded via footer.ejs before every page's own script.
// Pages call ApiClient.get("/dashboard"), ApiClient.post("/auth/login", data), etc.
// Key concept: IIFE (Immediately Invoked Function Expression) exposes
// only the public methods as ApiClient — internal helpers stay private.

const ApiClient = (() => {
  // Always target the same origin — works in dev and prod
  const BASE_URL = "/api";

  function getToken() {
    return localStorage.getItem("authToken");
  }

  // Attach Content-Type and Authorization headers to every request
  function buildHeaders(isFormData = false) {
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // Never set Content-Type for FormData — the browser sets it with the
    // multipart boundary automatically. Setting it manually breaks uploads.
    if (!isFormData) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function request(method, endpoint, body = null, isFormData = false) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      method,
      headers: buildHeaders(isFormData),
    };

    if (body) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok || data.success === false) {
        const error = new Error(data.message || "Request failed");
        error.statusCode = response.status;

        // Token expired or invalid — clear session and redirect to login
        if (response.status === 401) {
          AuthState.clearSession();
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        }

        throw error;
      }

      return data;
    } catch (err) {
      // TypeError means the server is unreachable (network error)
      if (err instanceof TypeError) {
        throw new Error("Cannot reach the server. Please check your connection.");
      }
      throw err;
    }
  }

  return {
    get:      (endpoint)             => request("GET",    endpoint),
    post:     (endpoint, body)       => request("POST",   endpoint, body),
    put:      (endpoint, body)       => request("PUT",    endpoint, body),
    patch:    (endpoint, body)       => request("PATCH",  endpoint, body),
    delete:   (endpoint)             => request("DELETE", endpoint),
    // postForm is used for multipart/form-data (resume PDF upload)
    postForm: (endpoint, formData)   => request("POST",   endpoint, formData, true),
  };
})();