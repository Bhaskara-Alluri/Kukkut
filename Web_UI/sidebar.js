// Handles tree expand/collapse and simple view navigation
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
      e.preventDefault();
      const view = a.dataset.view;
      window.dispatchEvent(new CustomEvent("route:change", { detail: { view } }));
      history.pushState({ view }, "", `#/${view}`);
    });
  });

  // support back/forward
  window.addEventListener("popstate", (e) => {
    const view = (e.state && e.state.view) || (location.hash.replace("#/","") || "");
    window.dispatchEvent(new CustomEvent("route:change", { detail: { view } }));
  });
});
