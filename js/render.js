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

  function buildArrowsLine(a, b, color, arrow, nodeR, extra) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let out = "";
    const tipR = nodeR + 4;
    // ③ 箭头放大：底层粗线 18×11，顶层细线按 extra.scale 缩放（默认 0.75）
    const scale = (extra && extra.scale) || 1;
    const back = 18 * scale, wid = 11 * scale;
    // ② 顶点在 (tx,ty) 贴目标圆边，底点后退 back —— 箭头尖朝目标角色
    const mkArrow = (tx, ty, dir) => {
      const ex = tx - back * ux * dir, ey = ty - back * uy * dir;
      const px = -uy * wid * dir, py = ux * wid * dir;
      return `<polygon points="${S(tx, ty)} ${S(ex + px, ey + py)} ${S(ex - px, ey - py)}" fill="${color}"></polygon>`;
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

    // 底层粗线（同对单条）
    let html = "";
    const bottoms = st.links.filter((k) => k.layer === "bottom");
    bottoms.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      const col = colors.bottom(k.ckey) || "#222";
      const pend = App.pendingLinkDel === k.id ? " pending-del" : "";
      html += `<line class="ln ln-bottom${pend}" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="${col}" stroke-width="12" stroke-linecap="round" opacity="0.88"></line>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.nodeR(), null);
    });

    // 顶层细线（白描边，同对单条直线，与 bottom 相同命中/箭头规则）
    const tops = st.links.filter((k) => k.layer === "top");
    tops.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      const col = colors.top(k.ckey) || "#555";
      const pend = App.pendingLinkDel === k.id ? " pending-del" : "";
      html += `<line class="ln ln-top${pend}" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="${th.linkEdge}" stroke-width="6.5" stroke-linecap="round" opacity="0.95"></line>`;
      html += `<line class="ln ln-top-c${pend}" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="${col}" stroke-width="2.2" stroke-linecap="round"></line>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.nodeR(), { scale: 0.75 });
    });

    // 命中区（触屏容易点）
    st.links.forEach((k) => {
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
    } else if (mode === "avatar") {
      html += `<circle r="${inR}" fill="${th.innerFill}"></circle>`;
      if (hasImg) html += `<image href="${c.avatar}" x="-${imgR}" y="-${imgR}" width="${imgW}" height="${imgW}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    } else {
      // both：底白+头像；喜好吗用外圈细环
      html += `<circle r="${inR}" fill="${th.innerFill}"></circle>`;
      if (hasImg) html += `<image href="${c.avatar}" x="-${imgR}" y="-${imgR}" width="${imgW}" height="${imgW}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    }
    if (mode === "both") {
      html += `<circle r="${ringR}" fill="none" stroke="${likeCol || "#8e8e93"}" stroke-width="${ringW}"></circle>`;
    }
    return html;
  }

  function buildNodes() {
    const st = App.state;
    const th = canvasTheme();
    let html = "";
    st.chars.forEach((c) => {
      const isSel = App.selCharId === c.id;
      const isSrc = App.linkSource === c.id;
      let stroke = "#333", sw = 1.6;
      if (isSrc) { stroke = "#ff9500"; sw = 3.4; }
      else if (isSel) { stroke = "#0a84ff"; sw = 3; }
      const mode = st.ui.avatarMode;
      const innerHtml = avatarInner(c);
      const showName = st.ui.showNames;
      const nameX = 0, nameY = App.nodeR() + 16;
      const nameCol = th.nameCol;
      html += `<g class="node" data-node="${c.id}" transform="translate(${c.x},${c.y})">
        <circle class="outer" r="${App.nodeR()}" fill="${th.nodeFill}" stroke="${stroke}" stroke-width="${sw}"></circle>
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
      `<span class="lg" data-layer="top" data-key="${App.esc(r.key)}"><i style="background:${r.color};box-shadow:0 0 0 1.5px #fff"></i><b>${App.esc(r.name)}</b></span>`).join("");
    const arrowName = (st.meta && st.meta.arrowName) ? String(st.meta.arrowName) : "情感指向";
    const arrowHtml = arrowName
      ? `<span class="lg" data-layer="arrow" data-key="one"><b class="lg-ic">➡</b><b>${App.esc(arrowName)}</b></span>`
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

  // 全模式常驻「当前模式」指示（写入左下角 #brushPreview）
  function renderModeBadge(o) {
    const t = App.activeTab || "link";
    let parts = [];
    let eraser = false;
    if (t === "hand") {
      parts.push("👋抓手");
    } else if (t === "layout") {
      parts.push("🌐布局");
    } else if (t === "person") {
      parts.push("👤人物");
    } else if (t === "style") {
      parts.push("🎨样式");
    } else {
      // link
      if (App.eraser) {
        parts.push("🪌 连线·删线");
        eraser = true;
      } else {
        const bName = App.brush.bottom ? App.nameOf("bottom", App.brush.bottom) : "—";
        const tName = App.brush.top ? App.nameOf("top", App.brush.top) : "—";
        const ar = App.state.tables.arrow.find((a) => a.key === App.brush.arrow);
        const arType = ar ? ar.type : "none";
        const arName = ar ? ar.name : "无箭头";
        const arIcon = arType === "one" ? "➜" : arType === "both" ? "⇄" : "—";
        parts.push("💑笔刷 ◯" + App.esc(bName) + " ●" + App.esc(tName) + " " + arIcon + App.esc(arName));
        if (App.linkSource) parts.push("已选起点·拖向终点");
      }
    }
    o.brush.innerHTML = parts.join(" · ");
    o.brush.classList.remove("hidden");
    o.brush.classList.toggle("eraser", eraser);
  }

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
