/* ui.js —— 面板渲染、Tab、菜单、弹窗、Toast */
(function () {
  const App = (window.App = window.App || {});

  App.activeTab = "link";
  App.fullUI = false;
  App.panelCollapsed = false; // 底部二级面板折叠态
  let modalCloseCb = null;
  let pendingAvatarFor = null;
  let lastColorFocus = null;

  const $ = App.byId;

  // =============== Tab 切换 ===============
  App.setPanelCollapsed = function (v) {
    App.panelCollapsed = !!v;
    document.body.classList.toggle("panel-collapsed", App.panelCollapsed);
    const b = $("btnPanelFold");
    if (b) b.textContent = App.panelCollapsed ? "︿ 展开" : "﹀ 收起";
  };
  App.switchTab = function (tab) {
    App.activeTab = tab;
    App.pendingLinkDel = null; // 切 Tab 清除删线待确认态
    if (App.panelCollapsed) App.setPanelCollapsed(false); // 切 Tab 视为要操作面板 → 自动展开
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
          ${r.key === "none" ? "" : `<span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">🗑</span>`}
        </div>`;
      }
      return `<div class="trow">
        <span class="sw" style="background:${r.color};border-color:rgba(0,0,0,.2)"></span>
        <input type="color" value="${r.color}" data-row-edit="color" data-layer="${layer}" data-key="${r.key}">
        <span class="tname"><input type="text" data-row-edit="name" data-layer="${layer}" data-key="${r.key}"
          value="${App.esc(r.name)}" placeholder="名称"></span>
        <span class="pal">${PALETTE.map((c) => `<i data-cmd="pal" data-layer="${layer}" data-key="${r.key}" data-c="${c}" style="background:${c}"></i>`).join("")}</span>
        <span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">🗑</span>
      </div>`;
    }).join("");
  }

  const PALETTE = ["#d32f2f", "#f57c00", "#fbc02d", "#43a047", "#1976d2", "#8e24aa", "#ec407a", "#00897b", "#5e35b1", "#222222", "#888888", "#1c1c1e"];

  function panelStyle() {
    const arrowName = (App.state.meta && App.state.meta.arrowName) ? String(App.state.meta.arrowName) : "情感指向";
    return `<div class="pg">
      <div class="pg-t">◯ 底层色（喜好等级 · 粗线）<button class="mini" data-cmd="tbl-add" data-layer="bottom">＋添加</button></div>
      <div>${tableRows("bottom", false)}</div>
      <div class="pg-t">● 顶层色（关系类型 · 细线+白描边）<button class="mini" data-cmd="tbl-add" data-layer="top">＋添加</button></div>
      <div>${tableRows("top", false)}</div>
      <div class="pg-t">➡ 箭头含义</div>
      <div class="trow"><span class="lg-ic" style="font-style:normal;padding:0 2px">➡</span>
        <span class="tname"><input type="text" data-set="arrowName" value="${App.esc(arrowName)}" placeholder="情感指向"></span>
      </div>
      <div class="hint">箭头在图例/导出图里的标注名（如：情感指向、单恋、攻受…）。箭头类型固定为 无箭头/单箭头/双箭头，在「连线」面板选择。</div>
      <div class="ctrl-row">背景色：<input type="color" data-set="bg" value="${App.state.bg}"></div>
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
        <span class="mini" style="color:#888;font-size:11px">${ringTxt}</span>
        <select data-cmd="pm-like" data-id="${c.id}">${likeOpts}</select>
        <button class="mini" data-cmd="pm-center" data-id="${c.id}" title="${c.ring === 0 ? "取消圆心" : "设为圆心"}"><img class="pm-star" src="assets/icons/${c.ring === 0 ? "star-fill" : "star-line"}.svg" alt=""></button>
        <button class="mini danger" data-cmd="pm-del" data-id="${c.id}" title="删除">🗑</button>
      </div>`;
    }).join("");

    return `<div class="pg">
      <div class="ctrl-row" style="flex-wrap:wrap">
        <button class="btn" data-cmd="pm-import">📥 导入名单</button>
        <button class="btn" data-cmd="pm-export">📤 导出名单</button>
      </div>
      <div class="ctrl-row" style="flex-wrap:wrap">
        <span>头像显示：</span>
        <button class="chip ${st.ui.avatarMode === "avatar" ? "on" : ""}" data-cmd="pm-mode" data-val="avatar">👤 头像</button>
        <button class="chip ${st.ui.avatarMode === "like" ? "on" : ""}" data-cmd="pm-mode" data-val="like">💗 喜好度</button>
        <button class="chip ${st.ui.avatarMode === "both" ? "on" : ""}" data-cmd="pm-mode" data-val="both">😎 兼容</button>
      </div>
      <div class="ctrl-row">
        <span>显示名字：</span>
        <button class="chip ${st.ui.showNames ? "on" : ""}" data-cmd="pm-names">${st.ui.showNames ? "开" : "关"}</button>
      </div>
      <div class="pg-t">角色列表（${st.chars.length}）· 点📷行上传头像</div>
      ${rows || '<div class="hint">暂无角色，先“导入名单”或去 ☰ 菜单导入</div>'}
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
        <span class="dl-main" data-cmd="filter-link" data-id="${k.src}">${dot}<span>${aName} ${ar && ar.type === "one" ? "➜" : ar && ar.type === "both" ? "⇄" : "—"} ${bName}</span></span>
        <button class="mini danger" data-cmd="link-del" data-id="${k.id}">🗑</button>
      </div>`;
    }).join("");
  }

  function panelLink() {
    const c = brushChips();
    return `<div class="pg">
      <div class="pg-t">🖌 底层粗线笔刷</div>
      <div class="chips">${c.bottom || '<span class="hint">暂无底层色，去 🎨样式 添加</span>'}</div>
      <div class="pg-t">✒ 顶层细线笔刷</div>
      <div class="chips">${c.top || '<span class="hint">暂无顶层色，去 🎨样式 添加</span>'}</div>
      <div class="pg-t">↔️ 箭头</div>
      <div class="chips">${c.arrow}</div>
      <div class="ctrl-row">
        <button class="btn ${App.eraser ? "danger" : ""}" data-cmd="lnk-eraser">🪌 ${App.eraser ? "退出删线" : "删线模式"}</button>
        <button class="btn" data-cmd="lnk-clear">🗑 清空全部连线</button>
      </div>
      <div class="pg-t">🕘 连线记录${App.selCharId ? "（已按人物筛选）" : "（点画布人物可筛选）"}</div>
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
        ? ` 槽位<input type="number" class="inp" style="width:56px" data-set="slots" data-ring="${ringNo}" value="${r.slots || n}" min="${Math.max(1, n)}">`
        : "";
      // 第 1 圈不可删，不提供删除入口
      const delPart = ringNo > 1
        ? `<button class="mini danger" data-cmd="ly-delring" data-ring="${ringNo}" title="删除该轨道">🗑</button>`
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
        <button class="chip ${st.ui.slotMode ? "on" : ""}" data-cmd="ly-slots">槽位 ${st.ui.slotMode ? "开" : "关"}</button>
      </div>
      <div class="hint">拖拽角色=换圈/沿圈移动；拖动圈顶蓝点=改半径；点角色出现操作条。</div>
      <div class="pg-t">圈的半径与槽位</div>
      ${ringRows()}
    </div>`;
  }

  // ---------- 抓手 ----------
  function panelHand() {
    const z = Math.round(App.view.s * 100);
    return `<div class="pg">
      <div class="ctrl-row" style="justify-content:space-between">
        <button class="btn" data-cmd="hd-hide">🔲 ${App.fullUI ? "退出全屏" : "隐藏UI全屏"}</button>
        <button class="btn primary" data-cmd="hd-save">💾 保存图片</button>
      </div>
      <div class="ctrl-row">缩放
        <input type="range" id="zoomRange" min="30" max="260" value="${z}" style="flex:1">
        <span id="zoomVal" style="width:44px;text-align:right">${z}%</span>
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
    // ⑦ 圆心星标两态：实心=已是圆心（再点取消），空心=可设为圆心
    const isC = c.ring === 0;
    $("opsCenter").innerHTML = `<img class="pm-star" src="assets/icons/${isC ? "star-fill" : "star-line"}.svg" alt="">${isC ? "取消圆心" : "设为圆心"}`;
    box.classList.remove("hidden");
  }

  // =============== 菜单 / 弹窗 ===============
  // 改名弹窗（原顶栏标题点击 → 现经菜单「改图名 / 填表人」进入）
  App.openTitleModal = function () {
    App.openModal(`${modalHead("修改图名 / 填表人")}
      <div class="hint">图名用于导出图与发布笔记；填表人会写入导出图署名。设置后顶栏显示为：填表人 的 图名。</div>
      <div style="font-size:12px;color:var(--sub);margin:2px 0 4px">图名</div>
      <input type="text" id="promptTitle" class="inp" style="width:100%" value="${App.esc(App.state.title)}">
      <div style="font-size:12px;color:var(--sub);margin:12px 0 4px">填表人（可选）</div>
      <input type="text" id="promptFiller" class="inp" style="width:100%" value="${App.esc(App.getFiller())}" placeholder="未填写则不显示“填表：”">
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
  // 图例点击 → 应用对应笔刷（不 commitHist，切换行为与 §十二 P5 一致）
  App.applyLegendBrush = function (layer, key) {
    if (layer === "bottom") App.brush.bottom = key;
    else if (layer === "top") App.brush.top = key;
    else if (layer === "arrow") App.brush.arrow = key;
    if (App.activeTab !== "link") {
      App.eraser = false;
      App.linkSource = null;
      App.selCharId = null;
      App.dragGhost = null;
      App.switchTab("link");
      return;
    }
    if (App.eraser) {
      App.eraser = false;
      App.linkSource = null;
      App.dragGhost = null;
    }
    if (App.renderPanel) App.renderPanel();
    App.render();
  };
  function modalHead(title) {
    return `<div class="mh">${title}<span class="x" data-cmd="m-close">✕</span></div>`;
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
    App.openModal(`${modalHead("❓ CP Chart 使用指南")}
      <div class="help-card">
        <div class="help-intro">一个专门用来画角色关系连线图的小工具。所有数据只保存在本机，不会上传。</div>

        <div class="help-h">三步上手</div>
        <div class="help-step"><b>第一步 · 导入人物</b>：点击底部「👤 人物」→「📥 导入名单」，按圈编辑，每圈一行：<br>
          <code>1: 甲，乙，丙</code><br><code>2: 丁，戊，己，庚</code><br>
          支持中英文逗号、空格、制表符分隔。<code>圆心: 某人</code> 或 <code>0: 某人</code> 可设置圆心，直接以 <code>1:</code> 开头则可留空圆心。</div>
        <div class="help-step"><b>第二步 · 画连线</b>：点击底部「💑 连线」，先选三样：<br>
          ◯ 粗线 = 喜好度（本命 / 很喜欢 / 路好 / 不吃）<br>
          ● 细线 = 关系类型（爱情 / 友情 / 亲情 / QPR）<br>
          ➜ 箭头 = 方向（无 / 单箭头 / 双箭头）<br>
          然后从角色圆上按住，拖到另一个角色上松手即成线。同一对后画的会覆盖先画的。A→B 与 B→A 的单箭头可同时存在，配不同关系色。</div>
        <div class="help-step"><b>第三步 · 导出</b>：点画布右侧悬浮 ☰ 菜单 → 导出图片（存相册）/ 导出名单（复制文本）/ 导出完整快照（备份）/ 发布笔记（唤起发布页）。</div>

        <div class="help-h">各 Tab 是干嘛的</div>
        <div class="help-tab"><b>🎨 样式</b>：改颜色、改图例名、显示/隐藏类型、调背景色</div>
        <div class="help-tab"><b>👤 人物</b>：导入/编辑名单、设头像、调喜好度、设圆心</div>
        <div class="help-tab"><b>💑 连线</b>：选笔刷、画线/删线、批量清理、连线记录</div>
        <div class="help-tab"><b>🌐 布局</b>：拖角色换圈、调半径、加/删轨道、平均排布</div>
        <div class="help-tab"><b>👋 抓手</b>：纯浏览、隐藏 UI 截图、保存图片</div>

        <div class="help-h">常用操作小贴士</div>
        <div class="help-tip">
          • <b>拖角色换圈</b>：布局模式按住角色，拖到目标圈附近松手<br>
          • <b>调圈半径</b>：拖圈顶 12 点方向的蓝色小圆点，或在布局面板输入数值<br>
          • <b>删线</b>：连线 →「🪌 删线模式」，点哪条删哪条<br>
          • <b>撤销/重做</b>：画布右侧悬浮 ↩︎ / ↪︎ 可回退几乎所有操作<br>
          • <b>改图名 / 填表人</b>：☰ 菜单 → 工具 → 改图名 / 填表人<br>
          • <b>缩放/平移</b>：双指缩放，单指拖空白区域平移<br>
          • <b>图例直切</b>：点画布左上角图例色块可直接切换对应笔刷</div>

        <div class="help-h">关于数据安全</div>
        <div class="help-tip">
          • 数据只存在手机本地草稿，不上传、不外泄<br>
          • 编辑会自动保存草稿；需长期保存请用「导出完整快照」，把文本发给需要的设备后「导入快照」恢复<br>
          • 快照不含头像，导入后头像需重新设置</div>

        <div class="help-end">还有问题？「☰ 菜单 → 关于」可查看版本与作者信息。祝您吃好喝好！✨</div>
      </div>
      <div class="modal-btns"><button class="btn primary" data-cmd="m-close">知道了</button></div>`);
  };

  // 关于页（P12 · 全屏信息卡）：版本号跟随当前上线包 = v0.10.2；不含任何站外链接/仓库地址
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
        <div class="about-name">CP Chart <em>v0.10.2</em></div>
        <div class="about-sub">人物关系连线图 · 小红书小工具版</div>
        <div class="about-date">更新于 2026-09-08</div>

        <div class="about-sec">📌 更新日志</div>
        <div class="log-ver">v0.10.0 · 2026-09-07</div>
        <ul class="about-list">
          <li>+ 适配小红书容器：顶栏按钮全部移入画布悬浮工具条（撤销 / 重做 / 菜单），避开顶部官方按钮区</li>
          <li>+ 菜单改为底部弹出；面板可折叠，画布一键全览</li>
          <li>+ 图例排版：喜好粗线 / 关系细线 / 箭头含义 分行展示</li>
          <li>+ A→B 与 B→A 单箭头可共存，可分别配不同关系色</li>
          <li>+ 箭头含义可自定义（默认"情感指向"）</li>
          <li>+ 导入名单 / 快照后自动缩放居中，圆心居于画面中央</li>
          <li>+ 顶栏显示「填表人 的 图名」；圆心星标实心 / 空心两态</li>
        </ul>
        <div class="log-ver">v0.9.0 · 上线新版</div>
        <ul class="about-list">
          <li>+ 一键发布笔记：当前画作直接唤起小红书发布页</li>
          <li>+ 导出图片：标题 / 署名 / 图例 一图成画，一键存入相册</li>
          <li>+ 名单 / 快照导入导出，编辑自动存本地草稿</li>
          <li>+ 点图例色块直切对应笔刷</li>
          <li>+ 连线规则对齐：同一对后画覆盖、箭头方向可设</li>
          <li>+ 布局支持平均排布、增删轨道、拖拽换圈</li>
          <li>+ 全新帮助页与「关于」，菜单按功能分组</li>
        </ul>

        <div class="about-sec">🔮 未来前瞻</div>
        <ul class="about-list">
          <li>+ 夜间模式</li>
          <li>+ 槽位布局</li>
          <li class="ellipsis">+ 更多功能期待反馈</li>
        </ul>

        <div class="about-sec">👤 制作</div>
        <ul class="about-list credit">
          <li>小红书号：6357261896</li>
          <li>小红书小工具@CP-Chart</li>
          <li>基于 vibecoding 构建</li>
        </ul>

        <div class="about-btn"><button class="btn primary" data-cmd="m-close">知道了</button></div>
      </div>`, true);
  };

  // 导出文本弹窗（E-2 模式）
  App.textModal = function (title, hint, text, importMode, onImport) {
    const ta = `<textarea class="export-txt" id="txtArea" ${importMode ? "" : "readonly"}>${App.esc(text)}</textarea>`;
    const btns = importMode
      ? `<button class="btn" data-cmd="m-close">取消</button><button class="btn primary" data-cmd="txt-import">导入</button>`
      : `<button class="btn" data-cmd="txt-select">重新全选</button><button class="btn primary" data-cmd="m-close">关闭</button>`;
    App.openModal(`${modalHead(title)}<div class="hint">${hint}</div>${ta}
      <div class="modal-btns">${btns}</div>`);
    modalCloseCb = null;
    App._txtImport = onImport;
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
    $("btnUndo").addEventListener("click", () => App.undo());
    $("btnRedo").addEventListener("click", () => App.redo());
    // 面板折叠开关
    const foldBtn = $("btnPanelFold");
    if (foldBtn) {
      foldBtn.addEventListener("click", () => App.setPanelCollapsed(!App.panelCollapsed));
    }
    // 顶部只读标题不再可点；改名入口在菜单「改图名 / 填表人」
    $("btnMenu").addEventListener("click", () => $("menuRoot").classList.remove("hidden"));
    $("menuMask").addEventListener("click", () => $("menuRoot").classList.add("hidden"));
    $("fullExit").addEventListener("click", () => {
      App.fullUI = false;
      document.body.classList.remove("hideui");
      $("fullExit").classList.add("hidden");
      renderPanel();
    });
    document.querySelectorAll("#menuBox .menu-item").forEach((it) => {
      it.addEventListener("click", () => {
        $("menuRoot").classList.add("hidden");
        onMenu(it.getAttribute("data-menu"));
      });
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
          App.state.title = String(t1 == null ? "" : t1).trim() || "未命名关系图";
          App.state.meta.filler = String(f1 == null ? "" : f1).trim();
        });
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
            App.toast("已保存到相册 📸");
          } else {
            App.toast("保存未成功，请重试或长按图片另存", true);
          }
        });
        return;
      }
      if (e.target.closest('[data-cmd="m-close"]')) { App.closeModal(); return; }
      const sel = e.target.closest('[data-cmd="txt-select"]');
      if (sel) {
        const a = $("txtArea");
        try { a.focus(); a.select(); a.setSelectionRange(0, a.value.length); } catch (err) {}
        return;
      }
      const imp = e.target.closest('[data-cmd="txt-import"]');
      if (imp) {
        const cb = App._txtImport; App._txtImport = null;
        const val = ($("txtArea") || {}).value || "";
        App.closeModal();
        if (cb) { try { cb(val); } catch (err) { App.toast(err.message || "导入失败", true); } }
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

    // 头像文件选择
    const fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.accept = "image/*";
    fileInp.style.display = "none";
    document.body.appendChild(fileInp);
    fileInp.addEventListener("change", async () => {
      const f = fileInp.files && fileInp.files[0];
      fileInp.value = "";
      if (!f || !pendingAvatarFor) return;
      const id = pendingAvatarFor; pendingAvatarFor = null;
      try {
        const dataUrl = await App.resizeAvatar(f);
        App.act(() => {
          const c = App.state.chars.find((x) => x.id === id);
          if (c) { c.avatar = dataUrl; App.AVATAR_CACHE[c.name] = dataUrl; }
        });
        App.toast("头像已设置");
      } catch (err) { App.toast(err.message || "头像处理失败", true); }
    });
    App._avatarInput = fileInp;
    bindFloatDrag();
  }

  function onCmd(cmd, el) {
    const st = App.state;
    switch (cmd) {
      // ---------- 样式 ----------
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
      // ---------- 人物 ----------
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
        pendingAvatarFor = el.getAttribute("data-id");
        App._avatarInput.click();
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
      case "lnk-eraser": {
        App.eraser = !App.eraser;
        App.linkSource = null;
        App.dragGhost = null;
        App.pendingLinkDel = null; // 进出删线模式都清掉待确认态
        App.render(); renderPanel();
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
      case "filter-link": {
        App.selCharId = el.getAttribute("data-id");
        renderPanel(); App.render();
        break;
      }
      // ---------- 布局 ----------
      case "ly-even": App.act(() => App.evenAll()); App.toast("已平均排布"); break;
      case "ly-addring": {
        App.act(() => { App.state.rings.push({ rad: (App.state.rings[App.state.rings.length - 1] || { rad: 150 }).rad + 120, slots: null }); });
        break;
      }
      case "ly-slots": {
        App.act(() => {
          st.ui.slotMode = !st.ui.slotMode;
          if (st.ui.slotMode) {
            st.rings.forEach((r, i) => {
              const n = App.charsOnRing(i + 1).length;
              r.slots = r.slots || Math.max(n, 1);
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
      document.body.style.setProperty("--bg", t.value);
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
    const radInp = t.closest('[data-set="rad"]');
    if (radInp) {
      const ring = parseInt(radInp.getAttribute("data-ring"), 10);
      const v = parseInt(t.value, 10);
      if (v > 20) { App.state.rings[ring - 1].rad = v; App.render(); }
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

  function onMenu(menu) {
    switch (menu) {
      case "help": App.helpModal(); break;
      case "rename": App.openTitleModal(); break;
      case "new": {
        App.confirm("新建将清空当前人物/连线/布局（三张表与背景保留）。", "新建", () => {
          App.newDoc();
          $("titleBox").textContent = App.getTitleText();
          App.toast("已新建");
          openImportNames(true);
        });
        break;
      }
      case "publish": App.publishNote(); break;
      case "img": exportImageFlow(); break;
      case "expnames": openExportNames(); break;
      case "impnames": openImportNames(false); break;
      case "expsnap": {
        App.textModal("📦 导出 布局·人物·图例",
          "以下为完整快照（已全选）。长按文本框 →「复制」，或存到备忘录。不含头像。",
          App.serialize(), false);
        break;
      }
      case "impsnap": openImportSnapshot(); break;
      case "about": App.aboutModal(); break;
    }
  }

  // 打开名单导入弹窗
  function openImportNames(isNew) {
    const pre = isNew ? App.PRESET_TEXT : "";
    App.textModal("📥 导入人物名单",
      "每圈一行：圈号加名字（用 ，或空格分隔）。示例：<br><code>圆心: 我<br>1: 甲，乙，丙<br>2: 丁，戊</code><br>直接粘贴你的名单并点“导入”。",
      pre, true, (txt) => { App.importNameList(txt); });
  }
  function openExportNames() {
    App.textModal("📤 导出人物名单",
      "已全选，请复制。改动后可直接“导入名单”贴回。",
      App.exportNameListText(), false);
  }
  function openImportSnapshot() {
    App.textModal("📦 导入快照",
      "粘贴快照 JSON（含布局/三表/连线/背景）。旧版 NRD JSON 也可尝试导入。",
      "", true, (txt) => {
        try {
          const obj = JSON.parse(txt);
          if (obj && obj.type === "NRD") { App._importLegacy(obj); return; }
          App.deserialize(txt);
          App.notifyChanged();
          $("titleBox").textContent = App.getTitleText();
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
    $("titleBox").textContent = App.state.title;
    if (App.fitContent) App.fitContent();
    App.toast("旧版 NRD 已导入（多圆心部分被忽略）");
  };

  // 导出图片流程（E-1 + 容器保存）：
  // 容器环境 = 官方 API（writeTempFile{data} → saveImageToPhotosAlbum），失败 → 全屏预览 + 重试保存按钮；
  // 网页环境 = 无容器 API：若页面末尾挂了网页 IO 覆盖层（web 分流版的 js/iopc.js）则直接触发浏览器保存并提示，
  //            否则预览大图，由浏览器原生「长按/右键另存」承接（容器禁用能力不写入容器交付代码）。
  async function exportImageFlow() {
    if (!App.state.chars.length) { App.toast("画布为空，先导入人物", true); return; }
    App.toast("正在生成图片…");
    let dataUrl;
    try { dataUrl = await App.exportPNG(2); }
    catch (err) { App.toast("导出失败：" + err.message, true); return; }
    App._retrySaveUrl = dataUrl;
    const hasSaveApi = !!(window.xhs && window.xhs.miniTool
      && typeof window.xhs.miniTool.saveImageToPhotosAlbum === "function");
    if (hasSaveApi) {
      const res = await App.saveImage(dataUrl);
      if (res && res.ok) { App.toast("已保存到相册 📸"); return; }
      App.openModal(`${modalHead("🖼 成品图")}
        <div class="hint">图片已生成。点「保存相册」调起系统保存；若未成功可重试，或长按图片另存。</div>
        <img src="${dataUrl}" alt="关系图" style="width:100%;border-radius:10px;border:1px solid #eee">
        <div class="modal-btns">
          <button class="btn primary" data-cmd="save-retry">💾 保存相册</button>
          <button class="btn" data-cmd="m-close">完成</button>
        </div>`);
    } else {
      // 网页版：先试一次保存（web 覆盖层成功即返回；无覆盖层时容器版实现返回失败 → 走预览）
      const res2 = await App.saveImage(dataUrl);
      if (res2 && res2.ok) { App.toast("图片已保存"); return; }
      App.openModal(`${modalHead("🖼 成品图")}
        <div class="hint">图片已生成。请长按图片或鼠标右键 →「保存图片 / 图片另存为」保存到设备。</div>
        <img src="${dataUrl}" alt="关系图" style="width:100%;border-radius:10px;border:1px solid #eee">
        <div class="modal-btns"><button class="btn primary" data-cmd="m-close">完成</button></div>`);
    }
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
    const tb = $("titleBox");
    tb.textContent = App.getTitleText();
    const zl = $("zoomLabel");
    if (zl) zl.textContent = Math.round(App.view.s * 100) + "%";
    $("btnUndo").disabled = !App.canUndo();
    $("btnRedo").disabled = !App.canRedo();
    if (App.activeTab === "layout") updateNodeOps();
    // 自动保存草稿
    if (App.scheduleSave) App.scheduleSave();
  }

  App.notifyChangedFn = refreshAll;
  App.renderPanel = renderPanel;

  // 欢迎（开局引导）
  App.welcome = function (force) {
    const raw = localStorage.getItem(App.DRAFT_KEY);
    const hasDraft = raw && JSON.parse(raw).chars && JSON.parse(raw).chars.length;
    if (hasDraft && !force) return; // 已有草稿直接继续
    const preset = App.PRESET_TEXT;
    App.openModal(`${modalHead("欢迎 · 角色关系星图")}
      <div class="hint">粘贴角色名单开始。每圈一行：<br><code>圆心: 名字</code><br><code>1: 甲，乙，丙</code><br>也可以直接点下方示例按钮。</div>
      <textarea class="export-txt" id="welTxt">${App.esc(preset)}</textarea>
      <div class="modal-btns">
        <button class="btn" data-cmd="m-close">跳过</button>
        <button class="btn" data-cmd="wel-load">载入示例</button>
        <button class="btn primary" data-cmd="wel-ok">导入名单</button>
      </div>`);
    modalCloseCb = null;
    const box = $("modalBox");
    const loadBtn = box.querySelector('[data-cmd="wel-load"]');
    const okBtn = box.querySelector('[data-cmd="wel-ok"]');
    if (loadBtn) loadBtn.addEventListener("click", () => {
      App.closeModal();
      App.importNameList(App.PRESET_TEXT);
      if (App.onChanged) App.onChanged();
      App.switchTab("link");
    });
    if (okBtn) okBtn.addEventListener("click", () => {
      const val = ($("welTxt") || {}).value || "";
      App.closeModal();
      try { App.importNameList(val); } catch (err) { App.toast(err.message || "导入失败", true); }
      if (App.onChanged) App.onChanged();
      App.switchTab("link");
    });
  };

  // 初始化
  App.uiInit = function () {
    bindEvents();
    bindRingSel();
    App.setPanelCollapsed(App.panelCollapsed); // 同步折叠按钮初始文案
    App.onChanged = refreshAll;
    // 初始 tab
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tab") === App.activeTab);
    });
  };
})();
