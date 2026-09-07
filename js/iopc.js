/* iopc.js —— 网页版 IO 覆盖层（仅供 web/ 分流版在页面末尾加载；小红书容器包绝不包含本文件）
   容器版 js/io.js 走官方 JSBridge（writeTempFile/saveImageToPhotosAlbum/postNote）；
   网页版（浏览器 / GitHub Pages）没有这些 API，本文件在 main.js 之后加载并覆盖：
     - saveImage   ：浏览器原生下载 PNG（网页环境允许 a[download]）
     - publishNote ：友好提示网页版不可直接发布
   加载后会置 window.__IOPC_ENV = true 供环境识别。 */
(function () {
  const App = window.App || {};
  function tip(msg) {
    try { if (App.toast) { App.toast(msg); return; } } catch (e) { /* ignore */ }
    try { window.alert(msg); } catch (e2) { /* ignore */ }
  }
  // 导出文件名模板（星羽定稿 2026-09-08）：
  //   CP-Chart 填表人的图名 导出时间.png
  //   例：CP-Chart 星羽的我的CP图 20260907-162017.png
  // 填表人为空时省略「填表人的」；时间=本地时间 YYYYMMDD-HHMMSS；
  // 名称内若含文件名非法字符（\ / : * ? " < > |）会替换为「-」。
  function sanitizeName(s) {
    return String(s == null ? "" : s).replace(/[\\/:*?"<>|]+/g, "-").replace(/^\s+|\s+$/g, "");
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function buildFileName() {
    const st = App.state || {};
    const filler = sanitizeName((st.meta && st.meta.filler) || "");
    const title = sanitizeName(st.title) || "未命名关系图";
    const namePart = filler ? filler + "的" + title : title;
    const now = new Date();
    const ts = String(now.getFullYear()) + pad2(now.getMonth() + 1) + pad2(now.getDate())
      + "-" + pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
    return "CP-Chart " + namePart + " " + ts + ".png";
  }
  App.saveImage = function (dataUrl) {
    return new Promise(function (resolve) {
      try {
        const fileName = buildFileName();
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve({ ok: true, method: "download" });
      } catch (e) {
        resolve({ ok: false, reason: (e && e.message) || String(e) });
      }
    });
  };
  App.publishNote = function () {
    tip("网页版暂不支持直接发布笔记：请先「导出图片」保存图片后，在小红书 App 里手动发布。");
    return Promise.resolve({ ok: false, reason: "web-environment" });
  };
  window.__IOPC_ENV = true;
})();
