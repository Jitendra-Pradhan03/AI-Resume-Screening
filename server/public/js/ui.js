// server/public/js/ui.js
// Why this file exists: Small DOM helpers reused across every page —
// toast notifications, button loading states, score color mapping,
// status badge HTML, date formatting, and HTML escaping.
// Centralising these prevents subtle inconsistencies (e.g. one page
// formatting dates differently from another).
// How it connects: Loaded via footer.ejs after auth.js, before page scripts.

const UI = (() => {
  // ── Toast notifications ──────────────────────────────────────────────────
  function ensureToastContainer() {
    let c = document.querySelector(".toast-container");
    if (!c) { c = document.createElement("div"); c.className = "toast-container"; document.body.appendChild(c); }
    return c;
  }

  function showToast(message, type = "info", duration = 4000) {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 200ms";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // ── Button loading state ─────────────────────────────────────────────────
  // Disables the button and shows a spinner while an async operation runs.
  // Stores original HTML in a data attribute so it can be restored exactly.
  function setButtonLoading(btn, isLoading, loadingText = "Loading...") {
    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    }
  }

  // ── Score helpers ────────────────────────────────────────────────────────
  // Returns "high", "medium", or "low" for CSS class naming
  function scoreToClass(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  // Returns a CSS color variable name for inline styles
  function scoreToColor(score) {
    if (score >= 70) return "var(--color-success)";
    if (score >= 40) return "var(--color-warning)";
    return "var(--color-danger)";
  }

  // ── Status badge ─────────────────────────────────────────────────────────
  function statusBadge(status) {
    const labels = { uploaded: "Uploaded", processing: "Processing", analyzed: "Analyzed", matched: "Matched", error: "Error" };
    return `<span class="badge status-${status}">${labels[status] || status}</span>`;
  }

  // ── Dates ────────────────────────────────────────────────────────────────
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatRelativeTime(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60)   return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(dateString);
  }

  // ── File size ────────────────────────────────────────────────────────────
  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // ── XSS prevention — always use this before inserting user data into DOM ─
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { showToast, setButtonLoading, scoreToClass, scoreToColor, statusBadge, formatDate, formatRelativeTime, formatFileSize, escapeHtml };
})();