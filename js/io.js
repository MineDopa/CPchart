/* io.js —— 名单/快照 解析导出、头像处理、成品图 */
(function () {
  const App = (window.App = window.App || {});

  // ---------------- 名单解析 ----------------
  App.parseNameList = function (text) {
    // 分号与换行等效：先按 ；/; 断行，再逐行解析（写法更自由，一行写完也认）
    const lines = String(text || "").replace(/\r/g, "").replace(/[；;]/g, "\n").split("\n");
    const out = []; // {name, ring}
    let curRing = 1;
    const HEAD = /^\s*(?:([0-9]+)|(圆心|中心|center|第0圈|圈0))?\s*[:：,，、.\-]?\s*/i;
    lines.forEach((ln) => {
      const s = String(ln).trim();
      if (!s) return;
      const m = s.match(HEAD);
      let ring = null;
      let rest = s;
      const hasRing = !!(m && (m[1] != null || m[2] != null));
      if (hasRing) {
        ring = m[1] != null ? Math.max(0, parseInt(m[1], 10)) : 0;
        rest = s.slice(m[0].length);
        curRing = ring;
      }
      // 跳过「本命：言和」这类喜好度行：它不是名单，不该被建成角色
      if (!hasRing && /[：:]/.test(rest)) return;
      const parts = rest.split(/[,，、\t]+/).map((x) => x.trim()).filter(Boolean);
      if (!parts.length) return;
      const r = ring == null ? curRing : ring;
      parts.forEach((nm) => out.push({ name: nm, ring: r }));
    });
    return out;
  };

  // 导入名单：替换角色/清空连线与喜好度，按圈均分
  // 导入名单 = 合并语义：已存在的同名角色保留其位置/喜好/头像；
  // 只新增名单里没有的角色；绝不清空连线（links 不动），旧连线与喜好度全部保留。
  App.importNameList = function (text) {
    const parsed = App.parseNameList(text);
    if (!parsed.length) throw new Error("没有解析到任何名字");
    let added = 0;
    App.act(() => {
      const byName = {};
      App.state.chars.forEach((c) => { byName[c.name] = c; });
      const av = {}, likes = {};
      App.state.chars.forEach((c) => { if (c.avatar) av[c.name] = c.avatar; if (c.like) likes[c.name] = c.like; });
      const hadRings = new Set(App.state.chars.map((c) => c.ring));
      const fresh = [];
      parsed.forEach((p) => {
        if (byName[p.name]) return; // 已存在：保留原设置，不覆盖
        fresh.push({
          id: App.uid("c"), name: p.name, ring: p.ring, angle: null, slot: null,
          like: likes[p.name] || null, avatar: av[p.name] || null,
        });
      });
      added = fresh.length;
      if (!added) return;
      App.state.chars = App.state.chars.concat(fresh); // 不重建、不清空 links
      const touched = new Set(fresh.map((c) => c.ring));
      touched.forEach((r) => {
        if (r > 0) hadRings.has(r) ? App.distributeRing(r, { anchor: true }) : App.distributeRing(r);
      });
      const maxRing = Math.max(1, ...App.state.chars.map((c) => c.ring));
      App.radiusFor(maxRing);
    });
    if (App.fitContent) App.fitContent();
    App.toast(added ? `已添加 ${added} 位新角色（原有连线与喜好度已保留）` : "名单里没有新角色，未做改动");
  };

  // 导出名单文本
  App.exportNameListText = function () {
    const st = App.state;
    const groups = new Map();
    st.chars.forEach((c) => {
      if (!groups.has(c.ring)) groups.set(c.ring, []);
      groups.get(c.ring).push(c);
    });
    const lines = [];
    const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
    sortedKeys.forEach((ring) => {
      const list = groups.get(ring).slice()
        .sort((a, b) => ((a.angle == null ? -Math.PI / 2 : a.angle) - (b.angle == null ? -Math.PI / 2 : b.angle)));
      const label = ring === 0 ? "圆心" : String(ring);
      lines.push(`${label}: ${list.map((c) => c.name).join("，")}`);
    });
    return lines.join("\n");
  };

  // ---------------- 完整数据串（v1.0 #8） ----------------
  // 新格式：XHS2:<压缩串>；同时继续接受旧 JSON（含早期 NRD）
  var XHS2 = "XHS2:";
  App.exportFullData = function () {
    const json = App.serialize();
    const LZ = window.LZString;
    if (LZ) {
      try { return XHS2 + LZ.compressToBase64(json); } catch (e) { /* 退回原文 */ }
    }
    return json;
  };
  // 解析：自动识别新压缩串 / 旧 JSON；失败抛错（由调用方提示并保留输入）
  App.parseDataImport = function (txt) {
    const s = String(txt || "").trim();
    if (!s) throw new Error("内容为空");
    if (s.indexOf(XHS2) === 0) {
      const LZ = window.LZString;
      if (!LZ) throw new Error("数据串读不了，请升级后重试");
      const json = LZ.decompressFromBase64(s.slice(XHS2.length));
      if (!json) throw new Error("数据串不完整或已损坏");
      return JSON.parse(json);
    }
    return JSON.parse(s);
  };

  // ---------------- 连线批量文本（v1.0 §3.1.2） ----------------
  // 语法：喜好度行「本命：甲，乙；很喜欢：丙」；连线行「甲—本命+爱情—乙；」
  // 方向符：<-> 双箭头 / -> 》 ➡️ 单箭头 / — - 无箭头；+ 分隔同一连线的粗线与细线
  function lgRow(layer, key) {
    return (App.state.tables[layer] || []).find((x) => x.key === key) || null;
  }
  function lgNameOf(layer, key) { const t = lgRow(layer, key); return t ? t.name : ""; }
  function lgKeyOfName(layer, name) {
    const t = (App.state.tables[layer] || []).find((x) => x.name === name);
    return t ? t.key : null;
  }
  function charByName(name) {
    return App.state.chars.find((c) => (c.name || "").trim() === String(name).trim()) || null;
  }
  function centerChar() { return App.state.chars.find((c) => c.ring === 0) || null; }
  var AUTO_COLORS = ["#ff5b7f", "#ffb020", "#34c759", "#0a84ff", "#af52de", "#ff9500", "#5ac8fa", "#ff2d55"];
  // 未知图例名 → 自动新增到对应层并配色（规则 §3.1.2-4）
  App.addLegendAuto = function (layer, name) {
    const key = (layer === "top" ? "t" : "b") + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    const list = App.state.tables[layer] || (App.state.tables[layer] = []);
    const color = AUTO_COLORS[list.length % AUTO_COLORS.length];
    list.push({ key: key, name: name, color: color, show: true });
    return key;
  };

  App.exportLinkText = function () {
    const st = App.state;
    const nameOf = (id) => { const c = st.chars.find((x) => x.id === id); return c ? c.name : ""; };
    const lines = [];
    // 喜好度行：按底层图例分组（取每条粗线中非圆心的一端）
    const fav = [];
    (st.tables.bottom || []).forEach((t) => {
      const names = [];
      st.links.forEach((k) => {
        if (k.layer !== "bottom" || k.ckey !== t.key) return;
        const a = st.chars.find((x) => x.id === k.src), b = st.chars.find((x) => x.id === k.dst);
        if (!a || !b) return;
        const other = a.ring === 0 ? b : (b.ring === 0 ? a : b);
        if (other && other.name) names.push(other.name);
      });
      if (names.length) fav.push(t.name + "：" + names.join("，"));
    });
    if (fav.length) lines.push(fav.join("；"));
    // 连线行：同一对角色合并粗线 + 细线
    const pairs = new Map();
    st.links.forEach((k) => {
      const key = [k.src, k.dst].sort().join("|");
      if (!pairs.has(key)) pairs.set(key, { src: k.src, dst: k.dst, bottom: null, top: null, arrow: "none" });
      const p = pairs.get(key);
      if (k.layer === "bottom") p.bottom = k.ckey; else p.top = k.ckey;
      if (k.arrow && k.arrow !== "none") p.arrow = k.arrow;
    });
    pairs.forEach((p) => {
      // 圆心到某人的纯粗线已由「喜好度行」表达，连线行不再重复输出
      if (!p.top && p.arrow === "none") {
        const ra = (st.chars.find((x) => x.id === p.src) || {}).ring;
        const rb = (st.chars.find((x) => x.id === p.dst) || {}).ring;
        if (ra === 0 || rb === 0) return;
      }
      const seg = [];
      if (p.bottom) { const n = lgNameOf("bottom", p.bottom); if (n) seg.push(n); }
      if (p.top) { const n = lgNameOf("top", p.top); if (n) seg.push(n); }
      const arr = p.arrow === "both" ? "<->" : p.arrow === "one" ? "->" : "—";
      const a = nameOf(p.src), b = nameOf(p.dst);
      if (!a || !b) return;
      lines.push(a + arr + seg.join("+") + arr + b + "；");
    });
    return lines.join("\n");
  };

  // 解析连线文本：返回 { added:Number, errs:[String] }（未知人名只报错，不新建角色）
  App.importLinkText = function (text) {
    const res = { added: 0, errs: [] };
    const raw = String(text || "").replace(/\r/g, "");
    const items = raw.split(/[；;\n]+/).map((x) => x.trim()).filter(Boolean);
    const center = centerChar();
    const pending = [];
    items.forEach((it) => {
      // 先判方向符 → 连线条目；否则含冒号 → 喜好度条目
      let arrow = "none", parts = null;
      if (it.indexOf("<->") >= 0) { arrow = "both"; parts = it.split("<->"); }
      else if (it.indexOf("->") >= 0 || it.indexOf("》") >= 0 || it.indexOf("➡️") >= 0) {
        arrow = "one"; parts = it.split(/->|》|➡️/);
      } else if (it.indexOf("—") >= 0) { parts = it.split("—"); }
      else if (/[^-]-[^-]/.test(it)) { parts = it.split("-"); }
      if (parts && parts.length >= 2) {
        const a = parts[0].trim(), b = parts[parts.length - 1].trim();
        const mid = parts.slice(1, parts.length - 1).join("+").trim();
        const ca = charByName(a), cb = charByName(b);
        if (!ca) { res.errs.push("未知名：" + a); return; }
        if (!cb) { res.errs.push("未知名：" + b); return; }
        const segs = mid.split("+").map((x) => x.trim()).filter(Boolean);
        const bottomName = segs.find((s) => lgKeyOfName("bottom", s)) || null;
        const topName = segs.find((s) => lgKeyOfName("top", s)) || null;
        const unknown = segs.filter((s) => !lgKeyOfName("bottom", s) && !lgKeyOfName("top", s));
        pending.push({ type: "link", a: ca, b: cb, bottomName: bottomName || null, topName: topName || null, unknown: unknown, arrow: arrow });
        return;
      }
      const m = it.match(/^([^：:]+)[：:](.+)$/);
      if (m) {
        const lname = m[1].trim();
        // 「0：我」「1：甲，乙」是名单行，不属于连线文本，跳过（避免被当成新图例名）
        if (/^[0-9]+$/.test(lname) || lname === "圆心" || lname === "中心") return;
        const names = m[2].split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
        const bkey = lgKeyOfName("bottom", lname);
        const unknown = bkey ? [] : [lname];
        names.forEach((n) => {
          const c = charByName(n);
          if (!c) { res.errs.push("未知名：" + n); return; }
          pending.push({ type: "fav", char: c, bottomName: lname, unknown: unknown, arrow: "none" });
        });
        return;
      }
      if (it) res.errs.push("看不懂：" + it);
    });
    if (!pending.length) return res;
    // 未知图例名：自动新增（底层优先），并提示
    const addedNames = [];
    pending.forEach((p) => {
      (p.unknown || []).forEach((n) => {
        if (!lgKeyOfName("bottom", n) && !lgKeyOfName("top", n)) {
          App.addLegendAuto("bottom", n);
          addedNames.push(n);
        }
      });
    });
    pending.forEach((p) => {
      if (p.type === "fav") {
        if (!center) { res.errs.push("没有圆心，无法记喜好度"); return; }
        const bkey = lgKeyOfName("bottom", p.bottomName);
        if (!bkey) return;
        const other = p.char.id === center.id ? null : p.char;
        if (!other) return;
        const exist = App.state.links.find((k) => k.layer === "bottom" &&
          ((k.src === center.id && k.dst === other.id) || (k.src === other.id && k.dst === center.id)));
        if (exist) { exist.ckey = bkey; } else { App.addLink(center.id, other.id, "bottom", bkey, "none"); }
        res.added++;
      } else {
        const bkey = p.bottomName ? lgKeyOfName("bottom", p.bottomName) : null;
        const tkey = p.topName ? lgKeyOfName("top", p.topName) : null;
        if (bkey) {
          const exist = App.state.links.find((k) => k.layer === "bottom" &&
            ((k.src === p.a.id && k.dst === p.b.id) || (k.src === p.b.id && k.dst === p.a.id)));
          if (exist) exist.ckey = bkey; else { App.addLink(p.a.id, p.b.id, "bottom", bkey, "none"); res.added++; }
        }
        if (tkey) {
          const exist = App.state.links.find((k) => k.layer === "top" &&
            ((k.src === p.a.id && k.dst === p.b.id) || (k.src === p.b.id && k.dst === p.a.id)));
          // 箭头优先给细线（§3.1.2-3）
          if (exist) { exist.ckey = tkey; exist.arrow = p.arrow; } else { App.addLink(p.a.id, p.b.id, "top", tkey, p.arrow); res.added++; }
        } else if (bkey) {
          // 无细线时箭头挂粗线
          const exist = App.state.links.find((k) => k.layer === "bottom" &&
            ((k.src === p.a.id && k.dst === p.b.id) || (k.src === p.b.id && k.dst === p.a.id)));
          if (exist) exist.arrow = p.arrow;
        }
      }
    });
    if (addedNames.length) {
      res.errs.unshift("已自动新增图例：" + addedNames.filter((v, i, arr) => arr.indexOf(v) === i).join("、"));
    }
    return res;
  };

  // ---------------- 头像处理 ----------------
  App.AVATAR_CACHE = {}; // name -> dataURL（本地）
  App.resizeAvatar = function (file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 160;
          const scale = Math.min(1, size / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(img.width * scale));
          cv.height = Math.max(1, Math.round(img.height * scale));
          const ctx = cv.getContext("2d");
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error("图片解析失败"));
        img.src = fr.result;
      };
      fr.onerror = () => reject(new Error("读取文件失败"));
      fr.readAsDataURL(file);
    });
  };

  // ---------------- 成品图导出（E-1 组合版：画布+标题带+署名+图例） ----------------
  const BAND_FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif";
  const LEGEND_FONT = "11px " + BAND_FONT;
  const LEGEND_ICON_FONT = "13px " + BAND_FONT;
  const TOP_BAND = 78; // 顶部标题带逻辑高度（标题 44 + 署名 34 约）

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // 图例三段数据：bottom(实心圆) → top(白边色条) → arrow(化简为单项 ➡+名称)
  function legendSegments(st) {
    const segs = [];
    const b = st.tables.bottom.filter((r) => r && r.name && !r.hidden);
    if (b.length) segs.push({ items: b.map((r) => ({ kind: "dot", color: r.color, name: r.name })) });
    const t = st.tables.top.filter((r) => r && r.name && !r.hidden);
    if (t.length) segs.push({ items: t.map((r) => ({ kind: "bar", color: r.color, name: r.name })) });
    const arrowName = (st.meta && st.meta.arrowName) ? String(st.meta.arrowName) : "情感指向";
    if (arrowName) segs.push({ items: [{ kind: "arrow", type: "one", name: arrowName, icon: "➡" }] });
    return segs;
  }

  function legendItemWidth(ctx, it) {
    let sw;
    if (it.kind === "arrow") {
      ctx.font = LEGEND_ICON_FONT;
      sw = ctx.measureText(it.icon).width;
      ctx.font = LEGEND_FONT;
    } else {
      sw = 13;
    }
    const tw = ctx.measureText(it.name).width;
    return sw + 4 + tw;
  }

  // 布局图例：段内项可换行；返回 blocks/w/h
  function layoutLegend(ctx, segs, contentCap) {
    const padX = 9, padY = 8, rowH = 16, itemGap = 10, segGap = 6;
    const blocks = [];
    let maxRowW = 0;
    segs.forEach((seg) => {
      const rows = [];
      let cur = [], curW = 0;
      seg.items.forEach((it) => {
        const iw = legendItemWidth(ctx, it);
        if (cur.length && curW + itemGap + iw > contentCap) {
          rows.push(cur); cur = []; curW = 0;
        }
        curW = curW ? curW + itemGap + iw : iw;
        cur.push(it);
      });
      if (cur.length) rows.push(cur);
      rows.forEach((row) => {
        let w = 0;
        row.forEach((it, i) => { w += legendItemWidth(ctx, it) + (i ? itemGap : 0); });
        if (w > maxRowW) maxRowW = w;
      });
      blocks.push({ rows });
    });
    let cardH = padY * 2;
    blocks.forEach((blk, i) => {
      if (i > 0) cardH += segGap;
      cardH += blk.rows.length * rowH;
    });
    const cardW = Math.min(contentCap, maxRowW) + padX * 2;
    return { blocks, w: cardW, h: cardH, rowH, itemGap, padX, padY, segGap };
  }

  function drawLegendItem(ctx, it, x, cy, textColor) {
    if (it.kind === "dot") {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(x + 6, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (it.kind === "bar") {
      // 白描边 + 内部细色条
      ctx.fillStyle = "#ffffff";
      roundRectPath(ctx, x + 0.5, cy - 4, 13, 8, 3.5);
      ctx.fill();
      ctx.fillStyle = it.color;
      roundRectPath(ctx, x + 2, cy - 2, 10, 4, 2);
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let xName;
    if (it.kind === "arrow") {
      ctx.font = LEGEND_ICON_FONT;
      ctx.fillStyle = textColor;
      const iconW = ctx.measureText(it.icon).width;
      ctx.fillText(it.icon, x, cy + 0.5);
      xName = x + iconW + 4;
    } else {
      xName = x + 17;
    }
    ctx.font = LEGEND_FONT;
    ctx.fillStyle = textColor;
    ctx.fillText(it.name, xName, cy);
  }

  function drawLegend(ctx, corner, layout, textColor, cardBacking, cardBorder) {
    const x = corner.x, y = corner.y;
    roundRectPath(ctx, x, y, layout.w, layout.h, 10);
    ctx.fillStyle = cardBacking;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = cardBorder;
    ctx.stroke();
    ctx.save();
    roundRectPath(ctx, x, y, layout.w, layout.h, 10);
    ctx.clip();
    let cy = y + layout.padY + layout.rowH / 2;
    layout.blocks.forEach((blk, bi) => {
      if (bi > 0) cy += layout.segGap;
      blk.rows.forEach((row) => {
        let cx = x + layout.padX;
        row.forEach((it) => {
          const iw = legendItemWidth(ctx, it);
          drawLegendItem(ctx, it, cx, cy, textColor);
          cx += iw + layout.itemGap;
        });
        cy += layout.rowH;
      });
    });
    ctx.restore();
  }

  // 用于图例避让的内容采样点（最终画布逻辑坐标）
  function contentPoints(st, x0, y0, topBand) {
    const pts = [];
    st.chars.forEach((c) => {
      const px = c.x - x0;
      const py = topBand + c.y - y0;
      pts.push({ x: px, y: py });
      if (st.ui.showNames) pts.push({ x: px, y: py + App.nodeR() + 18 });
    });
    st.rings.forEach((r) => {
      const rad = Number(r.rad) || 150;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push({ x: rad * Math.cos(a) - x0, y: topBand + rad * Math.sin(a) - y0 });
      }
    });
    return pts;
  }

  function pickLegendCorner(W, chLog, topBand, layout, pts) {
    const m = 12;
    const xL = m, xR = Math.max(m, W - m - layout.w);
    const yB = topBand + chLog - m - layout.h;
    const yT = topBand + m;
    const corners = [
      { name: "bl", x: xL, y: yB },
      { name: "br", x: xR, y: yB },
      { name: "tl", x: xL, y: yT },
      { name: "tr", x: xR, y: yT },
    ];
    const scoreOf = (rect) => {
      const ex = rect.x - 6, ey = rect.y - 6, ew = rect.w + 12, eh = rect.h + 12;
      let n = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x >= ex && p.x <= ex + ew && p.y >= ey && p.y <= ey + eh) n++;
      }
      return n;
    };
    let best = null;
    for (let i = 0; i < corners.length; i++) {
      const sc = scoreOf({ x: corners[i].x, y: corners[i].y, w: layout.w, h: layout.h });
      if (sc === 0) return corners[i];
      if (!best || sc < best.score) best = { corner: corners[i], score: sc };
    }
    return best ? best.corner : corners[0];
  }

  // 居中标题/署名 + 半透明底衬（随背景反色）
  function drawCaption(ctx, text, cx, cy, fontSize, weight, fg, backing) {
    ctx.font = (weight || "") + " " + fontSize + "px " + BAND_FONT;
    const tw = ctx.measureText(text).width;
    const padX = fontSize * 0.6, padY = fontSize * 0.42;
    const bw = tw + padX * 2, bh = fontSize + padY * 2;
    roundRectPath(ctx, cx - bw / 2, cy - bh / 2, bw, bh, Math.min(12, bh / 2));
    ctx.fillStyle = backing;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fg;
    ctx.fillText(text, cx, cy);
  }

  App.exportPNG = function (scale) {
    return new Promise((resolve, reject) => {
      try {
        App.computeLayout();
        const svgEl = App.byId("svg");
        const pad = 70;
        const st = App.state;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const acc = (x, y) => {
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        };
        if (!st.chars.length) { reject(new Error("画布为空")); return; }
        st.chars.forEach((c) => {
          acc(c.x - App.nodeR() - 12, c.y - App.nodeR() - 12);
          acc(c.x + App.nodeR() + 12, c.y + App.nodeR() + 40);
        });
        st.rings.forEach((r) => { acc(-r.rad, -r.rad); acc(r.rad, r.rad); });
        if (!isFinite(minX)) { reject(new Error("没有可导出的内容")); return; }
        const x0 = minX - pad, y0 = minY - pad;
        const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;

        // ① SVG → chart 层（含 pad，逻辑尺寸 w×h，像素按 scale s）
        const clone = svgEl.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
        clone.setAttribute("width", w);
        clone.setAttribute("height", h);
        clone.setAttribute("font-family", BAND_FONT);
        clone.removeAttribute("style");
        const vp = clone.querySelector("#vp");
        if (vp) vp.removeAttribute("transform");
        // 隐藏手柄/ghost 等运行时层
        const ov = clone.querySelector("#overlayG");
        if (ov) ov.innerHTML = "";
        // 图例角标层导出时去除（画布内不显示）
        const chip = clone.querySelector("#legendChip");
        if (chip) chip.parentNode.removeChild(chip);
        // 背景（DOM 层级修复）：#bg 实为 <g id="vp"> 内的孙节点，拿它当 <svg> 的 insertBefore
        // 参照节点会抛 NotFoundError（容器与网页版均会崩，此前未走到导出真实验证）。
        // 改为直接复用该已有 #bg，setAttribute 扩展覆盖导出视窗并重设 fill；
        // 仅当节点异常缺失时才兜底插入 clone 首个子节点。
        const bgEl = clone.querySelector("#bg");
        if (bgEl) {
          bgEl.setAttribute("x", x0 - 2000);
          bgEl.setAttribute("y", y0 - 2000);
          bgEl.setAttribute("width", w + 4000);
          bgEl.setAttribute("height", h + 4000);
          bgEl.setAttribute("fill", App.displayBg());
        } else {
          const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          bg.setAttribute("x", x0 - 2000); bg.setAttribute("y", y0 - 2000);
          bg.setAttribute("width", w + 4000); bg.setAttribute("height", h + 4000);
          bg.setAttribute("fill", App.displayBg());
          clone.insertBefore(bg, clone.firstChild);
        }

        const xml = new XMLSerializer().serializeToString(clone);
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
        const img = new Image();
        img.onload = () => {
          const s = scale || 2;
          const chartCanvas = document.createElement("canvas");
          chartCanvas.width = Math.round(w * s);
          chartCanvas.height = Math.round(h * s);
          const cctx = chartCanvas.getContext("2d");
          cctx.fillStyle = App.displayBg();
          cctx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
          cctx.drawImage(img, 0, 0, chartCanvas.width, chartCanvas.height);
          // ② 组合到最终画布
          const W = w, H = h + TOP_BAND;
          const cv = document.createElement("canvas");
          cv.width = Math.round(W * s);
          cv.height = Math.round(H * s);
          const ctx = cv.getContext("2d");
          ctx.scale(s, s);
          const dispBg = App.displayBg(); // 夜间模式下导出图跟随当前模式（深色）
          ctx.fillStyle = dispBg;
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(chartCanvas, 0, TOP_BAND, w, h);

          const fg = App.readableTextColor(dispBg);
          const backing = fg === "#ffffff" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.6)";
          const title = st.title || "未命名关系图";
          const filler = App.getFiller();
          const subtitle = filler
            ? "填表：" + filler + "　制表：小红书小工具@CP-Chart"
            : "制表：小红书小工具@CP-Chart";
          drawCaption(ctx, title, W / 2, 27, 22, "600 ", fg, backing);
          drawCaption(ctx, subtitle, W / 2, 61, 12, "400 ", fg, backing);

          // ③ 图例卡：避让采样后放空白角
          const segs = legendSegments(st);
          if (segs.length) {
            ctx.font = LEGEND_FONT;
            const contentCap = Math.max(80, Math.min(W - 36, Math.floor(W * 0.62)));
            const layout = layoutLegend(ctx, segs, contentCap);
            const pts = contentPoints(st, x0, y0, TOP_BAND);
            const corner = pickLegendCorner(W, h, TOP_BAND, layout, pts);
            const cardBacking = fg === "#ffffff" ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.8)";
            const cardBorder = fg === "#ffffff" ? "rgba(255,255,255,.28)" : "rgba(0,0,0,.12)";
            drawLegend(ctx, corner, layout, fg, cardBacking, cardBorder);
          }
          resolve(cv.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("SVG 渲染失败"));
        img.src = url;
      } catch (e) { reject(e); }
    });
  };

  // 容器保存通道（jsbridge 契约：writeTempFile({data: 完整data:uri}) → saveImageToPhotosAlbum({filePath}))
  App.saveImage = function (dataUrl) {
    return new Promise((resolve) => {
      const xhs = window.xhs && window.xhs.miniTool;
      if (!xhs || typeof xhs.saveImageToPhotosAlbum !== "function") {
        resolve({ ok: false, reason: "no-api" });
        return;
      }
      const doSave = (filePath) => {
        Promise.resolve(xhs.saveImageToPhotosAlbum({ filePath: filePath }))
          .then(() => resolve({ ok: true }))
          .catch(() => resolve({ ok: false }));
      };
      if (xhs.writeTempFile && typeof xhs.writeTempFile === "function") {
        Promise.resolve(xhs.writeTempFile({ data: dataUrl }))
          .then((r) => doSave((r && r.filePath) || dataUrl))
          .catch(() => doSave(dataUrl));
      } else {
        doSave(dataUrl);
      }
    });
  };

  // ---------------- 发布笔记（P11） ----------------
  App.generateContent = function (chartTitle) {
    const t = chartTitle || "";
    const base = "我用 CP Chart 生成了「" + t + "」的连线关系图！";
    const options = [
      base + " 角色之间的羁绊一目了然，太有意思了～大家也来下方的小工具试试看吧！✨",
      base + " 不画不知道，原来我的 CP 喜好已经打成了结！",
      base + " 角色关系可视化之后更上头了，安利给所有同好！🔥",
      base + " 你是全都可以贴贴的杂食派，还是坚定不移的洁癖派？",
    ];
    return options[Math.floor(Math.random() * options.length)];
  };

  App.publishNote = function () {
    return Promise.resolve().then(() => {
      if (!App.state.chars.length) { App.toast("画布为空，先导入人物", true); return; }
      const xhs = window.xhs && window.xhs.miniTool;
      if (!xhs || typeof xhs.postNote !== "function") {
        App.toast("当前环境不支持发布笔记", true);
        return;
      }
      return App.exportPNG(2)
        .then((imageUrl) => {
          const title = Array.from(App.state.title || "").slice(0, 20).join("") || "未命名关系图";
          const payload = {
            title: title,
            content: App.generateContent(App.state.title),
            tags: "#CPchart #CP连线图生成器",
            pageType: "photo_publish",
            mediaInfo: {
              image_resources: [{ url: imageUrl }],
            },
          };
          let pr;
          try { pr = xhs.postNote(payload); }
          catch (err) { pr = Promise.reject(err); }
          return Promise.resolve(pr)
            .then(() => App.toast("已唤起发布页"))
            .catch((err) => App.toast((err && (err.errMsg || err.message)) || "发布失败", true));
        })
        .catch((err) => App.toast("图片生成失败：" + (err.message || ""), true));
    });
  };
})();
