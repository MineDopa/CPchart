/* cpc-core.js —— CPC 数据层 v2（语义冻结 · 2026-09-11）
 *
 * 本文件是三层结构的最底层，只描述语义：
 *   谁（角色）/ 什么关系（连线）/ 多喜欢（喜好度）/ 什么时间（预留）
 *
 * 不含坐标、不碰 DOM、不依赖任何宿主全局 —— 换渲染方案或换宿主环境时本文件零改动。
 *
 *   [数据层] cpc-core.js  语义定义 · 超点键 · 预设样式表        ← 本文件
 *   [投影层] cpc-view.js  决定「现在看哪一块」，很薄
 *   [渲染层] render.js    算坐标画线（可整体替换，不影响上面两层）
 *
 * 铁律：本文件任何函数都不得写入 x / y 等由渲染推导出的字段。
 */
(function (root) {
  "use strict";
  var Core = (root.CPC = root.CPC || {});

  Core.VER = 2;

  /* ============================================================
   * 一、超点与超点键（键是身份，决定「同一条」还是「另一条」）
   * ============================================================
   * 四个命名空间互不合并：
   *   atom  单人超点（一个角色本身）
   *   group 命名组合（只放 +，v1.0 不开放）
   *   line  无向双人超点（甲*乙，不区分谁先谁后）
   *   dir   有向双人超点（甲->乙，区分方向）
   *
   * 三人及以上超点属 v3.0 范围，此处只保证键函数可扩展。
   */
  Core.atomKey = function (name) { return "atom:" + String(name == null ? "" : name); };

  // 无序对：内部按字典序固定，保证 (a,b) 与 (b,a) 同键
  Core.uniqPair = function (a, b) {
    var x = String(a == null ? "" : a), y = String(b == null ? "" : b);
    return x < y ? x + "|" + y : y + "|" + x;
  };
  Core.lineKey = function (a, b) { return "line:" + Core.uniqPair(a, b); };
  // 有序对：方向参与身份
  Core.dirKey = function (a, b) { return "dir:" + String(a) + ">" + String(b); };
  Core.groupKey = function (members) {
    return "group:" + (members || []).map(String).sort().join("+");
  };

  /* 连线的去重键：层 × 超点类型 × 有序/无序
   * 同一对角色间可同时存在三条记录：一条 line（无向）+ 两条 dir（各一方向）。
   * 同键则后者覆盖前者（幂等改值），不产生第二条。
   */
  Core.linkKey = function (k) {
    if (!k || k.src == null || k.dst == null) return "";
    var layer = k.layer === "top" ? "top" : "bottom";
    var isDir = k.type === "dir";
    var base = isDir
      ? String(k.src) + ">" + String(k.dst)
      : Core.uniqPair(k.src, k.dst);
    return layer + "|" + (isDir ? "dir" : "line") + "|" + base;
  };

  /* 旧数据无 type 字段时的推断（保持 v0.14 行为不变）：
   *   top 层历来是按有向对去重 → dir
   *   bottom 层历来是按无序对去重 → line
   */
  Core.linkTypeOf = function (k) {
    if (k && k.type === "dir") return "dir";
    if (k && k.type === "line") return "line";
    return k && k.layer === "top" ? "dir" : "line";
  };

  /* 连线集收敛：同键保留最后一条 */
  Core.dedupeLinks = function (links) {
    var seen = {}, out = [];
    (links || []).forEach(function (k) {
      if (!k || k.src == null || k.dst == null) return;
      var key = Core.linkKey(k);
      if (seen[key] != null) out[seen[key]] = null;
      seen[key] = out.length;
      out.push(k);
    });
    return out.filter(Boolean);
  };

  /* ============================================================
   * 二、预设样式表（程序内置，文件里无需声明）
   * ============================================================
   * 字段：逻辑 / 颜色 / 线宽 / 描边 —— 四字段齐全，逐字段可覆盖。
   *
   * v1.0 生效范围：只消费「颜色」。
   *   线宽 / 描边 / 逻辑词三者照常解析并存储，但不产生画面差异，
   *   待后续版本启用（数据不丢，届时无需改格式）。
   */
  Core.LAYER_OF_LOGIC = { favor: "bottom", relation: "top" };
  Core.RESERVED_LAYER = "reserved";

  function layerOfLogic(logic) {
    return Core.LAYER_OF_LOGIC[logic] || Core.RESERVED_LAYER;
  }
  Core.layerOfLogic = layerOfLogic;

  // [词, 逻辑, 颜色, 线宽, 描边]
  var PRESET_ROWS = [
    // —— 强度档（favor → 底层粗线）
    ["本命", "favor", "#d32f2f", "4px", "solid"],
    ["很喜欢", "favor", "#f57c00", "4px", "solid"],
    ["路好", "favor", "#fbc02d", "3px", "solid"],
    ["不吃", "favor", "#222222", "3px", "solid"],
    // —— 定义档（relation → 顶层细线）
    ["爱情", "relation", "#ec407a", "2px", "solid"],
    ["友情", "relation", "#43a047", "2px", "solid"],
    ["亲情", "relation", "#1976d2", "2px", "solid"],
    ["QPR", "relation", "#8e24aa", "2px", "solid"],
    // —— 逻辑档（v1.0 只存不显）
    ["commit", "commit", "#888888", "1px", "dotted"],
    ["branch", "branch", "#AA6633", "1px", "dashed"],
    ["merge", "merge", "#3366AA", "1px", "solid"],
    ["rebase", "rebase", "#AA3366", "1px", "dashed"],
    ["init", "init", "#666666", "1px", "dotted"],
    ["reset", "reset", "#666666", "1px", "dashed"],
    ["revert", "revert", "#666666", "1px", "dotted"]
  ];

  Core.PRESET = {};
  Core.PRESET_ORDER = [];
  PRESET_ROWS.forEach(function (r) {
    Core.PRESET[r[0]] = {
      logic: r[1], color: r[2], lw: r[3], stroke: r[4], layer: layerOfLogic(r[1])
    };
    Core.PRESET_ORDER.push(r[0]);
  });

  // 逻辑白名单（v1 语法接受，共 9 个）：relation / favor + §6 全 7 词
  Core.LOGIC_WHITELIST = ["relation", "favor", "commit", "branch", "merge", "rebase", "init", "reset", "revert"];
  // 描边枚举
  Core.STROKE_ENUM = ["solid", "dashed", "dotted", "double", "hidden"];
  Core.STROKE_DASH = { solid: "none", dashed: "6 5", dotted: "2 4", double: "none", hidden: "none" };
  // 线宽表达式：数字 + 单位（px 为存储基准）
  Core.LW_RE = /^(\d+(?:\.\d+)?)(px|rem|em|%)?$/;

  Core.isKnownWord = function (name) { return !!Core.PRESET[name]; };
  Core.layerByName = function (name) {
    var p = Core.PRESET[name];
    return p ? p.layer : null;
  };

  /* ============================================================
   * 三、样式解析：字段级继承
   * ============================================================
   * 优先级：文档 tables 里的显式声明 > 预设表 > 兜底值
   * 省略的字段一律回落，不整行替换。
   */
  Core.findRow = function (doc, name) {
    if (!doc || !doc.tables) return null;
    var b = doc.tables.bottom || [], t = doc.tables.top || [];
    for (var i = 0; i < b.length; i++) if (b[i] && b[i].name === name) return b[i];
    for (var j = 0; j < t.length; j++) if (t[j] && t[j].name === name) return t[j];
    return null;
  };

  Core.styleOf = function (doc, name) {
    var p = Core.PRESET[name] || null;
    var row = Core.findRow(doc, name);
    var logic = (row && row.logic) || (p && p.logic) || "relation";
    var defLw = logic === "favor" ? "4px" : "2px";   // 自建词兜底：强度档粗、定义档细
    var color = (row && row.color) || (p && p.color) || "#666666";
    return {
      logic: logic,
      color: color,
      lw: (row && row.lw) || (p && p.lw) || defLw,
      stroke: (row && row.stroke) || (p && p.stroke) || "solid",
      layer: layerOfLogic(logic),
      // v1.0 渲染只读这一个字段
      renderColor: color
    };
  };

  /* 按词取所在表（bottom / top）；未知词按预设表判断，仍未知则落顶层。
   * 返回 "bottom" | "top" | "reserved"
   */
  Core.tableOfName = function (doc, name) {
    var row = Core.findRow(doc, name);
    if (row) {
      var lb = (doc.tables.bottom || []).indexOf(row) >= 0;
      return lb ? "bottom" : "top";
    }
    var p = Core.PRESET[name];
    if (p) return p.layer;
    return "top"; // 自建词兜底：多数是关系定义
  };

  /* 确保某词在文档里有一行（不存在则按预设或声明新建）。返回该行。 */
  Core.ensureRow = function (doc, name, decl) {
    var row = Core.findRow(doc, name);
    if (row) { if (decl) Object.assign(row, decl); return row; }
    var table = Core.tableOfName(doc, name);
    if (table === "reserved") table = "top"; // 预留逻辑词不进画布两表，此处仍给个落点
    var st = Core.styleOf(doc, name);
    row = {
      key: Core.uid((table === "bottom" ? "b_" : "t_")),
      name: name,
      color: st.color,
      lw: st.lw,
      stroke: st.stroke,
      logic: st.logic,
      hidden: false
    };
    if (decl) Object.assign(row, decl);
    doc.tables[table].push(row);
    return row;
  };

  Core.uid = function (p) {
    return (p || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ============================================================
   * 四、文档构造
   * ============================================================
   * 表头三元素：填表人 / 作品（IP>作品名）/ 建表时间
   * —— 三个地位平等的查询项，用于未来的跨表比对与表格库检索。
   *    v1.0 只存储，不做检索。
   */
  Core.DEFAULT_UI = {
    avatarMode: "both", showNames: true, slotMode: false, nodeR: 18,
    night: false, charMode: false, paintMode: "link",
    thinW: 2.2, thinDash: false, layoutHint: false
  };

  Core.blank = function () {
    var doc = {
      ver: Core.VER,
      title: "未命名关系图",
      filler: "",                       // 填表人
      work: { ip: "", name: "" },       // 作品：IP > 作品名
      created: "",                      // 建表时间（YYYY-MM 或 YYYY-MM-DD）
      bg: "#ffffff",
      rings: [{ rad: 150, slots: null }, { rad: 270, slots: null }],
      chars: [],
      links: [],
      tables: { bottom: [], top: [], arrow: [] },
      // 图例三组：v1.0 全部存储，但不渲染分组标题（只画出词条本身）
      legend: { relation: [], favor: [], pointing: [] },
      ui: Object.assign({}, Core.DEFAULT_UI),
      meta: { arrowName: "情感指向" }
    };
    // 预设四词 + 四词入表（等于内置默认，文件里不必写）
    Core.PRESET_ORDER.forEach(function (n) {
      var p = Core.PRESET[n];
      if (p.layer === "bottom" || p.layer === "top") {
        doc.tables[p.layer].push({
          key: Core.uid(p.layer === "bottom" ? "b_" : "t_"),
          name: n, color: p.color, lw: p.lw, stroke: p.stroke,
          logic: p.logic, hidden: false
        });
      }
    });
    doc.tables.arrow = [
      { key: "none", name: "无箭头", type: "none" },
      { key: "one", name: "单箭头", type: "one" },
      { key: "both", name: "双箭头", type: "both" }
    ];
    return doc;
  };

  /* ============================================================
   * 五、旧数据归一（读旧草稿 / 旧快照 / 旧文本时调用）
   * ============================================================
   * 目标：任何历史形态都能升到当前语义，且不抛错。
   */
  Core.normalizeDoc = function (raw) {
    var fresh = Core.blank();
    var doc = raw && typeof raw === "object" ? raw : {};
    var out = {
      ver: Core.VER,
      title: typeof doc.title === "string" && doc.title ? doc.title : fresh.title,
      filler: "",
      work: { ip: "", name: "" },
      created: "",
      bg: doc.bg || fresh.bg,
      rings: Array.isArray(doc.rings) && doc.rings.length
        ? doc.rings.map(function (r) {
            return { rad: Number(r && r.rad) || 150, slots: (r && r.slots) || null };
          })
        : fresh.rings,
      chars: (doc.chars || []).map(function (c) {
        return {
          id: c.id || Core.uid("c"),
          name: c.name || "?",
          ring: Number(c.ring) || 0,
          angle: c.angle == null ? null : Number(c.angle),
          slot: c.slot == null ? null : c.slot,
          like: c.like || null,
          avatar: c.avatar || null
        };
      }),
      links: Core.dedupeLinks((doc.links || []).map(function (k) {
        return {
          id: k.id || Core.uid("l"),
          src: k.src, dst: k.dst,
          layer: k.layer === "top" ? "top" : "bottom",
          type: Core.linkTypeOf(k),
          ckey: k.ckey,
          arrow: k.arrow || "none"
        };
      })),
      tables: { bottom: [], top: [], arrow: [] },
      legend: { relation: [], favor: [], pointing: [] },
      ui: Object.assign({}, fresh.ui, doc.ui || {}),
      meta: { arrowName: (doc.meta && doc.meta.arrowName) || "情感指向" }
    };

    // 填表人：旧位置 meta.filler → 新位置顶层 filler
    out.filler = String(
      doc.filler || (doc.meta && doc.meta.filler) || ""
    ).slice(0, 12);
    if (doc.work && typeof doc.work === "object") {
      out.work = { ip: String(doc.work.ip || ""), name: String(doc.work.name || "") };
    }
    out.created = String(doc.created || "");

    // 表行：补齐 lw / stroke / logic 三字段（缺则回落预设）
    ["bottom", "top"].forEach(function (layer) {
      var src = (doc.tables && doc.tables[layer]) || [];
      out.tables[layer] = src.map(function (r) {
        var p = Core.PRESET[r.name] || null;
        return {
          key: r.key || Core.uid(layer === "bottom" ? "b_" : "t_"),
          name: r.name,
          color: r.color || (p && p.color) || "#666666",
          lw: r.lw || (p && p.lw) || (layer === "bottom" ? "4px" : "2px"),
          stroke: r.stroke || (p && p.stroke) || "solid",
          logic: r.logic || (p && p.logic) || (layer === "bottom" ? "favor" : "relation"),
          hidden: !!r.hidden
        };
      });
      if (!out.tables[layer].length) {
        // 空表回落预设（仅限两档的标准词）
        fresh.tables[layer].forEach(function (row) {
          if (Core.PRESET[row.name] && Core.PRESET[row.name].layer === layer) {
            out.tables[layer].push(Object.assign({}, row));
          }
        });
      }
    });
    out.tables.arrow = fresh.tables.arrow.map(function (x) { return Object.assign({}, x); });

    if (doc.legend && typeof doc.legend === "object") {
      out.legend = {
        relation: Array.isArray(doc.legend.relation) ? doc.legend.relation.slice() : [],
        favor: Array.isArray(doc.legend.favor) ? doc.legend.favor.slice() : [],
        pointing: Array.isArray(doc.legend.pointing) ? doc.legend.pointing.slice() : []
      };
    }
    return out;
  };

  /* 深拷贝（纯数据，无函数无 DOM） */
  Core.clone = function (doc) { return JSON.parse(JSON.stringify(doc)); };

  /* ============================================================
   * 六、便捷访问
   * ============================================================ */
  Core.charByName = function (doc, name) {
    var list = (doc && doc.chars) || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  };
  Core.charById = function (doc, id) {
    var list = (doc && doc.chars) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
  Core.centerChar = function (doc) {
    var list = (doc && doc.chars) || [];
    for (var i = 0; i < list.length; i++) if (list[i].ring === 0) return list[i];
    return null;
  };
  Core.arrowType = function (k) { return (k && k.arrow) || "none"; };

  /* 按表行 key 反查词名（连线导出时用） */
  Core.nameOfRowById = function (doc, key) {
    if (!doc || !doc.tables || !key) return "";
    var b = doc.tables.bottom || [], t = doc.tables.top || [];
    for (var i = 0; i < b.length; i++) if (b[i] && b[i].key === key) return b[i].name;
    for (var j = 0; j < t.length; j++) if (t[j] && t[j].key === key) return t[j].name;
    return "";
  };

  /* 名字长度上限（按字符数，中文一字算一） */
  Core.NAME_MAX = 20;
  Core.clipName = function (s, max) {
    return Array.from(String(s == null ? "" : s)).slice(0, max || Core.NAME_MAX).join("");
  };

  // 名字不纯数字（纯数字会与圈号/行号打架）
  Core.isPureNumber = function (s) { return /^[0-9\s]+$/.test(String(s == null ? "" : s)); };

  if (typeof module !== "undefined" && module.exports) module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
