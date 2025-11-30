// UI/sidebar.js
// Handles tree expand/collapse and simple view navigation via hash routing.
document.addEventListener("DOMContentLoaded", () => {
  // toggle tree nodes
  document.querySelectorAll(".tree-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".tree-item");
      const expanded = item.classList.toggle("expanded");
      btn.setAttribute("aria-expanded", String(expanded));
    });
  });

  // nav links
  document.querySelectorAll(".nav-link").forEach(a => {
    a.addEventListener("click", (e) => {
      const view = a.dataset.view;
      if (view) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("route:change", { detail: { view } }));
        history.pushState({ view }, "", `#/${view}`);
      } else {
        // No data-view => allow normal navigation (e.g. farmers.html full page)
      }
    });
  });

  // support back/forward
  window.addEventListener("popstate", (e) => {
    const view = (e.state && e.state.view) || (location.hash.replace("#/","") || "");
    window.dispatchEvent(new CustomEvent("route:change", { detail: { view } }));
  });
});
