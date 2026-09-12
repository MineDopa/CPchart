/* iopc.js —— 网页版 IO 覆盖层（仅供 web/ 分流版在页面末尾加载；小红书容器包绝不包含本文件）
   容器版 js/io.js 走官方 JSBridge（writeTempFile/saveImageToPhotosAlbum/postNote）；
   网页版（浏览器环境）没有这些 API，本文件在 main.js 之后加载并覆盖：
     - saveImage   ：浏览器原生下载 PNG（网页环境允许 a[download]）
     - publishNote ：友好提示网页版不可直接发布
   加载后会置 window.__IOPC_ENV = true 供环境识别。 */
(function () {
  const App = window.App || {};
  function tip(msg) {
    try { if (App.toast) { App.toast(msg); return; } } catch (e) { /* ignore */ }
    try { window.alert(msg); } catch (e2) { /* ignore */ }
  }
  // 导出文件名模板：
  //   CP-Chart 填表人的图名 导出时间.png
  //   例：CP-Chart 用户 的 我的CP图 20260907-162017.png
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
        // 触屏设备（手机/iPad）浏览器对 a[download] 支持差、不呼出保存，
        // 改为全屏预览 + 长按保存（移动端最稳的存图方式）。
        const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) ||
          /iP(ad|hone|od)|Android|Mobile/i.test(navigator.userAgent || "");
        if (isTouch) { showMobilePreview(dataUrl); resolve({ ok: true, method: "preview" }); return; }
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
  function showMobilePreview(dataUrl) {
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.86);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;";
    const img = document.createElement("img");
    img.src = dataUrl;
    img.style.cssText = "max-width:92%;max-height:68%;border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,.5);";
    const tip = document.createElement("div");
    tip.textContent = "长按上方图片 → 保存到相册";
    tip.style.cssText = "color:#fff;font-size:14px;margin-top:16px;text-align:center;";
    const bar = document.createElement("div");
    bar.style.cssText = "margin-top:14px;display:flex;gap:10px;";
    const close = document.createElement("button");
    close.textContent = "关闭";
    close.style.cssText = "padding:9px 22px;border-radius:10px;background:#0a84ff;color:#fff;font-size:15px;border:none;";
    close.onclick = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    const openNew = document.createElement("button");
    openNew.textContent = "新标签打开";
    openNew.style.cssText = "padding:9px 22px;border-radius:10px;background:#3a3a3c;color:#fff;font-size:15px;border:none;";
    openNew.onclick = function () { window.open(dataUrl, "_blank"); };
    bar.appendChild(close); bar.appendChild(openNew);
    ov.onclick = function (e) { if (e.target === ov && ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.appendChild(img); ov.appendChild(tip); ov.appendChild(bar);
    document.body.appendChild(ov);
  }
  App.publishNote = function () {
    tip("网页版暂不支持直接发布笔记：请先「导出图片」保存图片后，在小红书 App 里手动发布。");
    return Promise.resolve({ ok: false, reason: "web-environment" });
  };
  // 关于页补充说明（仅网页版；小红书容器包不加载本文件）
  App.renderAboutExtra = function () {
    return '<div class="about-sec">关于本项目</div>'
      + '<ul class="about-list">'
      + '<li>CPChart 是一个纯本地、离线可用的人物关系连线图工具</li>'
      + '<li>数据格式的完整说明见「CPChart 语言使用说明」</li>'
      + '</ul>';
  };
  // ── 访问统计（网页版专属）────────────────────────────────
  // 网页版每次加载向访问日志表匿名记一笔（浏览器类型 + 页面地址），
  // 异步发送、双层静默捕获 —— 统计失败不影响任何功能。
  // 仅网页版执行（本文件不进小红书容器包，容器版零网络请求的设计不变）。
  function trackVisit() {
    try {
      var apiUrl = "https://qxceawseszmthvpyvfsw.supabase.co/rest/v1/visit_logs";
      var pubKey = "sb_publishable_6oDhorhahbg2c6fvgHtXQg_NWRYIEm9";
      fetch(apiUrl, {
        method: "POST",
        headers: {
          "apikey": pubKey,
          "Authorization": "Bearer " + pubKey,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify([{
          user_agent: navigator.userAgent,
          page_url: String(window.location.href)
        }])
      }).catch(function () { /* 静默：统计失败不影响使用 */ });
    } catch (e) { /* 静默 */ }
  }
  trackVisit();
  window.__IOPC_ENV = true;
})();
