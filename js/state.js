/* state.js —— 数据模型 + 文档操作 + 撤销/重做 + 草稿 */
(function () {
  const App = (window.App = window.App || {});

  const NODE_R = 18, INNER_R = 11;
  const NODE_R_MIN = 12, NODE_R_MAX = 40; // 角色圆圈半径可调范围（布局面板滑块）

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
  // 箭头类型为固定枚举（连线面板选择用，不参与样式改名）：
  // 类型名永远显示 无箭头/单箭头/双箭头；「含义名」为单一可编辑字段 meta.arrowName（默认"情感指向"）。
  const DEFAULT_ARROW = [
    { key: "none", name: "无箭头", type: "none" },
    { key: "one", name: "单箭头", type: "one" },
    { key: "both", name: "双箭头", type: "both" },
  ];
  App.ARROW_STD = { none: "无箭头", one: "单箭头", both: "双箭头" };
  // 箭头类型固定收敛：只保留 none/one/both 三项，名称/类型以 key 为准（丢弃历史增删/改名）
  App.normalizeArrow = function (arr) {
    return ["none", "one", "both"].map((key) => ({ key: key, name: App.ARROW_STD[key], type: key }));
  };

  // 参考预设名单（用于开局引导/示例）——中性占位名，不含任何具体角色/世界观名单；
  // 引导说明文字放在欢迎弹窗文案里，不得混入名单数据（否则整句会被解析成一个角色名）
  const PRESET_TEXT = [
    "圆心: 甲",
    "1: 乙，丙",
    "2: 丁，戊，己",
    "3: 庚，辛",
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
      ui: { avatarMode: "both", showNames: true, slotMode: false, nodeR: NODE_R, night: false },
      meta: { filler: "", arrowName: "情感指向" }, // arrowName=箭头含义（图例/导出显示，可改）
    };
  }

  App.state = freshDoc();
  App.view = { s: 1, tx: 0, ty: 0 };
  App.selCharId = null; // 当前选中角色
  App.linkSource = null; // 连线起点
  App.eraser = false; // 删线模式
  App.pendingLinkDel = null; // 删线两段式：已选中待二次确认的连线 id
  App.brush = { bottom: null, top: null, arrow: "none" };
  App.dragGhost = null; // {x1,y1,x2,y2,layer,color}
  App.saved = false;
  App.hist = { u: [], r: [] };
  App.HIST_MAX = 80;

  // 当前角色圆圈半径（ui.nodeR，默认 18；越界/异常回落默认值）
  App.nodeR = function () {
    const v = App.state && App.state.ui ? Number(App.state.ui.nodeR) : 0;
    if (!v || v < NODE_R_MIN) return NODE_R;
    return Math.min(NODE_R_MAX, Math.round(v));
  };

  // 夜间模式：只改「显示」，不改用户设置的 state.bg 数据（切回日间原样恢复）
  const NIGHT_BG = "#1c1c1e";
  // 画布/导出应显示的背景色：始终用用户设定的背景色 state.bg。
  // 夜间模式只改 UI 外壳（CSS body.night），既不染画板也不染导出图。
  App.displayBg = function () {
    return (App.state && App.state.bg) ? App.state.bg : "#ffffff";
  };

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
    const ringDef = App.state.rings[ring - 1];
    const wantSlots = App.state.ui.slotMode && ringDef && ringDef.slots && ringDef.slots >= 1;
    const sl = (opts && opts.slots) || (wantSlots ? Math.max(list.length, ringDef.slots) : null);
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
    if (opts && opts.anchor) {
      // 锚定最靠上角色（angle 距 -PI/2 最近者；angle=null 视作 -PI/2），
      // 令其 angle=-PI/2，其余按相对原角度顺序向后等分，不做整圈旋转
      let ai = 0;
      let aBest = Infinity;
      list.forEach((c, i) => {
        const ae = c.angle == null ? -Math.PI / 2 : c.angle;
        let d = Math.abs(ae - -Math.PI / 2) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < aBest) { aBest = d; ai = i; }
      });
      const anchor = list[ai];
      const a0 = anchor.angle == null ? -Math.PI / 2 : anchor.angle;
      const sorted = list
        .map((c) => ({
          c,
          isAnchor: c === anchor,
          rel: App.normAngle((c.angle == null ? -Math.PI / 2 : c.angle) - a0),
        }))
        .sort((p, q) => {
          if (p.isAnchor) return -1;
          if (q.isAnchor) return 1;
          return p.rel - q.rel;
        });
      sorted.forEach((it, i) => {
        it.c.angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        it.c.slot = null;
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

  // 平均排布（全部圈，各圈锚定最靠上角色，不整圈旋转）
  App.evenAll = function () {
    const maxRing = Math.max(0, ...App.state.chars.map((c) => c.ring));
    for (let r = 1; r <= maxRing; r++) App.distributeRing(r, { anchor: true });
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

  // 删除轨道：无人直删；有人并入半径最近的相邻圈（等距默认向内），
  // 移入角色按原角度尽量贴原位，重叠再均分；其余圈半径不动、不自动收拢。第 1 圈不可删。
  App.deleteRing = function (ringNo) {
    const st = App.state;
    ringNo = Math.floor(Number(ringNo));
    if (!(ringNo >= 2)) throw new Error("第 1 圈不可删除");
    if (ringNo > st.rings.length) return;
    const idx = ringNo - 1;
    const r0 = st.rings[idx].rad;
    // 最近邻轨道圈（等距默认向内）
    const hasPrev = idx - 1 >= 0;
    const hasNext = idx + 1 < st.rings.length;
    let target;
    if (!hasNext) target = ringNo - 1;
    else if (!hasPrev) target = ringNo + 1;
    else {
      const dPrev = Math.abs(st.rings[idx - 1].rad - r0);
      const dNext = Math.abs(st.rings[idx + 1].rad - r0);
      target = dPrev <= dNext ? ringNo - 1 : ringNo + 1;
    }
    const shiftDown = (r) => (r > ringNo ? r - 1 : r);
    const targetNew = shiftDown(target); // 删除后的新圈号
    st.rings.splice(idx, 1);             // 移除本圈；其余圈半径不动（不自动收拢）
    const movers = [];
    st.chars.forEach((c) => {
      if (c.ring === ringNo) { c.ring = targetNew; c.slot = null; movers.push(c); }
      else if (c.ring > ringNo) c.ring = c.ring - 1;
    });
    if (movers.length) {
      // 并入后任意相邻角距 < 两圆安全间距对应弧度 → 均分重排（锚最靠上，不整圈旋转）
      const rad = App.radiusFor(targetNew);
      const minGap = (2 * (App.nodeR() + 4)) / Math.max(40, rad);
      const list = App.charsOnRing(targetNew);
      const sorted = list
        .map((c) => (c.angle == null ? -Math.PI / 2 : App.normAngle(c.angle)))
        .sort((a, b) => a - b);
      let crowded = false;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted.length < 2) break;
        const j = (i + 1) % sorted.length;
        let d = Math.abs(sorted[j] - sorted[i]);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < minGap) { crowded = true; break; }
      }
      if (crowded) App.distributeRing(targetNew, { anchor: true });
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
    const ringDef = App.state.rings[best - 1];
    if (App.state.ui.slotMode && ringDef && ringDef.slots && ringDef.slots >= 1) {
      // 槽位模式：吸附到最近的空闲槽，避免重叠
      const sl = Math.max(1, ringDef.slots);
      const occ = new Set(
        App.charsOnRing(best).filter((x) => x.id !== c.id).map((x) => x.slot).filter((s) => s != null)
      );
      let bestSlot = -1, bestD = Infinity;
      for (let s = 0; s < sl; s++) {
        if (occ.has(s)) continue;
        const sa = -Math.PI / 2 + (s * 2 * Math.PI) / sl;
        const d = Math.abs(App.normAngle(ang - sa));
        if (d < bestD) { bestD = d; bestSlot = s; }
      }
      if (bestSlot === -1) bestSlot = 0; // 全满兜底
      c.slot = bestSlot;
      c.angle = -Math.PI / 2 + (bestSlot * 2 * Math.PI) / sl;
    } else {
      // 自由模式（槽位关）：角色停在松手的角度，不做整圈均分 —— 允许同一圈上不规则间距
      c.angle = ang;
      c.slot = null;
    }
    if (wasCenter && best !== 0) { /* 圆心留空 */ }
    computeLayout();
  };

  // 连线操作
  // 底层粗线按「无向对」唯一（A-B 只有一条，后画覆盖）；
  // 顶层细线按「有向对」去重——A→B 与 B→A 两条单箭头可共存（各自可配不同关系色），同向则后画覆盖。
  function pairKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
  function dirKey(a, b) { return a + "→" + b; }
  function linkUniqKey(k) {
    if (k.layer === "top") return "top|" + dirKey(k.src, k.dst);
    return "bottom|" + pairKey(k.src, k.dst);
  }
  App.findBottomLink = function (a, b) {
    return App.state.links.find((k) => k.layer === "bottom" && pairKey(k.src, k.dst) === pairKey(a, b));
  };
  App.addLink = function (src, dst, layer, ckey, arrow) {
    if (!ckey) return null;
    const key = layer === "top" ? dirKey(src, dst) : pairKey(src, dst);
    const exist = App.state.links.find(
      (k) => k.layer === layer && (layer === "top" ? dirKey(k.src, k.dst) === key : pairKey(k.src, k.dst) === key)
    );
    if (exist) {
      exist.ckey = ckey;
      exist.arrow = arrow || "none";
      return exist;
    }
    const k = {
      id: App.uid("l"), src, dst, layer, ckey, arrow: arrow || "none",
    };
    App.state.links.push(k);
    return k;
  };
  // 连线记录编辑：改箭头类型 / 翻转方向（仅顶层有向可翻转）
  App.getLink = function (id) { return App.state.links.find((k) => k.id === id); };
  App.setLinkArrow = function (id, val) {
    const k = App.getLink(id); if (!k) return;
    App.act(() => { k.arrow = val; });
  };
  App.flipLink = function (id) {
    const k = App.getLink(id); if (!k || k.layer !== "top") return;
    App.act(() => { const t = k.src; k.src = k.dst; k.dst = t; });
  };
  // 收敛旧草稿/旧快照：bottom 无向对仅一条、top 同 (src,dst) 仅一条（均保最后画的那条）
  App.normalizeLinks = function (links) {
    const out = [];
    const seen = {};
    (links || []).forEach((k) => {
      if (!k || !k.src || !k.dst) return;
      const key = linkUniqKey(k);
      if (seen[key] != null) out[seen[key]] = null;
      seen[key] = out.length;
      out.push(k);
    });
    return out.filter(Boolean);
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

  // 序列化/反序列化（JSON 文本往返）。快照不含头像 base64。
  App.serialize = function () {
    const doc = Object.assign({}, App.state);
    // 只做 chars 副本去头像，避免整个 state 深克隆携带 base64
    doc.chars = App.state.chars.map((c) => Object.assign({}, c, { avatar: null }));
    return JSON.stringify({ type: "xhs-cp-v1", doc }, null, 2);
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
        like: c.like || null, avatar: null, x: 0, y: 0,
      })),
      links: (doc.links || []).map((k) => ({
        id: k.id || App.uid("l"), src: k.src, dst: k.dst,
        layer: k.layer === "bottom" ? "bottom" : "top",
        ckey: k.ckey, arrow: k.arrow || "none",
      })),
      tables: {
        bottom: (doc.tables && doc.tables.bottom && doc.tables.bottom.length)
          ? doc.tables.bottom.map((r) => ({ key: r.key, name: r.name, color: r.color, hidden: !!r.hidden }))
          : DEFAULT_BOTTOM.map((x) => ({ ...x })),
        top: (doc.tables && doc.tables.top && doc.tables.top.length)
          ? doc.tables.top.map((r) => ({ key: r.key, name: r.name, color: r.color, hidden: !!r.hidden }))
          : DEFAULT_TOP.map((x) => ({ ...x })),
        arrow: App.normalizeArrow(doc.tables && doc.tables.arrow),
      },
      ui: Object.assign({}, fresh.ui, doc.ui || {}),
      meta: {
        filler: doc.meta && doc.meta.filler ? String(doc.meta.filler) : "",
        arrowName: doc.meta && doc.meta.arrowName ? String(doc.meta.arrowName) : "情感指向",
      },
    };
    // 收敛旧快照里同对多条 top/bottom（top 保留 A→B 与 B→A 两个方向各一条）
    App.state.links = App.normalizeLinks(App.state.links);
    ensureCenterUnique(null);
    computeLayout();
  };

  // 填表人（导出图/发布署名用）
  App.getFiller = function () {
    return (App.state.meta && App.state.meta.filler) || "";
  };

  // 顶栏合成标题：「填表人 的 图名」；无填表人时仅显示图名
  App.getTitleText = function () {
    const t = String((App.state && App.state.title) || "未命名关系图");
    const f = App.getFiller();
    return f ? f + " 的 " + t : t;
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
    App.selCharId = null; App.linkSource = null; App.dragGhost = null; App.pendingLinkDel = null;
    computeLayout();
    App.notifyChanged();
  };
  App.redo = function () {
    if (!App.hist.r.length) return;
    App.hist.u.push(clone());
    App.state = App.hist.r.pop();
    App.selCharId = null; App.linkSource = null; App.dragGhost = null; App.pendingLinkDel = null;
    computeLayout();
    App.notifyChanged();
  };

  // 统一的“变更一次”入口：记录历史 + 渲染 + 自动保存
  App.act = function (fn) {
    App.commitHist();
    const r = fn();
    computeLayout();
    App.notifyChanged();
    return r; // 透传变更结果（供调用方提示）
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
    App.selCharId = null; App.linkSource = null; App.dragGhost = null; App.eraser = false; App.pendingLinkDel = null;
    App.hist = { u: [], r: [] };
    App.notifyChanged();
  };

  // 表项显隐（关闭的项不进入画布图例与导出图例卡，连线本身保留）
  App.toggleTableHidden = function (layer, key) {
    const r = App.state.tables[layer].find((x) => x.key === key);
    if (!r) return false;
    r.hidden = !r.hidden;
    return !!r.hidden;
  };

  App.NODE_R = NODE_R;
  App.NODE_R_MIN = NODE_R_MIN;
  App.NODE_R_MAX = NODE_R_MAX;
  App.SLOT_MIN = 6; // 开启槽位时每圈默认槽位保底数（不足 6 按 6 算，人数更多则按人数）
  App.INNER_R = INNER_R;
  App.PRESET_TEXT = PRESET_TEXT;
  App.computeLayout = computeLayout;
})();
