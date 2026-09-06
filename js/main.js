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
    d.links = obj.links || [];
    d.tables = obj.tables || d.tables;
    d.ui = Object.assign({}, d.ui, obj.ui || {});
    App.computeLayout();
    return d.chars.length > 0;
  }

  App.start = function () {
    // 设置背景变量
    document.body.style.setProperty("--bg", App.state.bg);

    // 先注册 UI/输入
    App.uiInit();
    App.inputInit();

    // 恢复草稿
    const hasDraft = loadDraft();

    // 自动保存
    App.scheduleSave = App.debounce(() => saveDraft(), 500);
    App.scheduleSave(); // 初次写入以便后续 undo 有基线？不必要但无害

    // 标题栏
    App.byId("titleBox").textContent = App.state.title;

    // 画布初始视图
    fitView();
    App.notifyChanged();

    // 开局引导
    const hasChars = App.state.chars.length > 0;
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
