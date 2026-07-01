// server/public/js/auth.js
// Why this file exists: Manages the JWT session entirely in localStorage.
// Since EJS pages are server-rendered but auth is stateless (JWT), the
// server never needs to know who's logged in just to render a page.
// The page loads, JS checks localStorage, and either proceeds or redirects.
// How it connects: Loaded via footer.ejs before every page's own script.
// Key methods:
//   requireAuth()            — call at top of every protected page script
//   redirectIfAuthenticated() — call at top of login/register page scripts
//   setSession(token, user)  — call after successful login/register API call
//   logout()                 — clears session and sends to /login

const AuthState = (() => {
  const TOKEN_KEY = "authToken";
  const USER_KEY  = "currentUser";

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getToken()       { return localStorage.getItem(TOKEN_KEY); }
  function getCurrentUser() { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; }
  function isLoggedIn()     { return Boolean(getToken()); }

  // Redirect to login if no token. Call this at the very top of every
  // protected page's <script> block.
  function requireAuth() {
    if (!isLoggedIn()) window.location.href = "/login";
  }

  // Redirect to dashboard if already logged in. Call this at the top of
  // login.ejs and register.ejs so returning users don't see the auth pages.
  function redirectIfAuthenticated() {
    if (isLoggedIn()) window.location.href = "/dashboard";
  }

  function logout() {
    clearSession();
    window.location.href = "/login";
  }

  return { setSession, clearSession, getToken, getCurrentUser, isLoggedIn, requireAuth, redirectIfAuthenticated, logout };
})();