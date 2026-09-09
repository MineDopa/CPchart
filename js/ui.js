/* ui.js —— 面板渲染、Tab、菜单、弹窗、Toast */
(function () {
  const App = (window.App = window.App || {});

  App.activeTab = "link";
  App.fullUI = false;
  App.panelMode = "half";   // 底部二级面板三态：collapsed / half / full（单源；panelCollapsed/panelFull 为派生 bool 供旧 API 读取）
  App.panelCollapsed = false; // 派生：== (App.panelMode === "collapsed")
  App.panelFull = false;      // 派生：== (App.panelMode === "full")
  let modalCloseCb = null;
  let pendingAvatarFor = null;
  let lastColorFocus = null;
  let nodeRBefore = null; // 角色圆圈滑块拖动前的值（用于一次性记历史，避免每像素一条 undo）

  // 批量编辑名单按钮图标（内联 SVG，currentColor 跟随按钮文字色，夜间自动变浅）
  const IC_PEOPLE_PLUS =
    '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M19 20C22.866 20 26 16.866 26 13C26 9.13401 22.866 6 19 6C15.134 6 12 9.13401 12 13C12 16.866 15.134 20 19 20Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M36 29V41M30 35H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M27 28H18.8C14.3196 28 12.0794 28 10.3681 28.8719C8.86278 29.6389 7.63893 30.8628 6.87195 32.3681C6 34.0794 6 36.3196 6 40.8V42H27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  // 内联 SVG 图标表（沿用 .ic-svg 规范：currentColor 描边，夜间自动变浅）
  const ICONS = {
    del:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg>',
    person: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
    like:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21s-7-4.6-9.3-9C1.2 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 4.8 3.5 3.3 6.5C19 16.4 12 21 12 21z"/></svg>',
    compat: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h12l-3-3M20 16H8l3 3"/></svg>',
    eye:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7c2 0 3.7.7 5 1.8M22 12s-4 7-10 7c-2 0-3.7-.7-5-1.8"/><path d="M3 3l18 18"/></svg>',
    search: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    eraser: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l6-6 6 6-3 3H8z"/><path d="M9 21h11"/></svg>',
    sun:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>',
    moon:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>',
    save:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h12l4 4v14H5z"/><path d="M8 3v6h7V3M8 21v-6h7v6"/></svg>',
    hide:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    brush:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5-7 7-5-5z"/><path d="M9.5 9.5L4 21"/></svg>',
    pen:    '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.9995 8.99902L38.9995 16.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.99953 31.999L35.9994 4L43.9995 11.999L15.9995 39.999L5.99951 41.999L7.99953 31.999Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30.9995 8.99902L38.9995 16.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.99951 31.999L15.9995 38.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.9995 34.999L34.9995 12.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    style:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.2-1-1.5-1-2.5s1-1.5 2-1.5h1a4 4 0 0 0 4-4c0-4.4-4-6-7-6z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10.5" r="1"/></svg>',
    hand:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v5M16 9a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.6L4 16a1.5 1.5 0 0 1 2.5-1.6L7 15"/></svg>',
    globe:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    link:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6M10 8a3 3 0 0 0 0 6M14 8a3 3 0 0 1 0 6"/></svg>',
    close:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    dlIn:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>',
    dlOut:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 5h16"/></svg>',
    pkg:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    plus:   '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowR: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M38 33C38 25.7011 33.897 19.4168 28 16.5919C25.8653 15.5693 23.4954 15 21 15C11.6112 15 4 23.0589 4 33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 28L38 33L44 25" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ringB:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="7"/></svg>',
    ringT:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6.5"/></svg>',
    swap:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M14 4l4 4-4 4M20 16H7M10 20l-4-4 4-4"/></svg>',
  };

  const $ = App.byId;

  // =============== Tab 切换 ===============
  // 面板三态（折叠/半开/全开）单源：App.panelMode
  // 旧 API（setPanelCollapsed / setPanelFull）作为兼容壳保留，switchTab、homeBtn 等旧调用方不破
  App.setPanelMode = function (m, opts) {
    if (m !== "collapsed" && m !== "half" && m !== "full") return;
    App.panelMode = m;
    App.panelCollapsed = (m === "collapsed");
    App.panelFull = (m === "full");
    document.body.classList.toggle("panel-collapsed", App.panelCollapsed);
    document.body.classList.toggle("panel-full", App.panelFull);
    const head = $("panelHead");
    if (head) head.setAttribute("data-state", m);
    const home = $("homeBtn");
    if (home) home.classList.toggle("hidden", !App.panelFull);
    // 离开拖动状态：清掉 inline 高度（让 class 重新接管）
    if (!(opts && opts.keepDragHeight)) {
      const p = $("panel"); if (p) { p.classList.remove("dragging"); p.style.maxHeight = ""; }
      if (head) head.classList.remove("dragging");
    }
  };
  // 兼容壳
  App.setPanelCollapsed = function (v) {
    if (v) App.setPanelMode("collapsed");
    else if (App.panelMode === "collapsed") App.setPanelMode("half");
  };
  // 面板全开态：返回钮出现在左上（避开容器左上角按钮）
  App.setPanelFull = function (v) {
    if (v) App.setPanelMode("full");
    else if (App.panelMode === "full") App.setPanelMode("half");
  };
  // =============== 画板模式（连线/角色/删线 三选一 Switch）===============
  // 单一状态 App.paintMode；App.eraser / state.ui.charMode 作为派生量同步维护，避免三个布尔开关并存导致互斥漏洞
  App.syncPaintMode = function () {
    const m = (App.state && App.state.ui && App.state.ui.charMode) ? "char" : "link";
    App.paintMode = m;
    App.eraser = false;
  };
  App.setPaintMode = function (m) {
    if (m !== "link" && m !== "char" && m !== "erase") return;
    if (App.paintMode === m && m !== "link") m = "link"; // 同段再点 = 回到连线模式（保留 toggle 体感）
    App.paintMode = m;
    App.eraser = (m === "erase");
    if (App.state && App.state.ui) App.state.ui.charMode = (m === "char");
    App.linkSource = null;
    App.dragGhost = null;
    App.pendingLinkDel = null;
    if (m === "char") {
      App.toast(App.brush && App.brush.bottom
        ? ("角色模式开：点/划人物赋「" + App.nameOf("bottom", App.brush.bottom) + "」")
        : "角色模式开：先选一个粗线（喜好度）笔刷");
    } else if (m === "erase") {
      App.toast("删线模式开：点连线两段式删除，点人物筛选其相关连线");
    }
    if (App.render) App.render();
    if (App.renderPanel) App.renderPanel();
  };
  // 启动时按当前 state.ui.charMode 对齐一次（兼容旧草稿 charMode=true 加载）
  App.syncPaintMode();
  App.switchTab = function (tab) {
    App.activeTab = tab;
    App.pendingLinkDel = null; // 切 Tab 清除删线待确认态
    if (App.panelCollapsed) App.setPanelCollapsed(false); // 切 Tab 视为要操作面板 → 自动展开
    if (App.panelFull) App.setPanelFull(false); // 切 Tab 一律回半开
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tab") === tab);
    });
    if (tab !== "layout") {
      App.selCharId = null;
      $("nodeOps").classList.add("hidden");
    }
    renderPanel();
    App.render();
  };

  // =============== 面板渲染 ===============
  function renderPanel() {
    const p = $("panel");
    const t = App.activeTab;
    if (t === "style") p.innerHTML = panelStyle();
    else if (t === "person") p.innerHTML = panelPerson();
    else if (t === "link") p.innerHTML = panelLink();
    else if (t === "layout") p.innerHTML = panelLayout();
    else if (t === "hand") p.innerHTML = panelHand();
    if (t === "layout") updateNodeOps();
  }

  // ---------- 样式 ----------
  function tableRows(layer, isArrow) {
    const tb = App.state.tables[layer];
    return tb.map((r) => {
      if (isArrow) {
        const icon = r.type === "one" ? "➜" : r.type === "both" ? "⇄" : "—";
        return `<div class="trow">
          <span class="mini" style="width:18px;text-align:center">${icon}</span>
          <span class="tname"><input type="text" data-row-edit="name" data-layer="${layer}" data-key="${r.key}"
            value="${App.esc(r.name)}" placeholder="名称" ${r.key === "none" ? "readonly" : ""}></span>
          ${r.key === "none" ? "" : `<span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">${ICONS.del}</span>`}
        </div>`;
      }
      return `<div class="trow${r.hidden ? " off" : ""}">
        <span class="sw" style="background:${r.color};border-color:rgba(0,0,0,.2)"></span>
        <input type="color" value="${r.color}" data-row-edit="color" data-layer="${layer}" data-key="${r.key}">
        <span class="tname"><input type="text" data-row-edit="name" data-layer="${layer}" data-key="${r.key}"
          value="${App.esc(r.name)}" placeholder="名称"></span>
        <span class="pal">${PALETTE.map((c) => `<i data-cmd="pal" data-layer="${layer}" data-key="${r.key}" data-c="${c}" style="background:${c}"></i>`).join("")}</span>
        <span class="mini eye ${r.hidden ? "off" : ""}" data-cmd="tbl-hide" data-layer="${layer}" data-key="${r.key}"
          title="${r.hidden ? "已隐藏（不进图例），点一下恢复" : "点一下隐藏（不进图例，连线保留）"}">${r.hidden ? ICONS.eyeOff : ICONS.eye}</span>
        <span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">${ICONS.del}</span>
      </div>`;
    }).join("");
  }

  const PALETTE = ["#d32f2f", "#f57c00", "#fbc02d", "#43a047", "#1976d2", "#8e24aa", "#ec407a", "#00897b", "#5e35b1", "#222222", "#888888", "#1c1c1e"];

  function panelStyle() {
    const arrowName = (App.state.meta && App.state.meta.arrowName) ? String(App.state.meta.arrowName) : "情感指向";
    const night = !!(App.state.ui && App.state.ui.night);
    return `<div class="pg">
      <div class="ctrl-row">外观：
        <button class="chip ${!night ? "on" : ""}" data-cmd="ui-night" data-val="day">${ICONS.sun} 日间</button>
        <button class="chip ${night ? "on" : ""}" data-cmd="ui-night" data-val="night">${ICONS.moon} 夜间</button>
      </div>
      <div class="pg-t"><span class="pg-t-l">${ICONS.ringB} 底层色（喜好等级 · 粗线）</span><button class="mini" data-cmd="tbl-add" data-layer="bottom" aria-label="添加底层色">${ICONS.plus}</button></div>
      <div>${tableRows("bottom", false)}</div>
      <div class="pg-t"><span class="pg-t-l">${ICONS.ringT} 顶层色（关系类型 · 细线+白描边）</span><button class="mini" data-cmd="tbl-add" data-layer="top" aria-label="添加顶层色">${ICONS.plus}</button></div>
      <div>${tableRows("top", false)}</div>
      <div class="pg-t">细线描边样式</div>
      <div class="ctrl-row">粗细
        <input type="range" data-set="thinW" min="1" max="6" step="0.2" value="${App.state.ui.thinW || 2.2}" style="flex:1">
        <span class="thinW-val" style="width:44px;text-align:right">${(App.state.ui.thinW || 2.2)}</span>
      </div>
      <div class="ctrl-row"><span class="sw-row"><span class="sw-txt">虚线</span><span class="swbox ${App.state.ui.thinDash ? "on" : ""}" data-cmd="thin-dash" role="switch" aria-checked="${App.state.ui.thinDash}" aria-label="细线虚线描边"><i></i></span></span>
        <span style="color:var(--sub);font-size:11px">细线（顶层关系线）的线宽与实线/虚线</span></div>
      <div class="pg-t">${ICONS.arrowR} 箭头含义</div>
      <div class="trow"><span class="lg-ic">${ICONS.arrowR}</span>
        <span class="tname"><input type="text" data-set="arrowName" value="${App.esc(arrowName)}" placeholder="情感指向"></span>
      </div>
      <div class="hint">箭头在图例/导出图里的标注名（如：情感指向、单恋、攻受…）。箭头类型固定为 无箭头/单箭头/双箭头，在「连线」面板选择。</div>
      <div class="ctrl-row">背景色：<input type="color" data-set="bg" value="${App.state.bg}"></div>
      <div class="hint">👁 = 该项显示在画布图例与导出图里；点成 🚫 则不显示（已经画好的连线不受影响）。</div>
    </div>`;
  }

  // ---------- 人物 ----------
  function avaInner(c) {
    if (c.avatar) return `<img src="${c.avatar}" alt="">`;
    return "👤";
  }
  function panelPerson() {
    const st = App.state;
    const rows = st.chars.map((c) => {
      const likeOpts = ['<option value="">— 无 —</option>']
        .concat(st.tables.bottom.map((r) => `<option value="${r.key}" ${c.like === r.key ? "selected" : ""}>${App.esc(r.name)}</option>`).join(""));
      const m = st.ui.avatarMode;
      const ringTxt = c.ring === 0 ? "圆心" : `圈${c.ring}`;
      return `<div class="prow" data-pid="${c.id}">
        <div class="ava" data-cmd="pm-avatar" data-id="${c.id}" title="设置头像">${avaInner(c)}</div>
        <div class="pn"><input type="text" data-cmd="pm-rename" data-id="${c.id}" value="${App.esc(c.name)}" placeholder="角色名"></div>
        <span class="mini" style="color:var(--sub);font-size:11px">${ringTxt}</span>
        <select data-cmd="pm-like" data-id="${c.id}">${likeOpts}</select>
        <button class="mini" data-cmd="pm-center" data-id="${c.id}" title="${c.ring === 0 ? "取消圆心" : "设为圆心"}"><img class="pm-star" src="assets/icons/${c.ring === 0 ? "star-fill" : "star-line"}.svg" alt=""></button>
        <button class="mini danger" data-cmd="pm-del" data-id="${c.id}" title="删除">${ICONS.del}</button>
      </div>`;
    }).join("");

    return `<div class="pg">
      <div class="ctrl-row" style="flex-wrap:wrap">
        <button class="btn" data-cmd="pm-batch" title="按圈批量编辑角色名单">${IC_PEOPLE_PLUS}批量编辑名单</button>
      </div>
      <div class="ctrl-row" style="flex-wrap:wrap">
        <span>头像显示：</span>
        <button class="chip ${st.ui.avatarMode === "avatar" ? "on" : ""}" data-cmd="pm-mode" data-val="avatar">${ICONS.person} 头像</button>
        <button class="chip ${st.ui.avatarMode === "like" ? "on" : ""}" data-cmd="pm-mode" data-val="like">${ICONS.like} 喜好度</button>
        <button class="chip ${st.ui.avatarMode === "both" ? "on" : ""}" data-cmd="pm-mode" data-val="both">${ICONS.compat} 兼容</button>
      </div>
      <div class="ctrl-row">
        <span>显示名字：</span>
        <button class="chip ${st.ui.showNames ? "on" : ""}" data-cmd="pm-names">${st.ui.showNames ? "开" : "关"}</button>
      </div>
      <div class="pg-t"><span class="pg-t-l">角色列表（${st.chars.length}）</span><span class="pg-t-r">点击行内 📷 上传头像</span></div>
      ${rows || '<div class="hint">暂无角色，点上方「批量编辑名单」按圈录入</div>'}
    </div>`;
  }

  // ---------- 连线 ----------
  function brushChips() {
    const st = App.state;
    const b = App.brush;
    const bottom = st.tables.bottom.map((r) => `<button class="chip ${b.bottom === r.key ? "on" : ""}" data-cmd="br-b" data-key="${r.key}"><span class="sw" style="background:${r.color}"></span>${App.esc(r.name)}</button>`).join("");
    const top = st.tables.top.map((r) => `<button class="chip ${b.top === r.key ? "on" : ""}" data-cmd="br-t" data-key="${r.key}"><span class="sw sw-top" style="background:${r.color}"></span>${App.esc(r.name)}</button>`).join("");
    const arrow = st.tables.arrow.map((r) => {
      const icon = r.type === "one" ? "➜" : r.type === "both" ? "⇄" : "—";
      return `<button class="chip ${b.arrow === r.key ? "on" : ""}" data-cmd="br-a" data-key="${r.key}">${icon}${App.esc(r.name)}</button>`;
    }).join("");
    return { bottom, top, arrow };
  }

  function recentLinks() {
    const st = App.state;
    const byId = {};
    st.chars.forEach((c) => (byId[c.id] = c));
    const selName = App.selCharId ? (byId[App.selCharId] ? byId[App.selCharId].name : null) : null;
    let list = st.links.slice().reverse();
    if (selName) {
      const sel = App.selCharId;
      list = list.filter((k) => k.src === sel || k.dst === sel);
    }
    if (!list.length) return `<div class="hint">${selName ? `「${App.esc(selName)}」暂无连线` : "暂无连线。先在下方选笔刷，再点角色拖向另一个角色。"}</div>`;
    return list.map((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return "";
      const isTop = k.layer === "top";
      const col = isTop ? App.colorOf("top", k.ckey) : App.colorOf("bottom", k.ckey);
      const ar = st.tables.arrow.find((x) => x.key === k.arrow);
      const aName = App.esc(a.name), bName = App.esc(b.name);
      const dot = isTop ? `<span class="ln-thin" style="background:${col}"></span>` : `<span class="ln-dot" style="background:${col}"></span>`;
      return `<div class="dlrow" data-pid="${k.src}">
        <span class="dl-main" data-cmd="link-edit" data-id="${k.id}" title="点击编辑箭头/方向">${dot}<span>${aName} ${ar && ar.type === "one" ? "➜" : ar && ar.type === "both" ? "⇄" : "—"} ${bName}</span></span>
        <button class="mini" data-cmd="filter-link" data-id="${k.src}" title="只看此人连线">${ICONS.search}</button>
        <button class="mini danger" data-cmd="link-del" data-id="${k.id}" title="删除">${ICONS.del}</button>
      </div>`;
    }).join("");
  }

  function panelLink() {
    const c = brushChips();
    return `<div class="pg">
      <div class="pg-t">${ICONS.brush} 底层粗线笔刷</div>
      <div class="chips">${c.bottom || '<span class="hint">暂无底层色，去 ${ICONS.style}样式 添加</span>'}</div>
      <div class="pg-t">${ICONS.pen} 顶层细线笔刷</div>
      <div class="chips">${c.top || '<span class="hint">暂无顶层色，去 ${ICONS.style}样式 添加</span>'}</div>
      <div class="pg-t">↔️ 箭头</div>
      <div class="chips">${c.arrow}</div>
      <div class="ctrl-row">
        <div class="paint-seg" role="tablist" aria-label="画板模式">
          <button class="paint-seg-btn ${App.paintMode === "link" ? "active" : ""}" data-cmd="paint-set" data-mode="link" title="连线模式：点人物起一条线，再点结束">${ICONS.link}<span class="lbl">连线模式</span></button>
          <button class="paint-seg-btn ${App.paintMode === "char" ? "active" : ""}" data-cmd="paint-set" data-mode="char" title="角色模式：点/划人物批量赋当前粗线笔刷">${ICONS.person}<span class="lbl">角色模式</span></button>
          <button class="paint-seg-btn ${App.paintMode === "erase" ? "active" : ""}" data-cmd="paint-set" data-mode="erase" title="删线模式：点连线两段式删除">${ICONS.eraser}<span class="lbl">删线模式</span></button>
        </div>
      </div>
      <div class="ctrl-row">
        <button class="btn" data-cmd="lnk-batch" title="用文字批量编辑喜好度与连线">${ICONS.pen} 批量编辑连线</button>
        <button class="btn danger" data-cmd="lnk-clear" title="删除画板上全部连线">${ICONS.del} 清空全部连线</button>
      </div>
      <div class="pg-t"><span class="pg-t-l"><svg class="ic-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M5.81836 6.72729V14H13.0911" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 24C4 35.0457 12.9543 44 24 44V44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C16.598 4 10.1351 8.02111 6.67677 13.9981" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.005 12L24.0038 24.0088L32.4832 32.4882" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>连线记录</span><span class="pg-t-r">${App.selCharId ? "已按人物筛选" : "点画布人物可筛选"}</span></div>
      ${recentLinks()}
    </div>`;
  }

  // ---------- 布局 ----------
  function ringRows() {
    const st = App.state;
    return st.rings.map((r, i) => {
      const ringNo = i + 1;
      const n = App.charsOnRing(ringNo).length;
      const slotPart = st.ui.slotMode
        ? ` 槽位<input type="number" class="inp" style="width:56px" data-set="slots" data-ring="${ringNo}" value="${Math.max(r.slots || 0, App.SLOT_MIN, n)}" min="${Math.max(1, n)}">`
        : "";
      // 第 1 圈不可删，不提供删除入口
      const delPart = ringNo > 1
        ? `<button class="mini danger" data-cmd="ly-delring" data-ring="${ringNo}" title="删除该轨道">${ICONS.del}</button>`
        : "";
      return `<div class="ctrl-row"><span style="width:44px">圈${ringNo}</span>
        半径<input type="number" class="inp" style="width:76px" data-set="rad" data-ring="${ringNo}" value="${Math.round(r.rad)}" min="40">
        ${slotPart}<span style="color:#999;font-size:11px">${n}人</span>${delPart}</div>`;
    }).join("");
  }

  function panelLayout() {
    const st = App.state;
    return `<div class="pg">
      <div class="ctrl-row" style="flex-wrap:wrap">
        <button class="btn primary" data-cmd="ly-even">⏸ 平均排布</button>
        <button class="btn" data-cmd="ly-addring">⊕ 添加轨道</button>
        <span class="sw-row"><span class="sw-txt">槽位</span><span class="swbox ${st.ui.slotMode ? "on" : ""}" data-cmd="ly-slots" role="switch" aria-checked="${st.ui.slotMode}" aria-label="槽位吸附"><i></i></span></span>
      </div>
      <div class="hint">拖拽角色=换圈/沿圈移动；<b>槽位关</b>时可停在轨道任意角度（间距可以不规则，不会自动均分）；<b>槽位开</b>时自动吸附到就近空槽，多余空槽显示成虚线占位圈。想恢复整齐再点「平均排布」。拖动圈顶蓝点=改半径；点角色出现操作条。</div>
      <div class="pg-t">角色圆圈</div>
      <div class="ctrl-row">大小
        <input type="range" data-set="nodeR" min="${App.NODE_R_MIN}" max="${App.NODE_R_MAX}" step="1" value="${App.nodeR()}" style="flex:1">
        <span id="nodeRVal" style="width:44px;text-align:right">${App.nodeR()}</span>
      </div>
      <div class="pg-t">圈的半径与槽位</div>
      ${ringRows()}
    </div>`;
  }

  // ---------- 抓手 ----------
  function panelHand() {
    const z = Math.round(App.view.s * 100);
    return `<div class="pg">
      <div class="ctrl-row hand-row">
        <button class="btn icon-only" data-cmd="hd-hide" title="${App.fullUI ? "退出全屏" : "隐藏UI全屏"}">${ICONS.hide}</button>
        <div class="zoom-wrap"><span class="zoom-lab">缩放</span>
          <input type="range" id="zoomRange" min="30" max="260" value="${z}" style="flex:1">
          <span id="zoomVal" style="width:44px;text-align:right">${z}%</span>
        </div>
        <button class="btn primary icon-only" data-cmd="hd-save" title="保存图片">${ICONS.save}</button>
      </div>
      <div class="hint">抓手模式下点人物不触发操作，仅移动视口 / 双指缩放，方便定位后截图。</div>
    </div>`;
  }

  // 节点操作条（布局模式选中角色）
  function updateNodeOps() {
    const box = $("nodeOps");
    const c = App.state.chars.find((x) => x.id === App.selCharId);
    if (App.activeTab !== "layout" || !c) { box.classList.add("hidden"); return; }
    const maxRing = Math.max(1, c.ring, App.state.rings.length);
    let opts = '<option value="0">圆心</option>';
    for (let i = 1; i <= maxRing + 1; i++) {
      opts += `<option value="${i}" ${c.ring === i ? "selected" : ""}>圈${i}</option>`;
    }
    $("opsRingSel").innerHTML = opts;
    // 槽位模式：在圆环选择旁提供「槽位」下拉，仅列出空闲槽（含当前槽），避免重叠
    const slotWrap = $("opsSlotSel");
    if (App.state.ui.slotMode && c.ring > 0) {
      const sl = App.state.rings[c.ring - 1].slots || 0;
      if (sl >= 1) {
        const occ = new Set(App.charsOnRing(c.ring).filter((x) => x.id !== c.id).map((x) => x.slot).filter((s) => s != null));
        // 只显示「槽 N」，不带「（当前）」后缀；未落槽时占位项显示「槽位」
        let so = c.slot == null
          ? `<option value="-1" selected>槽位</option>`
          : `<option value="${c.slot}" selected>槽${c.slot + 1}</option>`;
        for (let s = 0; s < sl; s++) {
          if (occ.has(s) || s === c.slot) continue;
          so += `<option value="${s}">槽${s + 1}</option>`;
        }
        slotWrap.innerHTML = so;
        slotWrap.classList.remove("hidden");
      } else {
        slotWrap.classList.add("hidden");
      }
    } else {
      slotWrap.classList.add("hidden");
    }
    // ⑦ 圆心星标两态：实心=已是圆心（再点取消），空心=可设为圆心（纯 icon，不配文字）
    const isC = c.ring === 0;
    $("opsCenter").innerHTML = `<img class="pm-star" src="assets/icons/${isC ? "star-fill" : "star-line"}.svg" alt="">`;
    $("opsCenter").title = isC ? "取消圆心" : "设为圆心";
    box.classList.remove("hidden");
  }

  // =============== 菜单 / 弹窗 ===============
  // 夜间模式外壳类同步（画布主题在 render.js 按 ui.night 处理）
  App.applyNight = function () {
    const night = !!(App.state.ui && App.state.ui.night);
    document.body.classList.toggle("night", night);
    if (night) document.body.style.removeProperty("--bg"); // 防 inline 覆盖夜间变量
    else document.body.style.setProperty("--bg", App.state.bg || "#ffffff");
  };
  // 改名弹窗（顶栏标题点击 → 改名）
  App.openTitleModal = function (onSaved) {
    App._titleOkCb = onSaved || null;
    App.openModal(`${modalHead("修改图名 / 填表人")}
      <div style="font-size:12px;color:var(--sub);margin:2px 0 4px">图名</div>
      <input type="text" id="promptTitle" class="inp" style="width:100%" maxlength="18" value="${App.esc(App.state.title)}">
      <div style="font-size:12px;color:var(--sub);margin:12px 0 4px">填表人（可选）</div>
      <input type="text" id="promptFiller" class="inp" style="width:100%" maxlength="12" value="${App.esc(App.getFiller())}" placeholder="未填写则不显示“填表：”">
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="title-ok">确定</button></div>`);
    modalCloseCb = null;
  };
  App.openModal = function (bodyHtml, full) {
    $("modalBox").classList.toggle("full", !!full);
    $("modalBox").innerHTML = bodyHtml;
    $("modalRoot").classList.remove("hidden");
  };
  App.closeModal = function () {
    $("modalRoot").classList.add("hidden");
    $("modalBox").classList.remove("full");
    if (modalCloseCb) { const f = modalCloseCb; modalCloseCb = null; f(); }
  };
  // 连线记录编辑弹窗：改箭头类型（无/单/双）、翻转方向（顶层有向）、删除
  // 同一对角色的所有连线（粗线 + 细线可能各一条）
  function pairOf(k) {
    return App.state.links.filter((x) => (x.src === k.src && x.dst === k.dst) || (x.src === k.dst && x.dst === k.src));
  }
  function eachPair(k, fn) { pairOf(k).forEach(fn); }
  // 箭头 / 翻转的作用对象：优先细线
  function pairTarget(id) {
    const k = App.getLink(id);
    if (!k) return null;
    const list = pairOf(k);
    return list.find((x) => x.layer === "top") || list[0] || null;
  }
  // 设置某一层的线：val 为空 = 去掉这一层
  function setLinkLayer(id, layer, val) {
    const k0 = App.getLink(id);
    if (!k0) return;
    const list = pairOf(k0);
    const cur = list.find((x) => x.layer === layer) || null;
    if (!val) {
      if (cur) App.state.links = App.state.links.filter((x) => x !== cur);
    } else if (cur) {
      cur.ckey = val;
    } else {
      const base = list[0];
      App.addLink(base ? base.src : k0.src, base ? base.dst : k0.dst, layer, val, layer === "top" ? ((base || {}).arrow || "none") : "none");
    }
    App.render();
    if (App.renderPanel) App.renderPanel();
    const rest = pairOf(k0);
    if (rest.length) App.openLinkEdit(rest[0].id);
    else App.closeModal();
  }

  // 编辑连线：以「同一对角色」为单位，粗线（喜好度）与细线（关系）可同时设定
  App.openLinkEdit = function (id) {
    const k0 = App.getLink(id);
    if (!k0) { App.toast("连线不存在", true); return; }
    const st = App.state;
    const list = pairOf(k0);
    const bot = list.find((x) => x.layer === "bottom") || null;
    const top = list.find((x) => x.layer === "top") || null;
    const main = top || bot || k0;
    const arrow = main.arrow || "none";
    const nm = (cid) => { const c = st.chars.find((x) => x.id === cid); return c ? c.name : "?"; };
    const opts = (selId) => st.chars.map((c) =>
      `<option value="${c.id}"${c.id === selId ? " selected" : ""}>${App.esc(c.name)}</option>`).join("");
    const chips = (layer, cur, cmd) => {
      const rows = (st.tables[layer] || []).filter((r) => r.show !== false);
      const h = rows.map((r) => `<span class="chip ${r.key === cur ? "on" : ""}" data-cmd="${cmd}" data-id="${k0.id}" data-val="${r.key}"><span class="sw" style="background:${r.color}"></span>${App.esc(r.name)}</span>`).join("");
      return `<div class="chips">${h}<span class="chip ${cur ? "" : "on"}" data-cmd="${cmd}" data-id="${k0.id}" data-val="">无</span></div>`;
    };
    const html = `<div class="mh">编辑连线 · ${App.esc(nm(k0.src))} ↔ ${App.esc(nm(k0.dst))}<span class="x" data-cmd="m-close">${ICONS.close}</span></div>
      <div class="ln-ends">
        <select class="inp" data-cmd="link-edit-end" data-end="src" data-id="${k0.id}" aria-label="这一端是谁">${opts(k0.src)}</select>
        <button class="ln-swap" data-cmd="link-edit-flip" data-id="${k0.id}" aria-label="交换两端" title="交换两端">${ICONS.swap}</button>
        <select class="inp" data-cmd="link-edit-end" data-end="dst" data-id="${k0.id}" aria-label="另一端是谁">${opts(k0.dst)}</select>
      </div>
      <div class="pg-t">粗线（喜好度）</div>
      ${chips("bottom", bot ? bot.ckey : "", "link-edit-thick")}
      <div class="pg-t">细线（关系）</div>
      ${chips("top", top ? top.ckey : "", "link-edit-thin")}
      <div class="pg-t">箭头</div>
      <div class="chips">
        <span class="chip ${arrow === "none" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="none">无箭头</span>
        <span class="chip ${arrow === "one" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="one">单箭头</span>
        <span class="chip ${arrow === "both" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="both">双箭头</span>
      </div>
      <div class="modal-btns">
        <button class="btn danger" data-cmd="link-edit-del" data-id="${k0.id}">删除此连线</button>
        <button class="btn primary" data-cmd="m-close">完成</button>
      </div>`;
    App.openModal(html, true);
    // 端点换成别的角色
    document.querySelectorAll("#modalBox [data-cmd='link-edit-end']").forEach((sel) => {
      sel.addEventListener("change", () => {
        const nid = sel.value, end = sel.getAttribute("data-end");
        const oldId = end === "src" ? k0.src : k0.dst;
        if (!nid || nid === oldId) return;
        if (nid === (end === "src" ? k0.dst : k0.src)) {
          App.toast("两端不能是同一个人", true);
          App.openLinkEdit(k0.id);
          return;
        }
        eachPair(k0, (x) => {
          if (end === "src") { if (x.src === oldId) x.src = nid; }
          else if (x.dst === oldId) x.dst = nid;
        });
        App.render();
        if (App.renderPanel) App.renderPanel();
        App.openLinkEdit(k0.id);
      });
    });
  };
  // 图例点击 → 应用对应笔刷（不 commitHist，切换行为与 §十二 P5 一致）
  App.applyLegendBrush = function (layer, key) {
    if (layer === "bottom") App.brush.bottom = key;
    else if (layer === "top") App.brush.top = key;
    else if (layer === "arrow") App.brush.arrow = key;
    if (App.activeTab !== "link") {
      if (App.paintMode !== "link") App.setPaintMode("link"); // 切 Tab 顺便退出非连线模式
      App.selCharId = null;
      App.switchTab("link");
      return;
    }
    if (App.paintMode === "erase") App.setPaintMode("link"); // 选笔刷时若处于删线模式 → 回连线模式
    if (App.renderPanel) App.renderPanel();
    App.render();
  };
  function modalHead(title) {
    return `<div class="mh">${title}<span class="x" data-cmd="m-close">${ICONS.close}</span></div>`;
  }
  App.confirm = function (msg, okText, onOk) {
    App.openModal(`${modalHead("确认")}
      <div class="hint" style="font-size:15px">${msg}</div>
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="m-ok">${okText || "确定"}</button></div>`);
    modalCloseCb = null;
    App._okCb = onOk;
  };
  App.promptText = function (title, init, onOk) {
    App.openModal(`${modalHead(title)}
      <input type="text" id="promptVal" class="inp" style="width:100%" value="${App.esc(init)}">
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="m-ok2">确定</button></div>`);
    App._okCb = onOk;
  };
  App.helpModal = function () {
    App.openModal(`${modalHead("CP Chart 使用指南")}
      <div class="help-card">
        <div class="help-intro">一个小工具，专门用来画人物之间的关系连线图。数据都存在你自己的设备上，不会上传到任何服务器。</div>

        <div class="help-h">三步上手</div>
        <div class="help-step"><b>第一步 · 录入人物</b>：点底部「人物」→「批量编辑名单」，按圈写，一圈一行：<br>
          <code>1: 甲，乙，丙</code><br><code>2: 丁，戊，己，庚</code><br>
          中英文逗号、空格都能分隔。<code>圆心: 某人</code> 或 <code>0: 某人</code> 把某人放最中间；直接写 <code>1:</code> 也可以，圆心就先空着。</div>
        <div class="help-step"><b>第二步 · 画连线</b>：点底部「连线」，先选好三样：<br>
          ◯ 粗线 = 喜好度（本命 / 很喜欢 / 路好 / 不吃）<br>
          ● 细线 = 关系类型（爱情 / 友情 / 亲情 / QPR）<br>
          ➜ 箭头 = 方向（无 / 单箭头 / 双箭头）<br>
          然后在角色圆上按住，拖到另一个角色上松手，线就画好了。同一对人后画的会盖掉先画的；A→B 和 B→A 的单箭头可以各画各的，用不同颜色区分。</div>
        <div class="help-step"><b>第三步 · 导出</b>：点画布右侧的「菜单」→ 可以导出图片存相册、复制名单文本、备份完整快照，或直接发布笔记。</div>

        <div class="help-h">各 Tab 是干嘛的</div>
        <div class="help-tab"><b>样式</b>：调颜色、改图例名字、决定哪些类型显示/隐藏、换背景色</div>
        <div class="help-tab"><b>人物</b>：导入或编辑名单、传头像、设喜好度、定圆心</div>
        <div class="help-tab"><b>连线</b>：选笔刷、画线/删线、批量整理、看连线记录</div>
        <div class="help-tab"><b>布局</b>：拖动换圈、调圈大小、加/减轨道、一键均匀排布</div>
        <div class="help-tab"><b>抓手</b>：纯看图、隐藏界面截图、存图片</div>

        <div class="help-h">常用操作小贴士</div>
        <div class="help-tip">
          • <b>拖角色换圈</b>：布局模式按住角色，拖到目标圈附近松手<br>
          • <b>调圈半径</b>：拖圈顶 12 点方向的蓝色小圆点，或在布局面板输入数值<br>
          • <b>删线</b>：连线 →「${ICONS.eraser} 删线模式」，点哪条删哪条<br>
          • <b>撤销/重做</b>：画布右侧悬浮 ↩︎ / ↪︎ 可回退几乎所有操作<br>
          • <b>改图名 / 填表人</b>：菜单 → 工具 → 改图名 / 填表人<br>
          • <b>缩放/平移</b>：双指缩放，单指拖空白区域平移<br>
          • <b>找不着图了？</b>点画布右侧悬浮 <b>¤ 定位坐标</b>，圆心立刻回到画面正中，并自动缩放到全部轨道可见<br>
          • <b>图例直切</b>：点画布左上角图例色块可直接切换对应笔刷</div>

        <div class="help-h">关于数据安全</div>
        <div class="help-tip">
          • 数据只存在你这台设备的本地草稿里，不会上传、不会外泄<br>
          • 编辑会自动存草稿；想长期保存就点「导出完整快照」，把那段文本发到别的设备再「导入快照」就能恢复<br>
          • 快照不含头像，导入后头像要重新传一下</div>

        <div class="help-end">还有问题？点「菜单 → 关于」能看到版本和作者信息。祝你用得顺手！</div>
      </div>
      <div class="modal-btns"><button class="btn primary" data-cmd="m-close">知道了</button></div>`);
  };

  // 关于页 · 更新日志数据源（发新版时把新版本插到数组最前，展开范围自动重置）
  // item = { n:功能名, h:如何使用 } ｜ fixes = 修复项，统一写「修复了【功能】的【问题】」
  // 规则：只展开最近 ABOUT_LOG_OPEN 个版本并显示「功能：如何使用」；更早的收起，且只留「功能」名
  const ABOUT_LOG_OPEN = 2;
  const ABOUT_LOG = [
    { ver: "v0.13.0", date: "2026-09-09", items: [
      { n: "更新日志折叠", h: "只展开最近两个版本，更早的收起只留功能名" },
      { n: "真箭头", h: "连线在箭头处断开留白，方向一眼看清" },
      { n: "色板一行滑动", h: "预制颜色横排滑动选，圆点双层描边" },
      { n: "统一编辑器", h: "三个 Tab 合一，一处编辑人物、连线、完整数据" },
      { n: "完整数据压缩", h: "一段 XHS2: 文本备份整张图，旧版快照也能导入" },
      { n: "导入确认提示", h: "导入前提示会覆盖当前画板，失败单独报错" },
      { n: "菜单改名", h: "「导出布局·人物·图例」改为「导出完整数据」" },
      { n: "连线分层直选", h: "编辑一条连线时直接选粗线、细线图例" },
      { n: "导出结果屏", h: "四个按钮：关闭 / 新建 / 发布 / 存相册" },
      { n: "角色批量上色", h: "连线模式里从某角色划过，批量赋喜好色" },
      { n: "旧草稿兼容", h: "旧版本草稿自动读取，导出时转成新格式" },
    ], fixes: ["面板说明文字挤压按钮的问题", "浏览器小屏上面板布局错位的问题"] },
    { ver: "v0.12.0", date: "2026-09-08", items: [
      { n: "径向菜单", h: "点画布右侧 ➕，一圈按钮绕着绽开，单手也好点" },
      { n: "导入导出二级窗", h: "导入与保存各收进一个小窗，点开再选具体项" },
      { n: "帮助按钮", h: "点「?」开指南；面板全开时变「←」回画板" },
    ] },
    { ver: "v0.11.0", date: "2026-09-08", items: [
      { n: "槽位布局" }, { n: "自由摆放" }, { n: "批量编辑名单" },
      { n: "连线记录编辑" }, { n: "角色操作条" }, { n: "定位坐标 ¤" },
      { n: "面板三态" }, { n: "头像大小" }, { n: "三表显隐" },
    ], fixes: ["夜间模式的画板染黑问题", "网页版导出的假下载问题"] },
    { ver: "v0.10.0", date: "2026-09-07", items: [
      { n: "容器适配" }, { n: "底部菜单" }, { n: "面板折叠" }, { n: "图例分行" },
      { n: "单箭头共存" }, { n: "箭头含义自定义" }, { n: "导入自动居中" }, { n: "圆心星标" },
    ] },
    { ver: "v0.9.0", date: "上线新版", items: [
      { n: "发布笔记" }, { n: "导出图片" }, { n: "名单与快照" }, { n: "图例直切" },
      { n: "连线规则" }, { n: "布局拖拽" }, { n: "帮助与关于" },
    ] },
  ];
  // 渲染更新日志：最近 ABOUT_LOG_OPEN 个版本展开 + 完整说明；其余收起 + 只留功能名
  function renderAboutLog() {
    return ABOUT_LOG.map(function (v, i) {
      const full = i < ABOUT_LOG_OPEN;
      const fx = (v.fixes || []).map(function (t) { return "<li>➖ 修复了" + t + "</li>"; }).join("");
      const body = full
        ? '<ul class="about-list">' + v.items.map(function (it) {
            return "<li>➕ <b>" + it.n + "</b>：" + it.h + "</li>";
          }).join("") + fx + "</ul>"
        : '<div class="log-brief">' + v.items.map(function (it) { return it.n; }).join(" · ") + "</div>"
          + (fx ? '<ul class="about-list">' + fx + "</ul>" : "");
      return '<details class="log-block"' + (full ? " open" : "") + ">"
        + '<summary class="log-ver">' + v.ver + " · " + v.date + "</summary>" + body + "</details>";
    }).join("");
  }

  // 关于页（P12 · 全屏信息卡）：版本号跟随当前上线包 = v0.13.0；容器版纯本地静态内容、无外链；
  // 网页分流版会在末尾追加开源仓库入口（App.renderAboutExtra；容器版不加载该覆盖层 → 钩子返回空）
  App.aboutModal = function () {
    App.openModal(`<div class="about-page">
        <div class="about-logo"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"></circle>
          <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"></circle>
          <circle cx="32" cy="32" r="8" fill="currentColor"></circle>
          <line x1="12" y1="12" x2="24" y2="24" stroke="currentColor" stroke-width="2"></line>
          <line x1="52" y1="12" x2="40" y2="24" stroke="currentColor" stroke-width="2"></line>
          <line x1="12" y1="52" x2="24" y2="40" stroke="currentColor" stroke-width="2"></line>
          <line x1="52" y1="52" x2="40" y2="40" stroke="currentColor" stroke-width="2"></line>
          <text x="32" y="37" font-size="11" text-anchor="middle" fill="currentColor" font-weight="bold">CP</text>
        </svg></div>
        <div class="about-name">CP Chart <em>v0.13.0</em></div>
        <div class="about-sub">画人物关系连线的小工具 · 小红书离线版</div>
        <div class="about-date">更新于 2026-09-09</div>

        <div class="about-sec">📌 更新日志</div>
        ${renderAboutLog()}

        <div class="about-sec">🔮 未来前瞻</div>
        <ul class="about-list">
          <li>视图记忆：导出或切 Tab 后保留当前缩放与平移位置</li>
          <li>UI 布局重构：界面结构整体重排，操作更顺手</li>
          <li>手感升级：触控与交互细节打磨（触点放大、反馈更跟手）</li>
          <li class="ellipsis">更多功能期待反馈</li>
        </ul>

        <div class="about-sec">👤 制作</div>
        <ul class="about-list credit">
          <li>小红书号：6357261896</li>
          <li>小红书小工具@CP-Chart</li>
          <li>基于 vibecoding 构建</li>
        </ul>

        ${App.renderAboutExtra ? App.renderAboutExtra() : ""}

        <div class="about-btn"><button class="btn primary" data-cmd="m-close">知道了</button></div>
      </div>`, true);
  };

  // 导出文本弹窗（E-2 模式）
  // opts = { extraBtns:"", okText:"导入" }（批量编辑名单用到：附加「复制全部」+ 主钮改「保存」）
  App.textModal = function (title, hint, text, importMode, onImport, opts) {
    const o = opts || {};
    const ta = `<textarea class="export-txt" id="txtArea" ${importMode ? "" : "readonly"}>${App.esc(text)}</textarea>`;
    const btns = importMode
      ? `<button class="btn" data-cmd="m-close">取消</button>${o.extraBtns || ""}<button class="btn primary" data-cmd="txt-import">${o.okText || "导入"}</button>`
      : `<button class="btn" data-cmd="txt-select">重新全选</button><button class="btn primary" data-cmd="m-close">关闭</button>`;
    App.openModal(`${modalHead(title)}<div class="hint">${hint}</div>${ta}
      <div class="modal-btns">${btns}</div>`);
    modalCloseCb = null;
    App._txtImport = function (v) { App.closeModal(); if (onImport) onImport(v); };
    const area = $("txtArea");
    if (!importMode) {
      setTimeout(() => {
        try { area.focus(); area.select(); area.setSelectionRange(0, area.value.length); } catch (e) {}
      }, 60);
    }
  };

  // =============== 事件绑定 ===============
  function bindEvents() {
    // Tab
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.addEventListener("click", () => App.switchTab(b.getAttribute("data-tab")));
    });

    // 画布内图例：点任意图例项 = 应用对应笔刷
    $("legendChip").addEventListener("click", (e) => {
      const lg = e.target.closest(".lg[data-layer]");
      if (!lg) return;
      App.applyLegendBrush(lg.getAttribute("data-layer"), lg.getAttribute("data-key"));
    });

    // 撤销 / 重做 / 标题 / 菜单
    // 撤销/重做已移入径向主菜单（#radialMenu .radial-btn[data-act=undo/redo]）
    // 定位坐标：圆心归位到画面正中 + 自动缩放全览
    const rcBtn = $("btnRecenter");
    if (rcBtn) rcBtn.addEventListener("click", () => App.recenter());
    // 面板三态把手（折叠/半开/全开）：单击循环 + 拖动跟手
    //   - 单击（移动 < 8px）：按 collapsed → half → full → collapsed 循环
    //   - 拖动（移动 ≥ 8px）：面板高度实时跟手；松手吸附到最近档位
    const head = $("panelHead");
    if (head) {
      // 三态档位（占视口比例，留出 panelHead 26 + tabs 49 高度）
      const STOPS = [
        { m: "collapsed", r: 0 },
        { m: "half",      r: 0.4 },
        { m: "full",      r: 0.92 },
      ];
      const ratioToMode = (r) => {
        let best = STOPS[0], bd = Math.abs(r - STOPS[0].r);
        for (let i = 1; i < STOPS.length; i++) {
          const d = Math.abs(r - STOPS[i].r);
          if (d < bd) { bd = d; best = STOPS[i]; }
        }
        return best.m;
      };
      const currentRatio = () => {
        const p = $("panel");
        if (!p) return 0;
        return p.getBoundingClientRect().height / (window.innerHeight || 800);
      };
      const setLiveHeight = (ratio) => {
        const p = $("panel"); if (!p) return;
        p.classList.add("dragging");
        p.style.maxHeight = (ratio * 100).toFixed(1) + "vh";
        head.classList.add("dragging");
      };
      let active = false, moved = false, startY = 0, startRatio = 0, pid = -1;
      head.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        active = true; moved = false;
        startY = e.clientY; startRatio = currentRatio(); pid = e.pointerId;
        try { head.setPointerCapture(pid); } catch (err) {}
      });
      head.addEventListener("pointermove", (e) => {
        if (!active) return;
        const dy = e.clientY - startY;
        if (!moved && Math.abs(dy) < 8) return; // 8px 阈值，避免误触切档
        moved = true;
        const vh = window.innerHeight || 800;
        // 向上拖 dy<0 高度增大，向下拖 dy>0 高度减小
        const newRatio = Math.max(0, Math.min(0.98, startRatio + (-dy) / vh));
        setLiveHeight(newRatio);
      });
      const endDrag = () => {
        if (!active) return;
        active = false;
        if (!moved) {
          // 单击：循环切档
          const seq = ["collapsed", "half", "full"];
          const i = seq.indexOf(App.panelMode);
          App.setPanelMode(seq[(i + 1) % seq.length]);
        } else {
          // 拖动结束：吸附到最近档位
          const ratio = currentRatio();
          App.setPanelMode(ratioToMode(ratio));
        }
        try { head.releasePointerCapture(pid); } catch (err) {}
      };
      head.addEventListener("pointerup", endDrag);
      head.addEventListener("pointercancel", endDrag);
      // 键盘可访问性：Space / Enter 循环切档
      head.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          const seq = ["collapsed", "half", "full"];
          const i = seq.indexOf(App.panelMode);
          App.setPanelMode(seq[(i + 1) % seq.length]);
        }
      });
    }
    // 全开态左上角「返回画板」钮（与帮助钮同槽位，见 index.html #topbar 注释）
    const homeBtn = $("homeBtn");
    if (homeBtn) homeBtn.addEventListener("click", () => App.setPanelFull(false));
    // 顶栏帮助钮（常态槽位；面板全开时 CSS 切换为返回画板，见 app.css .top-slot-btn）
    const helpBtn = $("btnHelp");
    if (helpBtn) helpBtn.addEventListener("click", () => App.helpModal());
    // 顶栏标题可点：点击「图名 / 填表人 的 图名」弹改名窗（标题区非容器两角，点击合规）
    const titleBox = $("titleBox");
    if (titleBox) titleBox.addEventListener("click", () => App.openTitleModal());
    // 径向主菜单（撤销/重做/导入/保存/关于，围绕 + 号绽开）
    const btnMenuEl = $("btnMenu");
    if (btnMenuEl) btnMenuEl.addEventListener("click", toggleRadial);
    const radialMaskEl = $("radialMask");
    if (radialMaskEl) radialMaskEl.addEventListener("click", closeRadial);
    document.querySelectorAll("#radialMenu .radial-btn").forEach((b) => {
      b.addEventListener("click", () => onRadialAct(b.getAttribute("data-act")));
    });
    // 二级菜单窗口（导入 / 保存，按钮带文字）
    const subMaskEl = $("subMenuMask");
    if (subMaskEl) subMaskEl.addEventListener("click", closeSubMenu);
    $("fullExit").addEventListener("click", () => {
      App.fullUI = false;
      document.body.classList.remove("hideui");
      $("fullExit").classList.add("hidden");
      renderPanel();
    });
    $("modalMask").addEventListener("click", () => App.closeModal());

    // 弹窗按钮委托
    $("modalBox").addEventListener("click", (e) => {
      const ok = e.target.closest('[data-cmd="m-ok"]');
      if (ok) { const cb = App._okCb; App._okCb = null; App.closeModal(); if (cb) cb(); return; }
      const ok2 = e.target.closest('[data-cmd="m-ok2"]');
      if (ok2) {
        const v = ($("promptVal") || {}).value;
        const cb = App._okCb; App._okCb = null; App.closeModal(); if (cb) cb(v);
        return;
      }
      // 标题/填表人双输入
      const titleOk = e.target.closest('[data-cmd="title-ok"]');
      if (titleOk) {
        const t1 = ($("promptTitle") || {}).value;
        const f1 = ($("promptFiller") || {}).value;
        App.closeModal();
        App.act(() => {
          // 标题上限 18 字、填表人 12 字（与弹窗 maxlength 一致，兜底存量超限数据）
          App.state.title = Array.from(String(t1 == null ? "" : t1).trim()).slice(0, 18).join("") || "未命名关系图";
          App.state.meta.filler = Array.from(String(f1 == null ? "" : f1).trim()).slice(0, 12).join("");
        });
        const cb = App._titleOkCb; App._titleOkCb = null; if (cb) cb();
        return;
      }
      // 保存相册重试（导出失败/被拒后预览面板内）
      const saveRetry = e.target.closest('[data-cmd="save-retry"]');
      if (saveRetry) {
        const url = App._retrySaveUrl;
        if (!url) { App.toast("没有可保存的图片", true); return; }
        App.saveImage(url).then((r2) => {
          if (r2 && r2.ok) {
            App.closeModal();
            App._retrySaveUrl = null;
            App.toast("已保存到相册");
          } else {
            App.toast("保存未成功，请重试或长按图片另存", true);
          }
        });
        return;
      }
      // 结果屏：发布小红书（publishNote 内部自生成图并唤起发布页）
      const pub = e.target.closest('[data-cmd="publish"]');
      if (pub) { App.closeModal(); App.publishNote(); return; }
      // 结果屏：建立新画布
      const nc = e.target.closest('[data-cmd="new-canvas"]');
      if (nc) { App.newDoc(); App.closeModal(); App.render(); return; }
      if (e.target.closest('[data-cmd="m-close"]')) { App.closeModal(); return; }
      // 统一编辑器：切 Tab / 切导出导入（切换前先把当前输入存进内存）
      const edTab = e.target.closest('[data-cmd="ed-tab"]');
      if (edTab) {
        const a0 = $("txtArea");
        if (a0 && App._ed) App._ed.buf[App._ed.tab] = a0.value;
        App._ed.tab = edTab.getAttribute("data-tab");
        renderEditor();
        return;
      }
      const edMode = e.target.closest('[data-cmd="ed-mode"]');
      if (edMode) {
        const a1 = $("txtArea");
        if (a1 && App._ed) App._ed.buf[App._ed.tab] = a1.value;
        App._ed.dataMode = edMode.getAttribute("data-mode");
        delete App._ed.buf[App._ed.tab];
        renderEditor();
        return;
      }
      const sel = e.target.closest('[data-cmd="txt-select"]');
      if (sel) {
        const a = $("txtArea");
        try { a.focus(); a.select(); a.setSelectionRange(0, a.value.length); } catch (err) {}
        return;
      }
      const imp = e.target.closest('[data-cmd="txt-import"]');
      if (imp) {
        const cb = App._txtImport;
        const val = ($("txtArea") || {}).value || "";
        // 是否关闭由回调决定：返回 false（或抛错）= 应用失败，保留弹窗与已输入的文字
        if (cb) { try { cb(val); } catch (err) { App.toast(err.message || "导入失败", true); } }
        else App.closeModal();
      }
      // 编辑器标题旁的「写法说明」
      const edHelp = e.target.closest('[data-cmd="ed-help"]');
      if (edHelp) {
        const a2 = $("txtArea");
        if (a2 && App._ed) App._ed.buf[App._ed.tab] = a2.value;
        App._ed.helpOpen = !App._ed.helpOpen;
        renderEditor();
        return;
      }
      // 连线编辑弹窗内的操作（以「同一对角色」为单位）
      const leThick = e.target.closest('[data-cmd="link-edit-thick"]');
      if (leThick) { setLinkLayer(leThick.getAttribute("data-id"), "bottom", leThick.getAttribute("data-val")); return; }
      const leThin = e.target.closest('[data-cmd="link-edit-thin"]');
      if (leThin) { setLinkLayer(leThin.getAttribute("data-id"), "top", leThin.getAttribute("data-val")); return; }
      const leType = e.target.closest('[data-cmd="link-edit-type"]');
      if (leType) {
        const lid = leType.getAttribute("data-id");
        // 箭头优先落在细线（顶层）上，没有细线时才挂粗线
        const t = pairTarget(lid);
        if (t) App.setLinkArrow(t.id, leType.getAttribute("data-val"));
        App.openLinkEdit(lid); // 刷新弹窗高亮
        return;
      }
      const leFlip = e.target.closest('[data-cmd="link-edit-flip"]');
      if (leFlip) {
        const lid = leFlip.getAttribute("data-id");
        const k = App.getLink(lid);
        if (k) {
          eachPair(k, (x) => { const t = x.src; x.src = x.dst; x.dst = t; });
          App.render();
          if (App.renderPanel) App.renderPanel();
        }
        App.openLinkEdit(lid);
        return;
      }
      const leDel = e.target.closest('[data-cmd="link-edit-del"]');
      if (leDel) {
        const lid = leDel.getAttribute("data-id");
        const kd = App.getLink(lid);
        // 一对角色可能同时有粗线与细线，删就一起删，不留半条
        App.act(() => {
          (kd ? pairOf(kd) : []).forEach((x) => App.removeLink(x.id));
          if (!kd) App.removeLink(lid);
        });
        App.closeModal(); App.renderPanel();
        return;
      }
    });

    // 面板委托 click
    const panel = $("panel");
    panel.addEventListener("click", (e) => {
      const cmdEl = e.target.closest("[data-cmd]");
      if (!cmdEl) return;
      const cmd = cmdEl.getAttribute("data-cmd");
      onCmd(cmd, cmdEl);
    });
    // 面板 input/change（颜色、名称、半径等）
    panel.addEventListener("input", (e) => onInput(e));
    panel.addEventListener("change", (e) => onInput(e));
    // 可拖动输入（scrubber）：在数值输入框上按住左右拖动即可调数（半径/槽位等）
    document.addEventListener("pointerdown", function (e) {
      const el = e.target.closest && e.target.closest('input.inp[type=number][data-set]');
      if (!el || e.button !== 0) return;
      const startX = e.clientX;
      const startVal = parseFloat(el.value) || 0;
      const min = el.min !== "" ? parseFloat(el.min) : -Infinity;
      const max = el.max !== "" ? parseFloat(el.max) : Infinity;
      const step = parseFloat(el.step) || 1;
      let dragging = false;
      const move = function (ev) {
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) < 8) return;
        if (!dragging) {
          dragging = true;
          try { el.setPointerCapture(ev.pointerId); } catch (_) {}
          el.style.userSelect = "none";
          el.style.cursor = "ew-resize";
        }
        let v = startVal + dx * step;
        v = Math.max(min, Math.min(max, v));
        v = Math.round(v / step) * step;
        if (String(v) !== el.value) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      const up = function (ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (dragging) {
          el.style.userSelect = "";
          el.style.cursor = "";
          el.dispatchEvent(new Event("change", { bubbles: true }));
          ev.preventDefault();
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    // 焦点记录历史
    panel.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-row-edit]");
      if (el) App.commitHist(); // 为行编辑记录一次
      const pn = e.target.closest("[data-cmd=pm-rename],[data-cmd=pm-like]");
      if (pn) App.commitHist();
      const ring = e.target.closest("[data-set=rad]");
      if (ring) App.commitHist();
      const slot = e.target.closest("[data-set=slots]");
      if (slot) App.commitHist();
      const arrowNm = e.target.closest('[data-set="arrowName"]');
      if (arrowNm) App.commitHist();
    });
    panel.addEventListener("focusout", (e) => {
      const el = e.target.closest("[data-row-edit]");
      if (el) { App.notifyChanged(); }
    });
    document.addEventListener("click", (e) => {
      // nodeOps 内
      const c = e.target.closest("#nodeOps [data-cmd]");
      if (c) { onCmd(c.getAttribute("data-cmd"), c); }
      const opsClose = e.target.closest("#opsClose");
      if (opsClose) { App.selCharId = null; App.notifyChanged(); }
      // 人物/布局点击行选择（非输入区）
      const row = e.target.closest(".prow[data-pid]");
      if (row && !e.target.closest("input") && !e.target.closest("select")) {
        App.selCharId = row.getAttribute("data-pid");
        if (App.activeTab === "layout") { App.notifyChanged(); }
        else { App.render(); }
      }
    });

    // 头像文件选择：原生 <input>，仅相册取向——绝不设置 capture 属性，避免强制调用摄像头权限
    const fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.accept = "image/*";
    fileInp.style.display = "none";
    document.body.appendChild(fileInp);
    fileInp.addEventListener("change", () => onAvatarFilePicked(fileInp));
    App._avatarInput = fileInp;

    // 头像选择入口：默认走原生 <input>（无 capture，不调摄像头）。
    // 彻底"仅相册、屏蔽系统拍照入口"需容器相册选图 API（限定 sourceType:['album']）。
    // 小红书 miniTool 当前仅暴露 postNote/saveImageToPhotosAlbum/writeTempFile，无选图 API，故暂用原生 input。
    // 接入时实现 App.avatarPicker(id) → Promise<dataURL> 钩子即可，无需改动调用点。
    App.avatarPicker = null;
    App.pickAvatar = function (id) {
      pendingAvatarFor = id;
      if (typeof App.avatarPicker === "function") {
        App.avatarPicker(id).then((du) => applyAvatar(id, du)).catch(() => App._avatarInput.click());
      } else {
        App._avatarInput.click();
      }
    };
    function onAvatarFilePicked(inputEl) {
      const f = inputEl.files && inputEl.files[0];
      inputEl.value = "";
      const id = pendingAvatarFor; pendingAvatarFor = null;
      if (!f || !id) return;
      App.resizeAvatar(f).then((du) => applyAvatar(id, du)).catch((e) => App.toast(e.message || "头像处理失败", true));
    }
    function applyAvatar(id, dataUrl) {
      if (!id || !dataUrl) return;
      App.act(() => {
        const c = App.state.chars.find((x) => x.id === id);
        if (c) { c.avatar = dataUrl; App.AVATAR_CACHE[c.name] = dataUrl; }
      });
      App.toast("头像已设置");
    }

    bindFloatDrag();
  }

  function onCmd(cmd, el) {
    const st = App.state;
    switch (cmd) {
      // ---------- 样式 ----------
      case "ui-night": {
        const want = el.getAttribute("data-val") === "night";
        if (!!st.ui.night !== want) {
          App.act(() => { st.ui.night = want; });
          App.applyNight();
        }
        break;
      }
      case "thin-dash": {
        App.act(() => { st.ui.thinDash = !st.ui.thinDash; });
        App.render(); App.notifyChanged();
        break;
      }
      case "tbl-add": {
        const layer = el.getAttribute("data-layer");
        App.act(() => App.addTableRow(layer, { name: layer === "arrow" ? "新箭头" : "新关系", type: layer === "arrow" ? "one" : undefined }));
        App.toast("已添加");
        break;
      }
      case "tbl-del": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key");
        App.confirm("删除该表项？引用它的连线/喜好度会被清除。", "删除", () => {
          App.act(() => App.delTableRow(layer, key));
          if (App.brush.bottom === key) App.brush.bottom = null;
          if (App.brush.top === key) App.brush.top = null;
          App.toast("已删除");
        });
        break;
      }
      case "pal": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key"), col = el.getAttribute("data-c");
        App.act(() => App.recolorTableRow(layer, key, col));
        break;
      }
      case "tbl-hide": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key");
        const hidden = App.act(() => App.toggleTableHidden(layer, key));
        App.toast(hidden ? "已隐藏：不进图例与导出图" : "已恢复显示");
        break;
      }
      // ---------- 人物 ----------
      case "pm-batch": App.editorModal({ tab: "people" }); break;
      case "pm-import": openImportNames(); break;
      case "pm-export": openExportNames(); break;
      case "pm-mode": {
        App.act(() => { st.ui.avatarMode = el.getAttribute("data-val"); });
        break;
      }
      case "pm-names": {
        App.act(() => { st.ui.showNames = !st.ui.showNames; });
        break;
      }
      case "pm-avatar": {
        App.pickAvatar(el.getAttribute("data-id"));
        break;
      }
      case "pm-center": {
        const id = el.getAttribute("data-id");
        const c = App.state.chars.find((x) => x.id === id);
        if (c && c.ring === 0) {
          App.act(() => App.moveCharToRing(id, 1));
          App.toast("已取消圆心");
        } else {
          App.act(() => App.moveCharToRing(id, 0));
          App.toast("已设为圆心");
        }
        break;
      }
      case "pm-del": {
        const id = el.getAttribute("data-id");
        App.confirm("删除该角色及其连线？", "删除", () => {
          App.act(() => App.removeChar(id));
        });
        break;
      }
      // ---------- 连线 ----------
      case "br-b": { App.brush.bottom = App.brush.bottom === el.getAttribute("data-key") ? null : el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "br-t": { App.brush.top = App.brush.top === el.getAttribute("data-key") ? null : el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "br-a": { App.brush.arrow = el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "lnk-batch": App.editorModal({ tab: "link" }); break;
      case "paint-set": {
        // 三选一模式：link=连线 / char=角色 / erase=删线（互斥，单源 App.paintMode）
        App.setPaintMode(el.getAttribute("data-mode"));
        break;
      }
      case "lnk-clear": {
        App.confirm("清空所有连线？", "清空", () => App.act(() => { App.state.links = []; }));
        break;
      }
      case "link-del": {
        const id = el.getAttribute("data-id");
        App.act(() => App.removeLink(id));
        break;
      }
      case "link-edit": {
        App.openLinkEdit(el.getAttribute("data-id"));
        break;
      }
      case "filter-link": {
        App.selCharId = el.getAttribute("data-id");
        renderPanel(); App.render();
        break;
      }
      // ---------- 布局 ----------
      case "ly-even": App.act(() => App.evenAll()); App.toast("已平均排布"); break;
      case "ly-addring": {
        App.act(() => {
          App.state.rings.push({
            rad: (App.state.rings[App.state.rings.length - 1] || { rad: 150 }).rad + 120,
            slots: App.state.ui.slotMode ? App.SLOT_MIN : null,
          });
        });
        break;
      }
      case "ly-slots": {
        App.act(() => {
          st.ui.slotMode = !st.ui.slotMode;
          if (st.ui.slotMode) {
            st.rings.forEach((r, i) => {
              const n = App.charsOnRing(i + 1).length;
              r.slots = Math.max(r.slots || 0, App.SLOT_MIN, n);
            });
            App.evenAll();
          }
        });
        break;
      }
      case "ly-delring": {
        const ringNo = parseInt(el.getAttribute("data-ring"), 10);
        const n = App.charsOnRing(ringNo).length;
        const doDel = () => {
          try {
            App.act(() => App.deleteRing(ringNo));
            App.toast(`已删除圈 ${ringNo}`);
          } catch (err) { App.toast(err.message || "删除失败", true); }
        };
        if (ringNo <= 1) { App.toast("第 1 圈不可删除", true); break; }
        if (n > 0) {
          App.confirm(`圈 ${ringNo} 上还有 ${n} 位角色，删除后将移入最近的轨道（尽量保持原位，重叠则自动均分）。`, "移到最近轨道", doDel);
        } else {
          doDel();
        }
        break;
      }
      // nodeOps
      case "ops-del": {
        const c = App.state.chars.find((x) => x.id === App.selCharId);
        if (c) App.act(() => App.removeChar(c.id));
        break;
      }
      case "ops-center": {
        const c = App.state.chars.find((x) => x.id === App.selCharId);
        if (c && c.ring === 0) {
          App.act(() => App.moveCharToRing(c.id, 1));
          App.toast("已取消圆心");
        } else if (c) {
          App.act(() => App.moveCharToRing(c.id, 0));
          App.toast("已设为圆心");
        }
        break;
      }
      case "ops-close": { App.selCharId = null; App.notifyChanged(); break; }
      // ---------- 抓手 ----------
      case "hd-hide": {
        App.fullUI = !App.fullUI;
        document.body.classList.toggle("hideui", App.fullUI);
        $("fullExit").classList.toggle("hidden", !App.fullUI);
        renderPanel();
        break;
      }
      case "hd-save": exportImageFlow(); break;
    }
  }

  // 角色圆圈过大提示：任一圈上相邻角色的弧长间距放不下两个圆时提醒（不阻止）
  function warnNodeOverlap(R) {
    const st = App.state;
    const maxRing = Math.max(0, ...st.chars.map((c) => c.ring));
    for (let r = 1; r <= maxRing; r++) {
      const list = App.charsOnRing(r);
      if (list.length < 2) continue;
      const rad = Math.max(40, App.radiusFor(r) || 150);
      const need = (2 * R + 8) / rad;
      const angs = list.map((c) => App.normAngle(c.angle == null ? -Math.PI / 2 : c.angle)).sort((a, b) => a - b);
      for (let i = 0; i < angs.length; i++) {
        const j = (i + 1) % angs.length;
        let d = Math.abs(angs[j] - angs[i]);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < need) { App.toast("圆圈偏大，部分角色可能挤在一起，可调小或点「平均排布」", true); return; }
      }
    }
  }

  function onInput(e) {
    const t = e.target;
    const st = App.state;
    const rowEdit = t.closest("[data-row-edit]");
    if (rowEdit) {
      const layer = rowEdit.getAttribute("data-layer"), key = rowEdit.getAttribute("data-key");
      const kind = rowEdit.getAttribute("data-row-edit");
      if (kind === "name") App.renameTableRow(layer, key, t.value);
      else if (kind === "color") App.recolorTableRow(layer, key, t.value);
      App.render();
      if (e.type === "change") { App.notifyChanged(); }
      return;
    }
    const bg = t.closest('[data-set="bg"]');
    if (bg) {
      App.state.bg = t.value;
      if (!App.state.ui.night) document.body.style.setProperty("--bg", t.value); // 夜间时外壳保持深色，不跟随
      App.render();
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const arrowInp = t.closest('[data-set="arrowName"]');
    if (arrowInp) {
      if (!App.state.meta) App.state.meta = {};
      App.state.meta.arrowName = t.value;
      App.render(); // 图例实时更新箭头标注名
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const nrInp = t.closest('[data-set="nodeR"]');
    if (nrInp) {
      let v = parseInt(t.value, 10);
      if (!v || v < App.NODE_R_MIN) v = App.NODE_R;
      if (v > App.NODE_R_MAX) v = App.NODE_R_MAX;
      if (nodeRBefore == null) { nodeRBefore = st.ui.nodeR; App.commitHist(); } // 一次拖动只记一条 undo
      st.ui.nodeR = v;
      const nv = $("nodeRVal"); if (nv) nv.textContent = String(v);
      App.render();
      if (e.type === "change") { nodeRBefore = null; App.notifyChanged(); warnNodeOverlap(v); }
      return;
    }
    const radInp = t.closest('[data-set="rad"]');
    if (radInp) {
      const ring = parseInt(radInp.getAttribute("data-ring"), 10);
      const v = parseInt(t.value, 10);
      if (v > 20) { App.state.rings[ring - 1].rad = v; App.render(); }
      return;
    }
    const thinWInp = t.closest('[data-set="thinW"]');
    if (thinWInp) {
      let v = parseFloat(t.value);
      if (!v || v < 1) v = 1; if (v > 6) v = 6;
      if (nodeRBefore == null) { App.commitHist(); }
      App.state.ui.thinW = v;
      const tv = document.querySelector(".thinW-val"); if (tv) tv.textContent = String(v);
      App.render();
      if (e.type === "change") { App.notifyChanged(); }
      return;
    }
    const slotInp = t.closest('[data-set="slots"]');
    if (slotInp) {
      const ring = parseInt(slotInp.getAttribute("data-ring"), 10);
      const n = App.charsOnRing(ring).length;
      let v = parseInt(t.value, 10);
      if (!v || v < n) v = n;
      App.state.rings[ring - 1].slots = v;
      App.distributeRing(ring, { slots: v });
      App.render();
      return;
    }
    // 人物行 rename/like（change）
    const rename = t.closest("[data-cmd=pm-rename]");
    if (rename && e.type === "change") {
      const id = rename.getAttribute("data-id");
      const c = App.state.chars.find((x) => x.id === id);
      if (c) {
        const old = c.name;
        c.name = t.value.trim() || old;
        if (App.AVATAR_CACHE[old] && !App.AVATAR_CACHE[c.name]) App.AVATAR_CACHE[c.name] = App.AVATAR_CACHE[old];
        App.notifyChanged();
      }
      return;
    }
    const like = t.closest("[data-cmd=pm-like]");
    if (like) {
      const id = like.getAttribute("data-id");
      const c = App.state.chars.find((x) => x.id === id);
      if (c) { c.like = t.value || null; App.render(); }
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const zoom = t.closest("#zoomRange");
    if (zoom) {
      App.view.s = parseInt(zoom.value, 10) / 100;
      const zl = $("zoomLabel"); if (zl) zl.textContent = parseInt(zoom.value, 10) + "%";
      const zv = $("zoomVal"); if (zv) zv.textContent = parseInt(zoom.value, 10) + "%";
      App.render();
    }
  }

  // opsRingSel change（布局操作条移圈）
  function bindRingSel() {
    $("opsRingSel").addEventListener("change", (e) => {
      const id = App.selCharId;
      const ring = parseInt(e.target.value, 10);
      if (id != null) App.act(() => App.moveCharToRing(id, ring, true));
      App.notifyChanged();
    });
  }

  // opsSlotSel change（布局操作条：把选中角色移到指定空闲槽）
  function bindSlotSel() {
    $("opsSlotSel").addEventListener("change", (e) => {
      const id = App.selCharId;
      const c = App.state.chars.find((x) => x.id === id);
      if (!c || c.ring <= 0) return;
      const slotIdx = parseInt(e.target.value, 10);
      if (slotIdx < 0) return;
      const sl = Math.max(1, App.state.rings[c.ring - 1].slots || 1);
      App.act(() => {
        c.slot = slotIdx;
        c.angle = -Math.PI / 2 + (slotIdx * 2 * Math.PI) / sl;
      });
      App.toast(`已移到 圈${c.ring} 槽${slotIdx + 1}`);
    });
  }

  function onMenu(menu) {
    switch (menu) {
      case "help": App.helpModal(); break;
      case "rename": App.openTitleModal(); break;
      case "new": {
        App.confirm("新建将清空当前人物/连线/布局（三张表与背景保留）。", "新建", () => {
          App.newDoc();
          App.setTitleText();
          App.toast("已新建");
          openImportNames(true);
        });
        break;
      }
      case "publish": App.publishNote(); break;
      case "img": exportImageFlow(); break;
      case "expnames": openExportNames(); break;
      case "impnames": openImportNames(false); break;
      case "expsnap": App.editorModal({ tab: "data", dataMode: "export" }); break;
      case "impsnap": App.editorModal({ tab: "data", dataMode: "import" }); break;
      case "edpeople": App.editorModal({ tab: "people" }); break;
      case "edlink": App.editorModal({ tab: "link" }); break;
      case "about": App.aboutModal(); break;
    }
  }

  // ===== 径向主菜单 + 二级窗口 =====
  const SUBMENU = {
    import: { title: "导入", items: [
      { menu: "impnames", label: "导入人物名单" },
      { menu: "edpeople", label: "编辑人物名单" },
      { menu: "impsnap",  label: "导入完整数据" },
      { menu: "edlink",   label: "编辑 / 导入导出连线" },
      { menu: "rename",   label: "改图名 / 填表人" },
      { menu: "new",      label: "建立新连线图" },
    ]},
    save: { title: "保存 / 导出", items: [
      { menu: "publish",  label: "发布笔记" },
      { menu: "img",      label: "导出为图片" },
      { menu: "expnames", label: "导出人物名单" },
      { menu: "expsnap",  label: "导出完整数据" },
    ]},
  };

  function toggleRadial() {
    const rm = $("radialMenu");
    if (!rm) return;
    if (rm.classList.contains("hidden")) openRadial(); else closeRadial();
  }
  function openRadial() {
    const rm = $("radialMenu"), fab = $("btnMenu");
    if (!rm || !fab) return;
    const r = fab.getBoundingClientRect();
    rm.style.left = (r.left + r.width / 2) + "px";
    rm.style.top = (r.top + r.height / 2) + "px";
    rm.classList.remove("hidden");
    fab.classList.add("open");
    refreshRadial();
  }
  function closeRadial() {
    const rm = $("radialMenu"), fab = $("btnMenu");
    if (rm) rm.classList.add("hidden");
    if (fab) fab.classList.remove("open");
  }
  function refreshRadial() {
    const u = document.querySelector('#radialMenu [data-act="undo"]');
    const r = document.querySelector('#radialMenu [data-act="redo"]');
    if (u) u.disabled = !App.canUndo();
    if (r) r.disabled = !App.canRedo();
  }
  function onRadialAct(act) {
    closeRadial();
    if (act === "undo") App.undo();
    else if (act === "redo") App.redo();
    else if (act === "about") App.aboutModal();
    else if (act === "import") openSubMenu("import");
    else if (act === "save") openSubMenu("save");
  }
  function openSubMenu(kind) {
    const root = $("subMenuRoot");
    if (!root) return;
    const cfg = SUBMENU[kind];
    if (!cfg) return;
    $("subMenuTitle").textContent = cfg.title;
    $("subMenuList").innerHTML = cfg.items.map((it) =>
      `<button class="sub-item" data-menu="${it.menu}">${it.label}</button>`).join("");
    root.classList.remove("hidden");
    root.querySelectorAll(".sub-item").forEach((it) => {
      it.addEventListener("click", () => { closeSubMenu(); onMenu(it.getAttribute("data-menu")); });
    });
  }
  function closeSubMenu() {
    const root = $("subMenuRoot");
    if (root) root.classList.add("hidden");
  }

  // ---- 统一编辑器（v1.0 #7）：人物 / 连线 / 完整数据 三 Tab，共用现有弹窗形态 ----
  var ED_TABS = [["people", "人物"], ["link", "连线"], ["data", "完整数据"]];
  var ED_PH = {
    people: "0：我\n1：甲，乙，丙\n2：丁，戊",
    link: "本命：甲，乙；路好：丙；\n甲—本命+爱情—乙；",
  };
  function edConf(tab) {
    if (tab === "people") {
      return {
        title: "编辑名单",
        hint: "按圈录入，圈号加名字，用「，」分隔。分号与换行等效。",
        ph: ED_PH.people,
        help: "写法：<br><code>0：我</code>（0 或 圆心 = 中心的人）<br><code>1：甲，乙，丙</code>（第 1 圈）<br><code>2：丁，戊</code>（第 2 圈）<br>分号「；」等同于换行，一行写完也可以。<br>改名 / 删人 / 加人，直接改文字后点「保存」。",
        text: function () { return App.exportNameListText(); },
        okText: "保存",
        apply: function (v) { App.importNameList(v); App.toast("名单已更新"); },
      };
    }
    if (tab === "link") {
      return {
        title: "编辑连线",
        hint: "写喜好度（谁是本命）或两条人之间的连线。分号与换行等效。",
        ph: ED_PH.link,
        help: "喜好度：<code>本命：甲，乙；路好：丙；</code><br>连线：<code>甲—本命+爱情—乙；</code><br>方向：<code>—</code> 无箭头、<code>-&gt;</code> 单箭头、<code>&lt;-&gt;</code> 双箭头。<br><code>+</code> 用来同时给一条线加粗线与细线。<br>分号「；」等同于换行。<br>不认识的人名会提示，不会擅自新建。",
        text: function () { return App.exportLinkText(); },
        okText: "应用",
        apply: function (v) {
          const r = App.importLinkText(v);
          if (r.errs && r.errs.length) { App.toast(r.errs.join("；"), true); return false; }
          App.toast("已更新 " + r.added + " 条");
        },
      };
    }
    if (App._ed.dataMode === "import") {
      return {
        title: "导入完整数据",
        hint: "粘贴整份数据串（新版压缩串、旧版 JSON 都认）。",
        ph: "在这里粘贴数据串",
        help: "把别人给你的整串数据粘进来，点「上传」。<br>新版以 <code>XHS2:</code> 开头，旧版是 JSON，两种都能读。<br>导入会覆盖当前画板全部内容。",
        text: function () { return ""; },
        okText: "上传",
        apply: function (v) {
          let obj = null;
          try { obj = App.parseDataImport(v); }
          catch (err) { App.toast(err.message || "数据读不出来", true); return false; }
          App.confirm("导入会覆盖当前画板全部数据（人物、连线、布局、图例）。确认？", "确认", function () {
            try {
              if (obj && obj.type === "NRD") { App._importLegacy(obj); App.toast("完整数据已导入"); return; }
              App.deserialize(JSON.stringify(obj));
              App.toast("完整数据已导入");
            } catch (err2) { App.toast("导入失败：" + (err2.message || ""), true); }
          });
        },
      };
    }
    return {
      title: "导出完整数据",
      hint: "已全选，长按或点「复制全部」。不含头像。",
      help: "这串文字包含人物、连线、布局、图例的完整信息。<br>复制后发给别人，对方在「导入完整数据」粘贴即可还原。<br>不含头像图片。",
      text: function () { return App.exportFullData(); },
      readonly: true,
    };
  }
  function renderEditor() {
    const ed = App._ed, c = edConf(ed.tab);
    if (ed.buf[ed.tab] == null) ed.buf[ed.tab] = c.text ? c.text() : "";
    const val = ed.buf[ed.tab];
    const ro = !!c.readonly;
    const tabs = ED_TABS.map(function (t) {
      return '<button class="ed-tab' + (ed.tab === t[0] ? " on" : "") + '" data-cmd="ed-tab" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    const sub = ed.tab === "data"
      ? '<div class="ed-sub">' + [["export", "导出"], ["import", "导入"]].map(function (m) {
          return '<button class="ed-tab sm' + (ed.dataMode === m[0] ? " on" : "") + '" data-cmd="ed-mode" data-mode="' + m[0] + '">' + m[1] + "</button>";
        }).join("") + "</div>"
      : "";
    const helpBtn = c.help
      ? '<button class="mh-q' + (ed.helpOpen ? " on" : "") + '" data-cmd="ed-help" title="写法说明" aria-label="写法说明">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>' +
        '<path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="12" cy="17.2" r="1.1" fill="currentColor"/></svg></button>'
      : "";
    const helpBox = c.help && ed.helpOpen ? '<div class="ed-help">' + c.help + "</div>" : "";
    const btns = ro
      ? '<button class="btn" data-cmd="txt-select">复制全部</button><button class="btn primary" data-cmd="m-close">关闭</button>'
      : '<button class="btn" data-cmd="m-close">取消</button><button class="btn" data-cmd="txt-select">复制全部</button><button class="btn primary" data-cmd="txt-import">' + (c.okText || "应用") + "</button>";
    App.openModal(
      '<div class="mh"><span>' + c.title + "</span>" + helpBtn + '<span class="x" data-cmd="m-close">' + ICONS.close + '</span></div>' +
      '<div class="ed-tabs">' + tabs + "</div>" + sub +
      '<div class="hint">' + c.hint + "</div>" + helpBox +
      '<textarea class="export-txt tall" id="txtArea" placeholder="' + App.esc(c.ph || "") + '"' + (ro ? " readonly" : "") + ">" + App.esc(val) + "</textarea>" +
      '<div class="modal-btns">' + btns + "</div>", true);
    modalCloseCb = null;
    // 返回 false = 应用失败：保留弹窗与已输入的文字，让用户就地改
    App._txtImport = function (v) {
      ed.buf[ed.tab] = v;
      let ok = true;
      if (c.apply) {
        try { ok = c.apply(v) !== false; }
        catch (err) { ok = false; App.toast(err.message || "应用失败", true); }
      }
      if (ok) { App._txtImport = null; App.closeModal(); }
      else { renderEditor(); } // 重绘，把刚输入的内容留在框里
      App.render();
    };
    if (ro) {
      setTimeout(function () {
        try { const a = $("txtArea"); a.focus(); a.select(); a.setSelectionRange(0, a.value.length); } catch (e) {}
      }, 60);
    }
  }
  // opts = { tab:'people'|'link'|'data', dataMode:'export'|'import' }
  App.editorModal = function (opts) {
    const o = opts || {};
    App._ed = App._ed || { tab: "people", dataMode: "export", buf: {}, helpOpen: false };
    if (o.tab) App._ed.tab = o.tab;
    if (o.dataMode) App._ed.dataMode = o.dataMode;
    App._ed.helpOpen = false; // 每次打开默认收起说明
    delete App._ed.buf[App._ed.tab]; // 从入口重开 → 重新拉最新内容
    renderEditor();
  };

  // 打开名单导入弹窗
  function openImportNames(isNew) {
    const pre = isNew ? App.PRESET_TEXT : "";
    App.textModal(ICONS.dlIn + " 导入人物名单",
      "每圈一行：圈号加名字（用 ，或空格分隔）。示例：<br><code>圆心: 我<br>1: 甲，乙，丙<br>2: 丁，戊</code><br>直接粘贴你的名单并点“导入”。",
      pre, true, (txt) => { App.importNameList(txt); });
  }
  function openExportNames() {
    App.textModal(ICONS.dlOut + " 导出人物名单",
      "已全选，请复制。改动后可直接“导入名单”贴回。",
      App.exportNameListText(), false);
  }
  function openImportSnapshot() {
    App.textModal(ICONS.pkg + " 导入快照",
      "粘贴快照 JSON（含布局/三表/连线/背景）。旧版 NRD JSON 也可尝试导入。",
      "", true, (txt) => {
        try {
          const obj = JSON.parse(txt);
          if (obj && obj.type === "NRD") { App._importLegacy(obj); return; }
          App.deserialize(txt);
          App.notifyChanged();
          App.setTitleText();
          if (App.fitContent) App.fitContent();
          App.toast("快照已导入（头像未包含，需重新设置头像）");
        } catch (err) { App.toast("导入失败：" + err.message, true); }
      });
  }
  // 旧版 NRD 最小兼容
  App._importLegacy = function (obj) {
    App.newDoc();
    App.act(() => {
      const main = (obj.centers || []).find((c) => c.isMain) || (obj.centers || [])[0];
      if (main && Array.isArray(main.ringRadii) && main.ringRadii.length) {
        App.state.rings = main.ringRadii.map((rad) => ({ rad: Number(rad) || 150, slots: null }));
      }
      const map = { "red": "b1", "orange": "b2", "yellow": "b3", "black": "b4" };
      const tmap = { "pink": "t1", "green": "t2", "purple": "t4" };
      (obj.nodes || []).forEach((n) => {
        App.addChar(n.name || "?", parseInt(n.ring, 10) || 1);
      });
      const cid = {};
      (obj.nodes || []).forEach((n, i) => { cid[n.id] = App.state.chars[i]; });
      // 圆心=主圆心角色
      if (main && main.nodeId && cid[main.nodeId]) {
        const c = cid[main.nodeId];
        App.moveCharToRing(c.id, 0);
      }
      (obj.links || []).forEach((k) => {
        const s = cid[k.source], d = cid[k.target];
        if (!s || !d) return;
        if (k.bottom && map[k.bottom]) App.addLink(s.id, d.id, "bottom", map[k.bottom], k.oneway ? "one" : "none");
        if (k.top && tmap[k.top]) App.addLink(s.id, d.id, "top", tmap[k.top], k.oneway ? "one" : "none");
      });
    });
    App.setTitleText();
    if (App.fitContent) App.fitContent();
    App.toast("旧版 NRD 已导入（多圆心部分被忽略）");
  };

  // 导出图片流程（E-1 + 容器保存）：
  // 容器环境 = 官方 API（writeTempFile{data} → saveImageToPhotosAlbum），失败 → 全屏预览 + 重试保存按钮；
  // 网页环境 = 无容器 API：若页面末尾挂了网页 IO 覆盖层（仅网页分流版挂载）则直接触发浏览器保存并提示，
  //            否则预览大图，由浏览器原生「长按/右键另存」承接（容器禁用能力不写入容器交付代码）。
  // 导出图片结果屏（v1.0 #10）：生成后展示成品图 + 极简提示 + 发布/新画布/保存/关闭
  async function exportImageFlow() {
    if (!App.state.chars.length) { App.toast("画布为空，先导入人物", true); return; }
    // 图名还是默认的「未命名关系图」→ 先弹改图名窗（与菜单「改图名 / 填表人」同一接口），确认后继续导出
    if (!App.state.title || App.state.title === "未命名关系图") {
      App.openTitleModal(() => { doExportImage(); });
      return;
    }
    doExportImage();
  }
  async function doExportImage() {
    App.toast("正在生成图片…");
    let dataUrl;
    try { dataUrl = await App.exportPNG(2); }
    catch (err) { App.toast("导出失败：" + err.message, true); return; }
    App._retrySaveUrl = dataUrl;
    const hasSaveApi = !!(window.xhs && window.xhs.miniTool
      && typeof window.xhs.miniTool.saveImageToPhotosAlbum === "function");
    let saved = false;
    try { const r = await App.saveImage(dataUrl); saved = !!(r && r.ok); }
    catch (e) { saved = false; }
    showResultScreen(dataUrl, saved, hasSaveApi);
  }

  // 结果屏：成品图 + 一行提示 + 操作钮（发布/新画布/保存/关闭）；关闭钮放底部避开顶部禁触碰区
  function showResultScreen(dataUrl, saved, hasSaveApi) {
    const note = saved ? "已保存到相册"
      : (hasSaveApi ? "若未自动保存，点下方「保存相册」重试" : "长按图片，或右键 → 图片另存为");
    const saveBtn = saved ? "" : '<button class="btn" data-cmd="save-retry">保存相册</button>';
    App.openModal(
      '<div class="mh"><span>生成完成</span></div>' +
      '<div class="rs-img"><img src="' + dataUrl + '" alt="关系图"></div>' +
      '<div class="hint rs-note">' + note + '</div>' +
      '<div class="modal-btns rs-btns">' +
        '<button class="btn" data-cmd="m-close">关闭</button>' +
        '<button class="btn" data-cmd="new-canvas">建立新画布</button>' +
        '<button class="btn primary" data-cmd="publish">发布小红书</button>' +
        saveBtn +
      '</div>', true);
    modalCloseCb = null;
  }

  // =============== 右侧悬浮工具组拖拽 ===============
  // 拖动超过 8px 视为移动（吸附到最近竖边）；未移动的松手保持按钮点击，移动后的同源 click 在捕获阶段吞掉
  function bindFloatDrag() {
    const box = $("floatTools");
    if (!box) return;
    let sx = 0, sy = 0, ox = 0, oy = 0, active = false, moved = false, suppress = false;
    box.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      active = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      const r = box.getBoundingClientRect();
      ox = r.left; oy = r.top;
    });
    window.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (moved) {
        box.classList.add("dragging");
        box.style.left = Math.max(0, ox + dx) + "px";
        box.style.top = Math.max(0, oy + dy) + "px";
        box.style.right = "auto";
      }
    });
    function stopDrag() {
      if (!active) return;
      active = false;
      if (moved) { snapFloat(box); suppress = true; }
      box.classList.remove("dragging");
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    box.addEventListener("click", (e) => {
      if (suppress) { suppress = false; e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }
  function snapFloat(box) {
    const stage = box.parentElement;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    if (sRect.width < 10) return; // 布局未就绪
    const bRect = box.getBoundingClientRect();
    const GAP = 6;
    const stickRight = (bRect.left + bRect.width / 2) > (sRect.left + sRect.width / 2);
    const left = stickRight ? sRect.width - bRect.width - GAP : GAP;
    let top = bRect.top - sRect.top;
    top = Math.max(48, Math.min(top, Math.max(48, sRect.height - bRect.height - 16)));
    box.style.left = left + "px";
    box.style.top = top + "px";
    box.style.right = "auto";
  }

  // 通知回调
  function refreshAll() {
    App.render();
    renderPanel();
    App.setTitleText();
    const zl = $("zoomLabel");
    if (zl) zl.textContent = Math.round(App.view.s * 100) + "%";
    const rUndo = document.querySelector('#radialMenu [data-act="undo"]');
    const rRedo = document.querySelector('#radialMenu [data-act="redo"]');
    if (rUndo) rUndo.disabled = !App.canUndo();
    if (rRedo) rRedo.disabled = !App.canRedo();
    if (App.activeTab === "layout") updateNodeOps();
    // 自动保存草稿
    if (App.scheduleSave) App.scheduleSave();
  }

  App.notifyChangedFn = refreshAll;
  App.renderPanel = renderPanel;

  // 欢迎（开局引导）
  App.welcome = function (force) {
    const raw = localStorage.getItem(App.DRAFT_KEY);
    let hasDraft = false;
    try { const d = JSON.parse(raw); hasDraft = !!(d && d.chars && d.chars.length); } catch (e) {}
    if (hasDraft && !force) return; // 已有草稿直接继续
    const preset = App.PRESET_TEXT;
    App.openModal(modalHead("欢迎 · 人物关系连线图") +
      '<div class="hint">三步走完即可开工：一填图名（顶栏显示用），二填表人（导出署名，可留空），三粘角色名单（一行一圈：<code>圆心: 我</code>、<code>1: 甲，乙，丙</code>）。不想手敲直接点「载入示例」。</div>' +
      '<div style="font-size:12px;color:var(--sub);margin:8px 0 4px">图名</div>' +
      '<input type="text" id="welTitle" class="inp" style="width:100%" maxlength="18" placeholder="未命名关系图">' +
      '<div style="font-size:12px;color:var(--sub);margin:12px 0 4px">填表人（可选）</div>' +
      '<input type="text" id="welFiller" class="inp" style="width:100%" maxlength="12" placeholder="未填写则不显示“填表：”">' +
      '<div style="font-size:12px;color:var(--sub);margin:12px 0 4px;display:flex;justify-content:space-between;align-items:center">' +
        '<span>角色名单</span>' +
        '<button class="mini" data-cmd="wel-load" title="把示例名单塞进上面文本框">载入示例</button>' +
      '</div>' +
      '<textarea class="export-txt" id="welTxt" style="min-height:120px" placeholder="圆心: 我&#10;1: 甲，乙，丙&#10;2: 丁，戊，己"></textarea>' +
      '<div class="modal-btns">' +
      '<button class="btn" data-cmd="m-close">跳过</button>' +
      '<button class="btn primary" data-cmd="wel-ok">开始编辑</button>' +
      '</div>');
    modalCloseCb = null;
    const box = $("modalBox");
    const loadBtn = box.querySelector('[data-cmd="wel-load"]');
    const okBtn = box.querySelector('[data-cmd="wel-ok"]');
    if (loadBtn) loadBtn.addEventListener("click", () => {
      const ta = $("welTxt"); if (ta) ta.value = App.PRESET_TEXT;
      App.toast("已载入示例名单");
    });
    if (okBtn) okBtn.addEventListener("click", () => {
      const t1 = ($("welTitle") || {}).value || "";
      const f1 = ($("welFiller") || {}).value || "";
      const txt = ($("welTxt") || {}).value || "";
      App.closeModal();
      App.act(() => {
        // 图名/填表人：18/12 字截断，与改名弹窗共用规则
        App.state.title = (t1 || "").trim().slice(0, 18) || "未命名关系图";
        App.state.meta.filler = (f1 || "").trim().slice(0, 12);
        App.setTitleText();
      });
      try { if (txt.trim()) App.importNameList(txt); } catch (err) { App.toast(err.message || "导入失败", true); }
      if (App.onChanged) App.onChanged();
      App.switchTab("link");
    });
  };

  // 初始化
  App.uiInit = function () {
    bindEvents();
    bindRingSel();
    bindSlotSel();
    App.setPanelMode(App.panelMode); // 同步把手 data-state 与 body class
    App.onChanged = refreshAll;    // 初始 tab
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tab") === App.activeTab);
    });
  };
})();
