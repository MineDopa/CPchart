/* util.js —— 通用工具 */
(function () {
  const App = (window.App = window.App || {});

  App.esc = function (s) {
    return String(s == null ? "" : s).replace(/[<>&"']/g, (c) => (
      { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  };

  App.uid = function (p) {
    return (p || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  App.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  App.hexToRgb = function (hex) {
    const h = String(hex || "#000").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  App.rgba = function (hex, a) {
    const { r, g, b } = App.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  App.readableTextColor = function (hex) {
    const { r, g, b } = App.hexToRgb(hex);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 160 ? "#1c1c1e" : "#ffffff";
  };

  App.debounce = function (fn, ms) {
    let t = null;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  App.byId = (id) => document.getElementById(id);

  App.fmtAngle = (rad) => Math.round(((rad * 180) / Math.PI) * 10) / 10;

  // 将角度规范到 0..2PI
  App.normAngle = (rad) => {
    while (rad < 0) rad += Math.PI * 2;
    while (rad >= Math.PI * 2) rad -= Math.PI * 2;
    return rad;
  };

  // toast
  let toastTimer = null;
  App.toast = function (msg, isErr) {
    const el = App.byId("toast");
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  };

  // 页面级 svg 事件坐标 → 世界坐标
  App.worldOf = function (clientX, clientY) {
    const svg = App.byId("svg");
    const rect = svg.getBoundingClientRect();
    const v = App.view;
    return {
      x: (clientX - rect.left - v.tx) / v.s,
      y: (clientY - rect.top - v.ty) / v.s,
    };
  };
})();
