/* io.js —— 名单/快照 解析导出、头像处理、成品图 */
(function () {
  const App = (window.App = window.App || {});

  // ---------------- 名单解析 ----------------
  App.parseNameList = function (text) {
    const lines = String(text || "").split(/\r?\n/);
    const out = []; // {name, ring}
    let curRing = 1;
    const HEAD = /^\s*(?:([0-9]+)|(圆心|中心|center|第0圈|圈0))?\s*[:：,，、.\-]?\s*/i;
    lines.forEach((ln) => {
      const s = String(ln).trim();
      if (!s) return;
      const m = s.match(HEAD);
      let ring = null;
      let rest = s;
      if (m && (m[1] != null || m[2] != null)) {
        ring = m[1] != null ? Math.max(0, parseInt(m[1], 10)) : 0;
        rest = s.slice(m[0].length);
        if (ring > 0) curRing = ring;
        else curRing = ring;
      }
      const parts = rest.split(/[,，、;；\t]+/).map((x) => x.trim()).filter(Boolean);
      if (!parts.length) return;
      const r = ring == null ? curRing : ring;
      parts.forEach((nm) => out.push({ name: nm, ring: r }));
    });
    return out;
  };

  // 导入名单：替换角色/清空连线与喜好度，按圈均分
  App.importNameList = function (text) {
    const parsed = App.parseNameList(text);
    if (!parsed.length) throw new Error("没有解析到任何名字");
    App.act(() => {
      // 缓存旧头像按名回填
      const av = {};
      App.state.chars.forEach((c) => { if (c.avatar) av[c.name] = c.avatar; });
      const likes = {};
      App.state.chars.forEach((c) => { if (c.like) likes[c.name] = c.like; });

      const maxRing = Math.max(...parsed.map((p) => p.ring));
      App.state.chars = parsed.map((p) => ({
        id: App.uid("c"), name: p.name, ring: p.ring, angle: null, slot: null,
        like: likes[p.name] || null, avatar: av[p.name] || null,
      }));
      App.state.links = [];
      // 圆心唯一
      const centers = App.state.chars.filter((c) => c.ring === 0);
      if (centers.length > 1) {
        centers.slice(1).forEach((c) => { c.ring = 1; });
      }
      for (let r = 0; r <= maxRing; r++) {
        if (r > 0) App.distributeRing(r);
      }
      App.radiusFor(Math.max(1, maxRing));
    });
    // ① 导入后自动适配：全部轨道可见 + 圆心居画面中央
    if (App.fitContent) App.fitContent();
    App.toast(`已导入 ${App.state.chars.length} 位角色`);
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
    const b = st.tables.bottom.filter((r) => r && r.name);
    if (b.length) segs.push({ items: b.map((r) => ({ kind: "dot", color: r.color, name: r.name })) });
    const t = st.tables.top.filter((r) => r && r.name);
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
    return { blocks, w: cardW, h: cardH, rowH, itemGap, padX, padY };
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
      if (st.ui.showNames) pts.push({ x: px, y: py + App.NODE_R + 18 });
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
          acc(c.x - App.NODE_R - 12, c.y - App.NODE_R - 12);
          acc(c.x + App.NODE_R + 12, c.y + App.NODE_R + 40);
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
        // 背景
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", x0 - 2000); bg.setAttribute("y", y0 - 2000);
        bg.setAttribute("width", w + 4000); bg.setAttribute("height", h + 4000);
        bg.setAttribute("fill", st.bg);
        const root = clone.querySelector("#bg") || clone.firstElementChild;
        if (root) clone.insertBefore(bg, root);
        else clone.insertBefore(bg, clone.firstChild);

        const xml = new XMLSerializer().serializeToString(clone);
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
        const img = new Image();
        img.onload = () => {
          const s = scale || 2;
          const chartCanvas = document.createElement("canvas");
          chartCanvas.width = Math.round(w * s);
          chartCanvas.height = Math.round(h * s);
          const cctx = chartCanvas.getContext("2d");
          cctx.fillStyle = st.bg;
          cctx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
          cctx.drawImage(img, 0, 0, chartCanvas.width, chartCanvas.height);
          // ② 组合到最终画布
          const W = w, H = h + TOP_BAND;
          const cv = document.createElement("canvas");
          cv.width = Math.round(W * s);
          cv.height = Math.round(H * s);
          const ctx = cv.getContext("2d");
          ctx.scale(s, s);
          ctx.fillStyle = st.bg;
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(chartCanvas, 0, TOP_BAND, w, h);

          const fg = App.readableTextColor(st.bg);
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
