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

  function buildArrowsLine(a, b, color, arrow, nodeR, extra) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let out = "";
    const tipR = nodeR + 4;
    const back = 12, wid = 7;
    const mkArrow = (tx, ty, dir) => {
      const ex = tx - back * ux * dir, ey = ty - back * uy * dir;
      const px = -uy * wid * dir, py = ux * wid * dir;
      return `<polygon points="${S(tx + px, ty + py)} ${S(ex, ey)} ${S(tx - px, ty - py)}" fill="${color}"></polygon>`;
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

  // 同对多条顶层线弧线展开
  function pairPath(a, b, idx, total) {
    if (total <= 1) return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, n: null };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
    const off = (idx - (total - 1) / 2) * Math.min(46, 18 + (total - 1) * 6);
    const cx = midx - (dy / len) * off;
    const cy = midy + (dx / len) * off;
    return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, n: { x: cx, y: cy } };
  }

  function buildLinks() {
    const st = App.state;
    const colors = {
      bottom: (k) => App.colorOf("bottom", k),
      top: (k) => App.colorOf("top", k),
    };
    const byId = {};
    st.chars.forEach((c) => (byId[c.id] = c));

    // 底层粗线（同对唯一）
    let html = "";
    const bottoms = st.links.filter((k) => k.layer === "bottom");
    bottoms.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      const col = colors.bottom(k.ckey) || "#222";
      html += `<line class="ln ln-bottom" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="${col}" stroke-width="12" stroke-linecap="round" opacity="0.88"></line>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.NODE_R, null);
    });

    // 顶层细线（白描边，同对多条弧线扇开）
    const tops = st.links.filter((k) => k.layer === "top");
    const groups = new Map();
    tops.forEach((k) => {
      const key = k.src < k.dst ? k.src + "|" + k.dst : k.dst + "|" + k.src;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(k);
    });
    tops.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      const key = k.src < k.dst ? k.src + "|" + k.dst : k.dst + "|" + k.src;
      const arr = groups.get(key) || [k];
      const idx = arr.indexOf(k);
      const total = arr.length;
      const { d } = pairPath(a, b, idx, total);
      const col = colors.top(k.ckey) || "#555";
      html += `<path class="ln ln-top" data-link="${k.id}" d="${d}" fill="none"
        stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" opacity="0.95"></path>`;
      html += `<path class="ln ln-top-c" data-link="${k.id}" d="${d}" fill="none"
        stroke="${col}" stroke-width="2.2" stroke-linecap="round"></path>`;
      html += buildArrowsLine(a, b, col, k.arrow, App.NODE_R, null);
    });

    // 命中区（触屏容易点）
    st.links.forEach((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      if (k.layer === "top") {
        const key = k.src < k.dst ? k.src + "|" + k.dst : k.dst + "|" + k.src;
        const arr = (groups.get(key) || [k]);
        const { d } = pairPath(a, b, arr.indexOf(k), arr.length);
        html += `<path class="hit ln-hit" data-link="${k.id}" d="${d}" fill="none" stroke="transparent" stroke-width="24"></path>`;
      } else {
        html += `<line class="hit ln-hit" data-link="${k.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
          stroke="transparent" stroke-width="24"></line>`;
      }
    });
    return html;
  }

  function avatarInner(c) {
    // 返回内圈内部 html（不带头像时依据模式填充）
    const mode = App.state.ui.avatarMode;
    const likeCol = c.like ? App.colorOf("bottom", c.like) : null;
    let html = "";
    const clipId = "cp" + c.id.replace(/[^a-zA-Z0-9]/g, "");
    const hasImg = !!c.avatar;
    if (hasImg) {
      html += `<clipPath id="${clipId}"><circle cx="0" cy="0" r="10.4"></circle></clipPath>`;
    }
    if (mode === "like") {
      html += `<circle r="11" fill="${likeCol || "#ececec"}"></circle>`;
    } else if (mode === "avatar") {
      html += `<circle r="11" fill="#ffffff"></circle>`;
      if (hasImg) html += `<image href="${c.avatar}" x="-10.4" y="-10.4" width="20.8" height="20.8" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    } else {
      // both：底白+头像；喜好吗用外圈细环
      html += `<circle r="11" fill="#ffffff"></circle>`;
      if (hasImg) html += `<image href="${c.avatar}" x="-10.4" y="-10.4" width="20.8" height="20.8" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    }
    if (mode === "both") {
      html += `<circle r="12.2" fill="none" stroke="${likeCol || "#8e8e93"}" stroke-width="3.2"></circle>`;
    }
    return html;
  }

  function buildNodes() {
    const st = App.state;
    const bg = st.bg;
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
      const nameX = 0, nameY = App.NODE_R + 16;
      const nameCol = "#26262a";
      html += `<g class="node" data-node="${c.id}" transform="translate(${c.x},${c.y})">
        <circle class="outer" r="${App.NODE_R}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"></circle>
        ${innerHtml}
        ${showName ? `<text class="nm" x="${nameX}" y="${nameY}" text-anchor="middle" stroke="${bg}" stroke-width="5"
          paint-order="stroke" fill="${nameCol}">${App.esc(c.name)}</text>` : ""}
      </g>`;
    });
    return html;
  }

  function buildOrbits() {
    const st = App.state;
    let html = "";
    st.rings.forEach((r, i) => {
      html += `<circle class="orbit" data-orb="${i + 1}" cx="0" cy="0" r="${r.rad}" fill="none" stroke="#d5d5da" stroke-width="1.2" stroke-dasharray="5 6"></circle>`;
    });
    return html;
  }

  // 布局模式：圈半径拖拽小圆点
  function buildRingHandles() {
    if (App.activeTab !== "layout") return "";
    let html = "";
    App.state.rings.forEach((r, i) => {
      const ringNo = i + 1;
      const px = 0, py = -r.rad;
      html += `<circle class="rh" data-ring="${ringNo}" cx="${px}" cy="${py}" r="11" fill="rgba(10,132,255,0.22)"
        stroke="#0a84ff" stroke-width="1.6" stroke-dasharray="none"></circle>`;
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

  function buildLegend() {
    const st = App.state;
    let arr = [];
    st.tables.bottom.forEach((r) => {
      arr.push(`<span class="lg"><i style="background:${r.color}"></i><b>${App.esc(r.name)}</b></span>`);
    });
    if (arr.length) arr.push('<span class="sep">|</span>');
    st.tables.top.forEach((r) => {
      arr.push(`<span class="lg"><i style="background:${r.color};box-shadow:0 0 0 1.5px #fff"></i><b>${App.esc(r.name)}</b></span>`);
    });
    if (arr.length && st.tables.arrow.length) arr.push('<span class="sep">|</span>');
    st.tables.arrow.forEach((r) => {
      const icon = r.type === "one" ? "➜" : r.type === "both" ? "⇄" : "—";
      arr.push(`<span class="lg"><b>${icon}</b><b>${App.esc(r.name)}</b></span>`);
    });
    return arr.join("");
  }

  App.refreshView = function () {
    const o = ensureEls();
    o.vp.setAttribute("transform", `translate(${App.view.tx},${App.view.ty}) scale(${App.view.s})`);
  };

  App.render = function () {
    App.computeLayout();
    const o = ensureEls();
    o.bg.setAttribute("fill", App.state.bg);
    o.orbits.innerHTML = buildOrbits();
    o.links.innerHTML = buildLinks();
    o.nodes.innerHTML = buildNodes();
    o.overlay.innerHTML = buildRingHandles() + buildGhost();
    o.legend.innerHTML = buildLegend();
    App.refreshView();
    // 画笔状态条
    const bs = [];
    if (App.activeTab === "link") {
      if (App.eraser) bs.push("🪌 删线模式：点线删除");
      else {
        if (App.brush.bottom) bs.push(`◯${App.esc(App.nameOf("bottom", App.brush.bottom))}`);
        if (App.brush.top) bs.push(`●${App.esc(App.nameOf("top", App.brush.top))}`);
        const ar = App.state.tables.arrow.find((a) => a.key === App.brush.arrow);
        if (ar) bs.push((ar.type === "one" ? "➜" : ar.type === "both" ? "⇄" : "—") + App.esc(ar.name));
        if (App.linkSource) bs.push("已选起点，拖向终点");
      }
      o.brush.innerHTML = bs.join(" · ");
      o.brush.classList.remove("hidden");
    } else {
      o.brush.classList.add("hidden");
    }
  };
})();
