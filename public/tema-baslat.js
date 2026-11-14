/* İlk boyamadan önce temayı uygular (beyaz/siyah parlamayı önler). Asıl mantık: src/lib/tema.ts */
(function () {
  var t = null;
  try { t = localStorage.getItem("sr-tema"); } catch { /* depolama kapalı */ }
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "dark" ? "#1f221d" : "#d6cebf");
})();
