/* main.js —— 装配与启动 */
(function () {
  const App = (window.App = window.App || {});

  function fitView() {
    const svg = App.byId("svg");
    const rect = svg.getBoundingClientRect();
    App.view.s = 1;
    App.view.tx = rect.width / 2;
    App.view.ty = rect.height / 2;
    App.refreshView();
  }

  // ① 适配到「全部轨道可见 + 圆心居视口中心」：按内容包围半径缩放（≤1），原点(圆心)映射到视口中点
  App.fitContent = function () {
    const svg = App.byId("svg");
    const rect = svg.getBoundingClientRect();
    const vw = rect.width || 360, vh = rect.height || 640;
    const st = App.state;
    let R = 40;
    st.rings.forEach((r) => { if (Number(r.rad) > R) R = Number(r.rad); });
    st.chars.forEach((c) => {
      const d = Math.hypot(c.x || 0, c.y || 0);
      if (d > R) R = d;
    });
    const full = Math.max(120, R + App.nodeR() + 64); // 轨道/角色外留边距（含名字）
    App.view.s = Math.min(1, Math.min(vw, vh) / (full * 2));
    App.view.tx = vw / 2;
    App.view.ty = vh / 2;
    App.refreshView();
    const pct = Math.round(App.view.s * 100) + "%";
    const zl = App.byId("zoomLabel"); if (zl) zl.textContent = pct;
    const zr = App.byId("zoomRange"); if (zr) zr.value = Math.round(App.view.s * 100);
    const zv = App.byId("zoomVal"); if (zv) zv.textContent = pct;
  };

  // 定位坐标：圆心（第一圈中心 = 画布原点 0,0）归位到画面正中，并自动缩放至全部轨道可见
  // 用途：缩放/平移迷失后一键找回轨道位置。仅改视图，不动数据、不进撤销栈
  App.recenter = function (opts) {
    const silent = !!(opts && opts.silent);
    App.fitContent();
    if (!silent) {
      const n = (App.state.rings && App.state.rings.length) || 1;
      App.toast(`已定位：圆心居中 · ${n} 圈全览 ${Math.round(App.view.s * 100)}%`);
    }
  };

  function saveDraft() {
    try {
      localStorage.setItem(App.DRAFT_KEY, JSON.stringify(App.state));
    } catch (err) {
      // 容量超限时降级：去掉头像再试一次
      try {
        const st = JSON.parse(JSON.stringify(App.state));
        st.chars.forEach((c) => { c.avatar = null; });
        localStorage.setItem(App.DRAFT_KEY, JSON.stringify(st));
      } catch (e2) { /* 忽略 */ }
    }
  }

  function loadDraft() {
    let obj = null;
    try {
      const raw = localStorage.getItem(App.DRAFT_KEY);
      if (raw) obj = JSON.parse(raw);
    } catch (err) { obj = null; }
    if (!obj) return false;
    if (!obj.chars) return false;
    const d = App.state;
    d.title = obj.title || "未命名关系图";
    d.bg = obj.bg || "#ffffff";
    d.rings = (obj.rings && obj.rings.length) ? obj.rings : d.rings;
    d.chars = obj.chars || [];
    d.links = App.normalizeLinks(obj.links || []);
    if (App.migrateCenterFav) App.migrateCenterFav(d); // 旧草稿的圆心粗线 → 角色涂色（静默折算）
    d.tables = obj.tables || d.tables;
    if (d.tables && d.tables.arrow) {
      d.tables.arrow = App.normalizeArrow(d.tables.arrow); // 箭头类型固定，草稿历史改名/增删一律归一
    }
    d.ui = Object.assign({}, d.ui, obj.ui || {});
    d.meta = {
      filler: (obj.meta && obj.meta.filler) ? String(obj.meta.filler) : "",
      arrowName: (obj.meta && obj.meta.arrowName) ? String(obj.meta.arrowName) : "情感指向",
    };
    App.computeLayout();
    return d.chars.length > 0;
  }

  // 环境识别（单一真源）：容器 = 小红书 miniTool JSBridge 存在；浏览器环境不存在该对象
  // 布局（body.xhs 容器态 CSS）与保存能力判断都读这里，避免多处重复判断口径不一
  App.detectEnv = function () {
    let xhs = false;
    try { xhs = !!(window.xhs && window.xhs.miniTool); } catch (err) { xhs = false; }
    App.isXhs = xhs;
    if (xhs && document.body) document.body.classList.add("xhs");
    return xhs;
  };

  App.start = function () {
    // 环境识别必须最先：容器态 CSS 依赖 body.xhs，晚于首帧会闪一次错位布局
    App.detectEnv();

    // 设置背景变量（夜间模式则切深色外壳）
    App.applyNight();

    // 先注册 UI/输入
    App.uiInit();
    App.inputInit();

    // 恢复草稿
    const hasDraft = loadDraft();

    // 自动保存
    App.scheduleSave = App.debounce(() => saveDraft(), 500);
    App.scheduleSave(); // 初次写入以便后续 undo 有基线？不必要但无害

    // 标题栏（含填表人前缀）
    App.setTitleText();

    // 画布初始视图：已有内容 → 适配全部轨道+圆心居中；空画布 → 1:1 居中
    const hasChars0 = App.state.chars.length > 0;
    if (hasChars0) App.fitContent();
    else fitView();
    App.notifyChanged();

    // 开局引导
    const hasChars = hasChars0;
    if (!hasChars || !hasDraft) {
      setTimeout(() => App.welcome(!hasChars), 120);
    }
  };

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => App.start());
  } else {
    App.start();
  }
})();
