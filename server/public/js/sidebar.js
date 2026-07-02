(function initSidebar() {
  const avatarEl  = document.getElementById("sidebarAvatar");

  // No sidebar on this page
  if (!avatarEl) return;

  const nameEl    = document.getElementById("sidebarName");
  const companyEl = document.getElementById("sidebarCompany");
  const logoutBtn = document.getElementById("logoutBtn");

  const user = AuthState.getCurrentUser();

  // Sidebar exists but user isn't logged in
  if (!user) return;

  avatarEl.textContent = (user.name || "?").charAt(0).toUpperCase();

  if (nameEl)
    nameEl.textContent = user.name || "Recruiter";

  if (companyEl)
    companyEl.textContent = user.company || "";

  if (logoutBtn)
    logoutBtn.addEventListener("click", () => AuthState.logout());
})();