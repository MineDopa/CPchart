/* state.js —— 数据模型 + 文档操作 + 撤销/重做 + 草稿 */
(function () {
  const App = (window.App = window.App || {});

  const NODE_R = 18, INNER_R = 11;

  const DEFAULT_BOTTOM = [
    { key: "b1", name: "本命", color: "#d32f2f" },
    { key: "b2", name: "很喜欢", color: "#f57c00" },
    { key: "b3", name: "路好", color: "#fbc02d" },
    { key: "b4", name: "不吃", color: "#222222" },
  ];
  const DEFAULT_TOP = [
    { key: "t1", name: "爱情", color: "#ec407a" },
    { key: "t2", name: "友情", color: "#43a047" },
    { key: "t3", name: "亲情", color: "#1976d2" },
    { key: "t4", name: "QPR", color: "#8e24aa" },
  ];
  const DEFAULT_ARROW = [
    { key: "none", name: "无箭头", type: "none" },
    { key: "one", name: "单向", type: "one" },
    { key: "both", name: "双向", type: "both" },
  ];

  // 参考预设名单（用于开局引导/示例）
  const PRESET_TEXT = [
    "圆心: 甲",
    "1: 乙, 丙, 丁",
    "2: 戊, 己, 庚, 辛",
    "3: 壬, 癸",
  ].join("\n");

  // 半径按圈生成：第1圈起
  function defaultRadii(needCount) {
    const arr = [];
    for (let i = 1; i <= needCount; i++) arr.push(150 + (i - 1) * 120);
    return arr;
  }

  function freshDoc() {
    return {
      ver: 1,
      title: "未命名关系图",
      bg: "#ffffff",
      rings: [{ rad: 150 }, { rad: 270 }], // rings[0]=第1圈 …
      chars: [], // ring: 0=圆心; 1..n=第n圈; angle(rad)
      links: [], // {id,src,dst,layer:'bottom'|'top',ckey,arrow}
      tables: {
        bottom: DEFAULT_BOTTOM.map((x) => ({ ...x })),
        top: DEFAULT_TOP.map((x) => ({ ...x })),
        arrow: DEFAULT_ARROW.map((x) => ({ ...x })),
      },
      ui: { avatarMode: "both", showNames: true, slotMode: false },
      meta: {},
    };
  }

  App.state = freshDoc();
  App.view = { s: 1, tx: 0, ty: 0 };
  App.selCharId = null; // 当前选中角色
  App.linkSource = null; // 连线起点
  App.eraser = false; // 删线模式
  App.brush = { bottom: null, top: null, arrow: "none" };
  App.dragGhost = null; // {x1,y1,x2,y2,layer,color}
  App.saved = false;
  App.hist = { u: [], r: [] };
  App.HIST_MAX = 80;

  App.radiusFor = function (ring) {
    if (ring <= 0) return 0;
    while (App.state.rings.length < ring) {
      const prev = App.state.rings.length
        ? App.state.rings[App.state.rings.length - 1].rad
        : 120;
      App.state.rings.push({ rad: prev + 120 });
    }
    return App.state.rings[ring - 1].rad;
  };

  // 圆心（ring=0）唯一性：把其它角色从圆心移走
  function ensureCenterUnique(exceptId) {
    const cs = App.state.chars.filter((c) => c.ring === 0 && c.id !== exceptId);
    cs.forEach((c) => {
      c.ring = 1;
      c.angle = App.normAngle(Math.random() * Math.PI * 2);
      App.distributeRing(1);
    });
  }

  // 计算所有角色坐标到 x/y
  function computeLayout() {
    App.state.chars.forEach((c) => {
      const rad = App.radiusFor(c.ring);
      if (c.ring === 0) {
        c.x = 0; c.y = 0;
      } else {
        const a = c.angle == null ? -Math.PI / 2 : c.angle;
        c.x = rad * Math.cos(a);
        c.y = rad * Math.sin(a);
      }
    });
  }

  // 某圈内的角色
  App.charsOnRing = (ring) => App.state.chars.filter((c) => c.ring === ring);

  // 均分某圈（按当前角度排序），把空圈角色数>0的铺满
  App.distributeRing = function (ring, opts) {
    if (ring === 0) return;
    const list = App.charsOnRing(ring);
    const n = list.length;
    if (n === 0) return;
    const sl = (opts && opts.slots) || null;
    if (sl) {
      // 槽位模式：把 n 人铺到 sl 个槽，尽量均布
      const sorted = list
        .map((c) => ({ c, a: c.angle == null ? -Math.PI / 2 : App.normAngle(c.angle) }))
        .sort((p, q) => p.a - q.a);
      const step = sl / n;
      sorted.forEach((it, i) => {
        const slot = Math.min(sl - 1, Math.round(i * step));
        it.c.angle = -Math.PI / 2 + (slot * 2 * Math.PI) / sl;
        it.c.slot = slot;
      });
      return;
    }
    const sorted = list
      .map((c) => ({ c, a: c.angle == null ? -Math.PI / 2 : App.normAngle(c.angle) }))
      .sort((p, q) => p.a - q.a);
    sorted.forEach((it, i) => {
      it.c.angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      it.c.slot = null;
    });
  };

  // 平均排布（全部圈）
  App.evenAll = function () {
    const maxRing = Math.max(0, ...App.state.chars.map((c) => c.ring));
    for (let r = 1; r <= maxRing; r++) App.distributeRing(r);
    computeLayout();
  };

  App.addChar = function (name, ring) {
    ring = Math.max(0, Math.floor(ring || 1));
    if (ring === 0) ensureCenterUnique(null);
    const c = {
      id: App.uid("c"), name: String(name).trim() || "未命名",
      ring, angle: null, slot: null, like: null, avatar: null,
    };
    App.state.chars.push(c);
    if (ring > 0) App.distributeRing(ring);
    computeLayout();
    return c;
  };

  App.removeChar = function (id) {
    App.state.chars = App.state.chars.filter((c) => c.id !== id);
    App.state.links = App.state.links.filter((k) => k.src !== id && k.dst !== id);
    if (App.selCharId === id) App.selCharId = null;
    if (App.linkSource === id) App.linkSource = null;
    computeLayout();
  };

  // 移动/换圈。ring<0 表示保持当前圈。
  App.moveCharToRing = function (id, ring, keepAngle) {
    const c = App.state.chars.find((x) => x.id === id);
    if (!c) return;
    const target = ring < 0 ? c.ring : Math.max(0, Math.floor(ring));
    if (c.ring === target) {
      if (!keepAngle && target > 0 && c.angle != null) {
        // 同圈内拖回默认均分？保持角度即可
      }
      computeLayout();
      return;
    }
    // 换到圆心：现任圆心回到该角色原圈的位置
    if (target === 0) {
      const old = c.ring;
      const oldAng = c.angle;
      const curCenter = App.state.chars.find((x) => x.ring === 0 && x.id !== id);
      if (curCenter) {
        curCenter.ring = old;
        curCenter.angle = oldAng == null ? -Math.PI / 2 : oldAng;
      }
      c.ring = 0; c.angle = 0;
      if (old > 0) App.distributeRing(old);
    } else {
      // 离开圆心
      if (c.ring === 0) {
        // 圆心没人了
      }
      c.ring = target;
      c.angle = keepAngle && c.angle != null ? c.angle : -Math.PI / 2;
      App.distributeRing(target);
    }
    computeLayout();
  };

  // 从圈上移除/归入某圈用 dragEnd：angle 由真实落点给出
  App.snapChar = function (id, worldX, worldY) {
    const c = App.state.chars.find((x) => x.id === id);
    if (!c) return;
    const dist = Math.hypot(worldX, worldY);
    const ang = Math.atan2(worldY, worldX);
    // 圆心判定
    if (dist < 46) {
      const other = App.state.chars.find((x) => x.ring === 0 && x.id !== id);
      if (!other) {
        // 直接进圆心
        const oldRing = c.ring;
        if (c.ring !== 0) {
          c.ring = 0; c.angle = 0;
          if (oldRing > 0) App.distributeRing(oldRing);
        }
        computeLayout();
        return;
      }
    }
    // 就近轨道
    const maxRing = Math.max(1, c.ring, ...App.state.chars.map((x) => x.ring));
    let best = 1, bestErr = Infinity;
    for (let r = 1; r <= maxRing + 1; r++) {
      const rad = App.radiusFor(r);
      const err = Math.abs(dist - rad);
      if (err < bestErr) { bestErr = err; best = r; }
    }
    const wasCenter = c.ring === 0;
    if (wasCenter && best === 1 && dist < 60) best = 1;
    c.ring = best;
    c.angle = ang;
    c.slot = null;
    App.distributeRing(best);
    if (wasCenter && best !== 0) { /* 圆心留空 */ }
    computeLayout();
  };

  // 连线操作
  function pairKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
  App.findBottomLink = function (a, b) {
    return App.state.links.find((k) => k.layer === "bottom" && pairKey(k.src, k.dst) === pairKey(a, b));
  };
  App.addLink = function (src, dst, layer, ckey, arrow) {
    if (!ckey) return null;
    if (layer === "bottom") {
      const exist = App.findBottomLink(src, dst);
      if (exist) {
        exist.ckey = ckey;
        exist.arrow = arrow || "none";
        return exist;
      }
    }
    const k = {
      id: App.uid("l"), src, dst, layer, ckey, arrow: arrow || "none",
    };
    App.state.links.push(k);
    return k;
  };
  App.removeLink = function (id) {
    App.state.links = App.state.links.filter((k) => k.id !== id);
  };

  // 引用某颜色表项的对象清理
  function purgeColor(key, layer) {
    if (layer === "bottom") {
      App.state.links = App.state.links.filter((k) => !(k.layer === "bottom" && k.ckey === key));
      App.state.chars.forEach((c) => { if (c.like === key) c.like = null; });
    } else if (layer === "top") {
      App.state.links = App.state.links.filter((k) => !(k.layer === "top" && k.ckey === key));
    }
  }
  function purgeArrow(key) {
    App.state.links.forEach((k) => { if (k.arrow === key) k.arrow = "none"; });
  }

  // 表项 CRUD
  App.addTableRow = function (layer, extra) {
    const tb = App.state.tables[layer];
    const row = { key: App.uid(layer[0] + "_"), name: (extra && extra.name) || "新项",
      color: (extra && extra.color) || "#999999", ...(extra || {}) };
    row.key = App.uid(layer[0] + "_");
    tb.push(row);
    return row;
  };
  App.delTableRow = function (layer, key) {
    const tb = App.state.tables[layer];
    const i = tb.findIndex((x) => x.key === key);
    if (i < 0) return;
    if (layer === "arrow" && key === "none") return; // 保留兜底
    if (layer === "bottom") purgeColor(key, "bottom");
    else if (layer === "top") purgeColor(key, "top");
    else purgeArrow(key);
    tb.splice(i, 1);
  };
  App.renameTableRow = (layer, key, name) => {
    const r = App.state.tables[layer].find((x) => x.key === key);
    if (r) r.name = name;
  };
  App.recolorTableRow = (layer, key, color) => {
    const r = App.state.tables[layer].find((x) => x.key === key);
    if (r) r.color = color;
  };

  // 颜色表查询
  App.colorOf = function (layer, key) {
    const r = App.state.tables[layer].find((x) => x.key === key);
    return r ? r.color : "#999";
  };
  App.nameOf = function (layer, key) {
    const r = App.state.tables[layer].find((x) => x.key === key);
    return r ? r.name : "?";
  };

  // 选中状态
  App.setSel = function (id) {
    if (App.selCharId === id) App.selCharId = null;
    else App.selCharId = id;
  };

  // 序列化/反序列化（JSON 文本往返）
  App.serialize = function () {
    return JSON.stringify({ type: "xhs-cp-v1", doc: App.state }, null, 2);
  };
  App.deserialize = function (txt) {
    const obj = JSON.parse(txt);
    const doc = obj && obj.doc ? obj.doc : obj;
    if (!doc || !Array.isArray(doc.chars)) throw new Error("不是有效的快照数据");
    // 修补缺失
    const fresh = freshDoc();
    App.state = {
      ver: 1,
      title: typeof doc.title === "string" ? doc.title : fresh.title,
      bg: doc.bg || fresh.bg,
      rings: Array.isArray(doc.rings) && doc.rings.length ? doc.rings.map((r) => ({ rad: Number(r.rad) || 150 })) : fresh.rings,
      chars: (doc.chars || []).map((c) => ({
        id: c.id || App.uid("c"), name: c.name || "?", ring: Number(c.ring) || 0,
        angle: c.angle == null ? null : Number(c.angle), slot: c.slot == null ? null : c.slot,
        like: c.like || null, avatar: c.avatar || null, x: 0, y: 0,
      })),
      links: (doc.links || []).map((k) => ({
        id: k.id || App.uid("l"), src: k.src, dst: k.dst,
        layer: k.layer === "bottom" ? "bottom" : "top",
        ckey: k.ckey, arrow: k.arrow || "none",
      })),
      tables: {
        bottom: (doc.tables && doc.tables.bottom && doc.tables.bottom.length)
          ? doc.tables.bottom.map((r) => ({ key: r.key, name: r.name, color: r.color }))
          : DEFAULT_BOTTOM.map((x) => ({ ...x })),
        top: (doc.tables && doc.tables.top && doc.tables.top.length)
          ? doc.tables.top.map((r) => ({ key: r.key, name: r.name, color: r.color }))
          : DEFAULT_TOP.map((x) => ({ ...x })),
        arrow: (doc.tables && doc.tables.arrow && doc.tables.arrow.length)
          ? doc.tables.arrow.map((r) => ({ key: r.key, name: r.name, type: r.type || "none" }))
          : DEFAULT_ARROW.map((x) => ({ ...x })),
      },
      ui: Object.assign({}, fresh.ui, doc.ui || {}),
      meta: {},
    };
    if (!App.state.tables.arrow.some((a) => a.key === "none")) {
      App.state.tables.arrow.unshift({ key: "none", name: "无箭头", type: "none" });
    }
    ensureCenterUnique(null);
    computeLayout();
  };

  // ------- 历史（撤销/重做）-------
  function clone() { return JSON.parse(JSON.stringify(App.state)); }
  App.canUndo = () => App.hist.u.length > 0;
  App.canRedo = () => App.hist.r.length > 0;

  // 变化前调用一次记录旧状态
  App.commitHist = function () {
    App.hist.u.push(clone());
    if (App.hist.u.length > App.HIST_MAX) App.hist.u.shift();
    App.hist.r = [];
  };
  App.undo = function () {
    if (!App.hist.u.length) return;
    App.hist.r.push(clone());
    App.state = App.hist.u.pop();
    if (!App.state.ui) App.state.ui = { avatarMode: "both", showNames: true, slotMode: false };
    App.selCharId = null; App.linkSource = null; App.dragGhost = null;
    computeLayout();
    App.notifyChanged();
  };
  App.redo = function () {
    if (!App.hist.r.length) return;
    App.hist.u.push(clone());
    App.state = App.hist.r.pop();
    App.selCharId = null; App.linkSource = null; App.dragGhost = null;
    computeLayout();
    App.notifyChanged();
  };

  // 统一的“变更一次”入口：记录历史 + 渲染 + 自动保存
  App.act = function (fn) {
    App.commitHist();
    fn();
    computeLayout();
    App.notifyChanged();
  };

  // 供渲染回调：通知 UI 更新（render/ui 内部实现）
  App.onChanged = null;
  App.notifyChanged = function () {
    if (App.onChanged) App.onChanged();
  };

  // 自动保存草稿（debounce 在 main 绑定）
  App.DRAFT_KEY = "xhs_cp_draft_v1";
  App.scheduleSave = null; // 由 main 设置

  App.newDoc = function () {
    App.state = freshDoc();
    App.selCharId = null; App.linkSource = null; App.dragGhost = null; App.eraser = false;
    App.hist = { u: [], r: [] };
    App.notifyChanged();
  };

  App.NODE_R = NODE_R;
  App.INNER_R = INNER_R;
  App.PRESET_TEXT = PRESET_TEXT;
  App.computeLayout = computeLayout;
})();
