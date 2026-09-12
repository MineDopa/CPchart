/* render.js —— SVG 画布渲染 */
(function () {
  const App = (window.App = window.App || {});
  const NS = "http://www.w3.org/2000/svg";

  let els = null;
  function ensureEls() {
    if (els) return els;
    els = {
      bg: App.byId("bg"),
      vp: App.byId("vp"),
      orbits: App.byId("orbitsG"),
      links: App.byId("linksG"),
      overlay: App.byId("overlayG"),
      nodes: App.byId("nodesG"),
      legend: App.byId("legendChip"),
      brush: App.byId("brushPreview"),
    };
    return els;
  }

  const S = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;

  // 画布显示主题：夜间模式只改 UI 外壳（CSS body.night），画板本身始终按用户设定的背景色 state.bg 渲染，
  // 配色固定用「日间」调色板（深字浅节点），让画板在任意模式下都清晰可读，且绝不被染黑。
  function canvasTheme() {
    return { bg: App.state.bg || "#ffffff", orbit: "#d5d5da", nodeFill: "#ffffff", innerFill: "#ffffff",
      likeEmpty: "#ececec", nameCol: "#26262a", linkEdge: "#ffffff" };
  }

  // 箭头几何常量（软编码：改这一处，画布三角 / 线端缩回 / 顶层缩放同步生效）
  const ARROW = {
    len: 18,        // 三角长（尖到底边）
    halfWid: 11,    // 三角底边半宽
    tipPad: 4,      // 尖与角色圆边的间距
    gap: 2,         // 线与箭头底边之间的微小留白（真箭头呼吸感，不断开）
    topScale: 0.75, // 顶层细线箭头缩放
  };
  App.ARROW = ARROW;

  // 真箭头：线在箭头底边外再退 gap，让三角与线断开留白（不再是"线穿三角"）
  // 返回连线两端的线坐标：有箭头的端按（圆边距 + 箭头长 + 留白）从角色圆心缩回
  function lineEnds(a, b, arrow, nodeR, scale) {
    const cut = nodeR + ARROW.tipPad + ARROW.len * scale + ARROW.gap;
    let c1 = 0, c2 = 0;
    if (arrow === "one") c2 = cut;
    else if (arrow === "both") { c1 = cut; c2 = cut; }
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return { x1: a.x + ux * c1, y1: a.y + uy * c1, x2: b.x - ux * c2, y2: b.y - uy * c2 };
  }

  // 路径筛选：把「连线所在层」写成 class（fl-1…fl-5，第 5 层起封顶 20%），
  // 透明度由 CSS 统一控制（不写内联 opacity，避免压掉悬停透视等其它 opacity 规则）。
  // 未筛选 → 返回空串；筛选但这条线不在链上 → 也返回空串（由 body.filter-on 兜底淡出）。
  function fmapCls(id) {
    const f = App._fmap;
    if (!f) return "";
    const lv = f.lv[id];
    return lv ? " fl-" + Math.min(5, lv) : "";
  }

  function buildArrowsLine(a, b, color, arrow, nodeR, extra, id) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let out = "";
    const scale = (extra && extra.scale) || 1;
    const back = ARROW.len * scale, wid = ARROW.halfWid * scale;
    // 底部对齐：大小三角共底（底边对齐在同一线上），小三角尖端按 len*(1-scale) 内收；
    // 两三角同轴居中（水平对称）。故尖端距目标圆边 = tipPad + len*(1-scale)，底边恒在 nodeR+tipPad+len。
    // id 透传：箭头上挂 data-link，使悬停高亮能一并选中有向箭头
    const tipR = nodeR + ARROW.tipPad + ARROW.len * (1 - scale);
    // 描边：顶层细线箭头与细线一样带白描边 —— 先铺一层同形白三角（fill + 外扩 stroke 合成白边），再叠彩色三角。
    // 白边外扩量 = 细线白底与彩线的半宽差（thinW-2.2)/2，由调用方按 edgeW = thinW-2.2 传入。
    const edge = extra && extra.edge, edgeW = (extra && extra.edgeW) || 0;
    const mkArrow = (tx, ty, dir) => {
      const ex = tx - back * ux * dir, ey = ty - back * uy * dir;
      const px = -uy * wid * dir, py = ux * wid * dir;
      const pts = `${S(tx, ty)} ${S(ex + px, ey + py)} ${S(ex - px, ey - py)}`;
      const fl = fmapCls(id); // 大/小三角都跟随所在连线的筛选层一起淡出
      const edgePoly = edge
        ? `<polygon class="ln-arrow-edge${fl}" data-link="${id}" points="${pts}" fill="${edge}" stroke="${edge}" stroke-width="${edgeW}" stroke-linejoin="round"></polygon>`
        : "";
      return edgePoly + `<polygon class="ln-arrow${fl}" data-link="${id}" points="${pts}" fill="${color}"></polygon>`;
    };
    if (arrow === "one") {
      const tx = b.x - ux * tipR, ty = b.y - uy * tipR;
      out += mkArrow(tx, ty, 1);
    } else if (arrow === "both") {
      let t1 = { x: b.x - ux * tipR, y: b.y - uy * tipR };
      let t2 = { x: a.x + ux * tipR, y: a.y + uy * tipR };
      out += mkArrow(t1.x, t1.y, 1) + mkArrow(t2.x, t2.y, -1);
    }
    return out;
  }

  // 连线集（bottom/top 同对均单条直线）
  function buildLinks() {
    const st = App.state;
    const th = canvasTheme();
    const colors = {
      bottom: (k) => App.colorOf("bottom", k),
      top: (k) => App.colorOf("top", k),
    };
    const byId = {};
    st.chars.forEach((c) => (byId[c.id] = c));

    // 隐藏的关系类型：其连线既不进图例（tables 层已过滤），也不进画布（此处整条跳过，含命中区）
    const hiddenKeys = {
      bottom: new Set((st.tables.bottom || []).filter((r) => r.hidden).map((r) => r.key)),
      top: new Set((st.tables.top || []).filter((r) => r.hidden).map((r) => r.key)),
    };
    // 角色→连线 端点映射（供悬停高亮用），只记录会真正渲染出来的连线
    App._linkEnds = {};

    // 底层粗线（同对单条）
    let html = "";
    const bottoms = st.links.filter((k) => k.layer === "bottom" && !hiddenKeys.bottom.has(k.ckey));
    bottoms.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      App._linkEnds[k.id] = [k.src, k.dst];
      const col = colors.bottom(k.ckey) || "#222";
      const pend = App.pendingLinkDel === k.id ? " pending-del" : "";
      const L = lineEnds(a, b, k.arrow, App.nodeR(), 1);
      html += `<line class="ln ln-bottom${pend}" data-link="${k.id}" x1="${L.x1}" y1="${L.y1}" x2="${L.x2}" y2="${L.y2}"
        stroke="${col}" stroke-width="12" stroke-linecap="round" opacity="0.88"></line>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.nodeR(), null, k.id);
    });

    // 顶层细线（白描边，同对单条直线，与 bottom 相同命中/箭头规则）
    const tops = st.links.filter((k) => k.layer === "top" && !hiddenKeys.top.has(k.ckey));
    tops.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      App._linkEnds[k.id] = [k.src, k.dst];
      const col = colors.top(k.ckey) || "#555";
      const pend = App.pendingLinkDel === k.id ? " pending-del" : "";
      // 顶层细线与底层粗线共端：用同一 cut（scale=1），保证白描边与粗线等长、箭头端不露粗线头。
      // 顶层小三角与底层大三角「底边对齐 + 同轴居中」，由 buildArrowsLine 按同一底边计算（小三角尖端内收）。
      // 顶层小三角同样带白描边（edge = 线白底色，edgeW = 白底与彩线宽度差），与线的白边视觉一致。
      const thinW = (st.ui && st.ui.thinW) ? st.ui.thinW : 6.5;
      const fl = fmapCls(k.id);
      const L = lineEnds(a, b, k.arrow, App.nodeR(), 1);
      html += `<line class="ln ln-top${pend}${fl}" data-link="${k.id}" x1="${L.x1}" y1="${L.y1}" x2="${L.x2}" y2="${L.y2}"
        stroke="${th.linkEdge}" stroke-width="${thinW}" stroke-linecap="round" opacity="0.95"></line>`;
      html += `<line class="ln ln-top-c${pend}${fl}" data-link="${k.id}" x1="${L.x1}" y1="${L.y1}" x2="${L.x2}" y2="${L.y2}"
        stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${(st.ui && st.ui.thinDash) ? "6 5" : "none"}"></line>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.nodeR(),
        { scale: ARROW.topScale, edge: th.linkEdge, edgeW: Math.max(2.5, thinW - 2.2) }, k.id);
    });

    // 命中区（触屏容易点）—— 隐藏类型的连线不渲染命中区，避免点到隐形线
    st.links.forEach((k) => {
      if (hiddenKeys[k.layer].has(k.ckey)) return;
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      html += `<line class="hit ln-hit" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="transparent" stroke-width="24"></line>`;
    });
    return html;
  }

  function avatarInner(c) {
    // 返回内圈内部 html（不带头像时依据模式填充）
    const mode = App.state.ui.avatarMode;
    const likeCol = c.like ? App.colorOf("bottom", c.like) : null;
    const th = canvasTheme();
    let html = "";
    const clipId = "cp" + c.id.replace(/[^a-zA-Z0-9]/g, "");
    const hasImg = !!c.avatar;
    // 内圈随节点半径等比缩放（基准 r=18 → 内圈 11 / 图像 10.4 / 喜好环 12.2 / 环宽 3.2）
    const k = App.nodeR() / App.NODE_R;
    const inR = (11 * k).toFixed(2);
    const imgR = (10.4 * k).toFixed(2);
    const imgW = (20.8 * k).toFixed(2);
    const ringR = (12.2 * k).toFixed(2);
    const ringW = (3.2 * k).toFixed(2);
    if (hasImg) {
      html += `<clipPath id="${clipId}"><circle cx="0" cy="0" r="${imgR}"></circle></clipPath>`;
    }
    if (mode === "like") {
      html += `<circle r="${inR}" fill="${likeCol || th.likeEmpty}"></circle>`;
    } else {
      // avatar / both：底白 + 头像；both 的喜好色描边改在 buildNodes 外圈绘制
      html += `<circle r="${inR}" fill="${th.innerFill}"></circle>`;
      if (hasImg) html += `<image href="${c.avatar}" x="-${imgR}" y="-${imgR}" width="${imgW}" height="${imgW}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    }
    return html;
  }

  function buildNodes() {
    const st = App.state;
    const th = canvasTheme();
    const k = App.nodeR() / App.NODE_R;
    let html = "";
    st.chars.forEach((c) => {
      const isSel = App.selCharId === c.id;
      const isSrc = App.linkSource === c.id;
      const isDel = App.justDeleted && App.justDeleted.indexOf(c.id) >= 0;
      let stroke = "#333", sw = 1.6;
      if (isSrc) { stroke = "#ff9500"; sw = 3.4; }
      else if (isSel) { stroke = "#0a84ff"; sw = 3; }
      const mode = st.ui.avatarMode;
      const likeCol = c.like ? App.colorOf("bottom", c.like) : null;
      const innerHtml = avatarInner(c);
      const showName = st.ui.showNames;
      const nameX = 0, nameY = App.nodeR() + 16;
      const nameCol = th.nameCol;
      // 喜好度兼容模式（both + 有喜好色）：白底遮罩 + 背景色细间隔 + 粗喜好色描边（替换原 #333 外圈）
      let outer;
      if (mode === "both" && likeCol && !isSrc && !isSel) {
        const colorW = Math.max(3, 4.5 * k);
        const spacerW = Math.max(1.5, 2.4 * k);
        const spacerR = App.nodeR() - colorW / 2 - spacerW / 2;
        const outerR = App.nodeR() + colorW / 2;
        outer = `<circle r="${outerR.toFixed(2)}" fill="${th.nodeFill}" stroke="none"></circle>`
          + `<circle r="${spacerR.toFixed(2)}" fill="none" stroke="${th.bg}" stroke-width="${spacerW.toFixed(2)}"></circle>`
          + `<circle r="${App.nodeR().toFixed(2)}" fill="none" stroke="${likeCol}" stroke-width="${colorW.toFixed(2)}"></circle>`;
      } else {
        outer = `<circle class="outer" r="${App.nodeR()}" fill="${th.nodeFill}" stroke="${stroke}" stroke-width="${sw}"></circle>`;
      }
      html += `<g class="node${isDel ? " just-del" : ""}${isOn ? " fl-on" : ""}" data-node="${c.id}" transform="translate(${c.x},${c.y})" onmouseenter="App.setHoverNode('${c.id}')" onmouseleave="App.setHoverNode(null)">
        ${outer}
        ${isDel ? `<circle class="flash-del" r="${(App.nodeR() + 8).toFixed(2)}" fill="none" stroke="#34c759" stroke-width="3.5"></circle>` : ""}
        ${innerHtml}
        ${showName ? `<text class="nm" x="${nameX}" y="${nameY}" text-anchor="middle" font-size="14" stroke="${th.bg}" stroke-width="5"
          paint-order="stroke" fill="${nameCol}">${App.esc(c.name)}</text>` : ""}
      </g>`;
    });
    return html;
  }

  function buildOrbits() {
    const th = canvasTheme();
    let html = "";
    App.state.rings.forEach((r, i) => {
      html += `<circle class="orbit" data-orb="${i + 1}" cx="0" cy="0" r="${r.rad}" fill="none" stroke="${th.orbit}" stroke-width="1.2" stroke-dasharray="5 6"></circle>`;
    });
    return html;
  }

  // 布局模式：圈半径拖拽小圆点（位于轨道外侧 3rem=30pt，避免与角色圆重合）
  const RING_HANDLE_OFFSET = 30;
  App.RING_HANDLE_OFFSET = RING_HANDLE_OFFSET;
  function buildRingHandles() {
    if (App.activeTab !== "layout") return "";
    let html = "";
    App.state.rings.forEach((r, i) => {
      const ringNo = i + 1;
      const px = 0, py = -(r.rad + RING_HANDLE_OFFSET);
      html += `<circle class="rh" data-ring="${ringNo}" cx="${px}" cy="${py}" r="11" fill="rgba(10,132,255,0.22)"
        stroke="#0a84ff" stroke-width="1.6" stroke-dasharray="none"></circle>`;
    });
    return html;
  }

  // 槽位占位：布局 + 槽位模式下，画出每圈未被占据的空槽（虚线占位圈）
  function buildSlots() {
    const st = App.state;
    if (!st.ui.slotMode || App.activeTab !== "layout") return "";
    let html = "";
    st.rings.forEach((r, i) => {
      const ringNo = i + 1;
      const sl = r.slots || 0;
      if (sl < 1) return;
      const rad = App.radiusFor(ringNo);
      const occ = new Set(App.charsOnRing(ringNo).map((c) => c.slot).filter((s) => s != null));
      for (let s = 0; s < sl; s++) {
        if (occ.has(s)) continue;
        const a = -Math.PI / 2 + (s * 2 * Math.PI) / sl;
        const x = (rad * Math.cos(a)).toFixed(1);
        const y = (rad * Math.sin(a)).toFixed(1);
        html += `<circle class="slot-ph" data-ring="${ringNo}" data-slot="${s}" cx="${x}" cy="${y}" r="${(App.nodeR() * 0.6).toFixed(1)}" fill="rgba(120,120,128,0.10)" stroke="rgba(120,120,128,0.45)" stroke-width="1.4" stroke-dasharray="4 4"></circle>`;
      }
    });
    return html;
  }

  function buildGhost() {
    const g = App.dragGhost;
    if (!g) return "";
    let html = "";
    const col = g.color || "#999";
    if (g.x1 != null && g.y1 != null) {
      html += `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${col}"
        stroke-width="${g.layer === 'bottom' ? 12 : 2.5}" stroke-linecap="round" opacity="0.6"
        stroke-dasharray="${g.layer === 'bottom' ? '0' : '6 5'}"></line>`;
    }
    return html;
  }

  // ② 图例排版（定稿）：第一行 底层粗线(喜好) / 第二行 顶层细线(关系) / 第三行 箭头含义 ➡+可改名标签
  function buildLegend() {
    const st = App.state;
    const seg = (items) => `<div class="lg-seg">${items.join("")}</div>`;
    const bottomHtml = st.tables.bottom.filter((r) => !r.hidden).map((r) =>
      `<span class="lg" data-layer="bottom" data-key="${App.esc(r.key)}"><i style="background:${r.color}"></i><b>${App.esc(r.name)}</b></span>`).join("");
    const topHtml = st.tables.top.filter((r) => !r.hidden).map((r) =>
      `<span class="lg" data-layer="top" data-key="${App.esc(r.key)}"><i style="background:${r.color}"></i><b>${App.esc(r.name)}</b></span>`).join("");
    const arrowName = (st.meta && st.meta.arrowName) ? String(st.meta.arrowName) : "情感指向";
    const arrowHtml = arrowName
      ? `<span class="lg" data-layer="arrow" data-key="one"><b class="lg-ic"><svg class="ic-svg" viewBox="0 0 48 48" fill="none"><path d="M14 24H40M28 12L40 24L28 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></b><b>${App.esc(arrowName)}</b></span>`
      : "";
    let out = "";
    if (bottomHtml) out += seg([bottomHtml]);
    if (topHtml) out += seg([topHtml]);
    if (arrowHtml) out += seg([arrowHtml]);
    return out;
  }

  App.refreshView = function () {
    const o = ensureEls();
    o.vp.setAttribute("transform", `translate(${App.view.tx},${App.view.ty}) scale(${App.view.s})`);
  };

  // 全模式常驻「当前模式」指示（写入右上角 #brushPreview，currentColor 跟昼夜走）
  function renderModeBadge(o) {
    const t = App.activeTab || "link";
    let parts = [];
    let eraser = false;
    let iconKey = null;
    let label = "";
    if (t === "hand") {
      iconKey = "hand"; label = "抓手";
    } else if (t === "layout") {
      iconKey = "layout"; label = "布局";
    } else if (t === "person") {
      iconKey = "person"; label = "人物";
    } else if (t === "style") {
      iconKey = "style"; label = "样式";
    } else {
      // link
      if (App.paintMode === "erase") {
        label = "连线·删线";
        eraser = true;
      } else {
        // link：极简状态条——只显示非默认信息（选中的笔刷名 + 非默认箭头名）
        const b = App.brush.bottom ? App.nameOf("bottom", App.brush.bottom) : "";
        const t = App.brush.top ? App.nameOf("top", App.brush.top) : "";
        const ar = App.state.tables.arrow.find((a) => a.key === App.brush.arrow);
        if (b) parts.push(App.esc(b));
        if (t) parts.push(App.esc(t));
        if (ar && ar.type !== "none") parts.push(App.esc(ar.name));
      }
    }
    if (iconKey && typeof App.ICONS === "object" && App.ICONS[iconKey]) {
      o.brush.innerHTML = App.ICONS[iconKey] + "<span>" + App.esc(label) + "</span>";
      o.brush.classList.remove("hidden");
      o.brush.classList.toggle("eraser", eraser);
      return;
    }
    if (!parts.length) { o.brush.classList.add("hidden"); return; } // 没有任何有效信息 → 整条隐藏
    o.brush.innerHTML = (label ? "<span>" + App.esc(label) + "</span>" : "") + parts.join(" · ");
    o.brush.classList.remove("hidden");
    o.brush.classList.toggle("eraser", eraser);
  }

  // 悬停角色透视：高亮与之相关的全部连线，其余连线淡出（调试用，纯视觉、不改数据）
  App.setHoverNode = function (id) {
    const g = App.byId("linksG");
    if (g) {
      const cur = g.querySelectorAll(".hl");
      for (let i = 0; i < cur.length; i++) cur[i].classList.remove("hl");
    }
    // 路径筛选进行中：让位给筛选的分级高亮，悬停不再另起一套淡出
    if (App._fmap) { document.body.classList.remove("hover-dim"); return; }
    if (!id || !App._linkEnds) { document.body.classList.remove("hover-dim"); return; }
    document.body.classList.add("hover-dim");
    const rel = [];
    for (const lid in App._linkEnds) {
      const e = App._linkEnds[lid];
      if (e[0] === id || e[1] === id) rel.push(lid);
    }
    if (g) rel.forEach((lid) => {
      const els = g.querySelectorAll('[data-link="' + lid + '"]');
      for (let i = 0; i < els.length; i++) els[i].classList.add("hl");
    });
  };

  // 删除连线后高亮刚删的这对节点（纯视觉提示，约 1 秒淡出，不改数据）
  App._delFlashT = null;
  App.flashDeletedPair = function (src, dst) {
    App.justDeleted = [src, dst];
    if (App._delFlashT) clearTimeout(App._delFlashT);
    App._delFlashT = setTimeout(() => {
      App.justDeleted = null;
      App._delFlashT = null;
      App.render();
    }, 950);
  };

  App.render = function () {
    App.computeLayout();
    const o = ensureEls();
    o.bg.setAttribute("fill", App.state.bg || "#ffffff");
    o.orbits.innerHTML = buildOrbits();
    o.links.innerHTML = buildLinks();
    o.nodes.innerHTML = buildNodes();
    o.overlay.innerHTML = buildRingHandles() + buildGhost() + buildSlots();
    o.legend.innerHTML = buildLegend();
    App.refreshView();
    renderModeBadge(o);
  };
})();
