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

  // ---------------- 成品图导出（E-1） ----------------
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
        const x0 = minX - pad, y0 = minY - pad, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;

        const clone = svgEl.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
        clone.setAttribute("width", w);
        clone.setAttribute("height", h);
        clone.setAttribute("font-family", "-apple-system,PingFang SC,sans-serif");
        clone.removeAttribute("style");
        const vp = clone.querySelector("#vp");
        if (vp) vp.removeAttribute("transform");
        // 隐藏手柄/ghost 等运行时层
        const ov = clone.querySelector("#overlayG");
        if (ov) ov.innerHTML = "";
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
          const cv = document.createElement("canvas");
          cv.width = Math.round(w * s); cv.height = Math.round(h * s);
          const ctx = cv.getContext("2d");
          ctx.fillStyle = st.bg;
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("SVG 渲染失败"));
        img.src = url;
      } catch (e) { reject(e); }
    });
  };

  // 容器保存通道探测（E-1）：返回可用则调用
  App.saveImage = function (dataUrl) {
    return new Promise((resolve) => {
      const xhs = window.xhs && window.xhs.miniTool;
      if (xhs && typeof xhs.saveImageToPhotosAlbum === "function") {
        const fileName = "cp_map_" + Date.now() + ".png";
        const p = xhs.writeTempFile
          ? xhs.writeTempFile({ base64: dataUrl.split(",")[1], fileName })
          : Promise.resolve({ filePath: fileName });
        Promise.resolve(p)
          .then((r) => (xhs.saveImageToPhotosAlbum ? xhs.saveImageToPhotosAlbum({ filePath: (r && r.filePath) || fileName }) : null))
          .then(() => resolve({ ok: true }))
          .catch(() => resolve({ ok: false }));
      } else {
        resolve({ ok: false });
      }
    });
  };
})();
