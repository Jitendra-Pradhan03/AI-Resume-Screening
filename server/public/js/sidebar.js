// server/public/js/sidebar.js
// Why this file exists: The sidebar partial (sidebar.ejs) renders the HTML
// shell, but the user's name, company, and avatar initial come from
// localStorage (set after login). This script populates those fields
// after the page loads and wires up the logout button.
// How it connects: Loaded via footer.ejs only on authenticated pages
// (when locals.includesSidebar is true). Runs after auth.js is loaded.

(function initSidebar() {
  const user = AuthState.getCurrentUser();
  if (!user) return;

  const avatarEl  = document.getElementById("sidebarAvatar");
  const nameEl    = document.getElementById("sidebarName");
  const companyEl = document.getElementById("sidebarCompany");
  const logoutBtn = document.getElementById("logoutBtn");

  if (avatarEl)  avatarEl.textContent  = (user.name || "?").charAt(0).toUpperCase();
  if (nameEl)    nameEl.textContent    = user.name    || "Recruiter";
  if (companyEl) companyEl.textContent = user.company || "";

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => AuthState.logout());
  }
})();