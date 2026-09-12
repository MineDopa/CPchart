/* cpc-dsl.js —— CPC 语言解析器 / 导出器（块语法 · v1.0 范围）
 *
 * 依据：格式说明v5.1.txt
 *   支持块： #标题{}  .布局{}  @关系{}  !喜好 原子{}  !喜好 关系{}  .样式{}  .图例{}
 *   暂不支持：.时间轴{}  @原子{}  @组合{}  !喜好 组合{}  （解析时跳过并记 warning，不报错）
 *
 * 本文件只做「文本 ←→ 语义文档」的换算，不碰 DOM、不碰坐标。
 *
 * 分两步走，职责清楚：
 *   D.parse(text)         文本 → doc（纯解析，产出独立文档）
 *   D.merge(base, parsed) 解析结果并入既有文档（已有角色保位、连线追加覆盖）
 */
(function (root) {
  "use strict";
  var Core = root.CPC;
  if (!Core) throw new Error("cpc-dsl 依赖 cpc-core，请先加载 cpc-core.js");

  var D = {};
  Core.dsl = D;

  /* ============================================================
   * 0. 基础小工具
   * ============================================================ */
  function isQuote(c) { return c === '"' || c === "'"; }

  function stripQuotes(s) {
    var t = String(s == null ? "" : s).trim();
    if (t.length >= 2) {
      var a = t[0], b = t[t.length - 1];
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) return t.slice(1, -1).trim();
    }
    return t;
  }

  function lineOf(s, idx) {
    var n = 1;
    for (var i = 0; i < idx && i < s.length; i++) if (s[i] === "\n") n++;
    return n;
  }

  /* 引号外分段：对引号外的片段套用 f，引号内原样保留 */
  function mapOutsideQuotes(s, f) {
    var out = "", i = 0, n = s.length;
    while (i < n) {
      var c = s[i];
      if (isQuote(c)) {
        var j = s.indexOf(c, i + 1);
        if (j < 0) { out += s.slice(i); break; }
        out += s.slice(i, j + 1);
        i = j + 1;
      } else {
        var k = i;
        while (k < n && !isQuote(s[k])) k++;
        out += f(s.slice(i, k));
        i = k;
      }
    }
    return out;
  }

  /* 引号 + 方括号感知的切分 */
  function splitAware(s, seps, opts) {
    var incBracket = !!(opts && opts.bracket);
    var out = [], cur = "", inQ = "", depth = 0;
    var str = String(s == null ? "" : s);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (inQ) { cur += ch; if (ch === inQ) inQ = ""; continue; }
      if (isQuote(ch)) { inQ = ch; cur += ch; continue; }
      if (incBracket) {
        if (ch === "[") { depth++; cur += ch; continue; }
        if (ch === "]") { depth = Math.max(0, depth - 1); cur += ch; continue; }
        if (depth > 0) { cur += ch; continue; }
      }
      if (seps.indexOf(ch) >= 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  /* 引号感知的「找第一处子串」 */
  function splitOnce(s, sep) {
    var str = String(s == null ? "" : s), inQ = "";
    for (var i = 0; i + sep.length <= str.length; i++) {
      var ch = str[i];
      if (inQ) { if (ch === inQ) inQ = ""; continue; }
      if (isQuote(ch)) { inQ = ch; continue; }
      if (str.substr(i, sep.length) === sep) {
        return [str.slice(0, i), str.slice(i + sep.length)];
      }
    }
    return null;
  }
  function hasOutside(s, sep) { return splitOnce(s, sep) !== null; }

  /* ============================================================
   * 1. 归一化（§1.1）
   * ============================================================ */
  var CH_MAP = [
    [/[\uFF1B]/g, ";"],            // ；
    [/[\uFF0C\u3001]/g, ","],       // ，、
    [/[\uFF1A]/g, ":"],            // ：
    [/[\uFF01]/g, "!"],            // ！
    [/[\uFF1F]/g, "?"],            // ？
    [/[\uFF3B]/g, "["], [/[\uFF3D]/g, "]"],
    [/[\uFF5B]/g, "{"], [/[\uFF5D]/g, "}"],
    [/[\u3010]/g, "["], [/[\u3011]/g, "]"],
    [/[\uFF1C]/g, "<"], [/[\uFF1E]/g, ">"],
    [/[\uFF0F]/g, "/"],
    [/[\uFF5E]/g, "~"]
  ];
  var DIRECT = [
    [/[\u2192\u2794\u279C\u279E\u21D2\u27F6\u27A1]/g, "->"],  // → ➔ ➜ ➞ ⇒ ⟶ ➡
    [/[\u2190\u21D0\u27F5]/g, "<-"],                          // ← ⇐ ⟵
    [/[\u2194\u21C4\u21C6]/g, "<->"],                         // ↔ ⇄ ⇆
    [/[\u2716\u2715\u2573\u00D7]/g, "*"],                     // ✖ ✕ ╳ ×
    [/[\u2795\uFF0B]/g, "+"],                                 // ➕ ＋
    [/[\uFF0D\u2014\u2013]/g, "-"],                           // － — –
    [/[\uFF08]/g, "("], [/[\uFF09]/g, ")"]
  ];

  D.normalize = function (text) {
    var s = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    s = s.replace(/[\uFE0E\uFE0F]/g, "");                       // 变体选择符（➡️ 拆成 ➡）
    s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"); // 全角引号并入半角
    s = mapOutsideQuotes(s, function (seg) {
      seg = seg.replace(/\/\*[\s\S]*?\*\//g, " ");               // 注释块
      return seg;
    });
    s = mapOutsideQuotes(s, function (seg) {
      CH_MAP.forEach(function (r) { seg = seg.replace(r[0], r[1]); });
      DIRECT.forEach(function (r) { seg = seg.replace(r[0], r[1]); });
      return seg;
    });
    return s;
  };

  /* ============================================================
   * 2. 块扫描
   * ============================================================ */
  function findOpen(s, from) {
    var inQ = "";
    for (var i = from; i < s.length; i++) {
      var ch = s[i];
      if (inQ) { if (ch === inQ) inQ = ""; continue; }
      if (isQuote(ch)) { inQ = ch; continue; }
      if (ch === "{") return i;
      if (ch === "}") return -1;      // 越过闭合再找 '{' 说明头部有问题
    }
    return -1;
  }

  function matchBrace(s, openIdx) {
    var depth = 0, inQ = "";
    for (var i = openIdx; i < s.length; i++) {
      var ch = s[i];
      if (inQ) { if (ch === inQ) inQ = ""; continue; }
      if (isQuote(ch)) { inQ = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  var SIGILS = "#.@!";

  D.scan = function (src) {
    var blocks = [], errs = [], s = src, i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "\n" || c === " " || c === "\t") { i++; continue; }
      if (SIGILS.indexOf(c) < 0) {
        // 块外的裸内容：跳过该行（忽略，不报错）
        var e = s.indexOf("\n", i);
        i = e < 0 ? s.length : e + 1;
        continue;
      }
      var h = findOpen(s, i + 1);
      if (h < 0) {
        errs.push({ code: "E101", line: lineOf(s, i), msg: "块头缺少 {：" + s.slice(i, i + 24).split("\n")[0] });
        var le = s.indexOf("\n", i);
        i = le < 0 ? s.length : le + 1;
        continue;
      }
      var close = matchBrace(s, h);
      if (close < 0) {
        errs.push({ code: "E102", line: lineOf(s, i), msg: "块未闭合（缺少 }）" });
        break;
      }
      blocks.push({
        sigil: c,
        head: s.slice(i + 1, h).trim(),
        arg: "",
        body: s.slice(h + 1, close),
        line: lineOf(s, i),
        pos: i
      });
      i = close + 1;
    }
    // 拆块头：`!喜好 关系` → name=喜好 arg=关系；`.时间轴 展示[main]` → name=时间轴 arg=展示[main]
    blocks.forEach(function (b) {
      var m = b.head.match(/^(\S+)\s*([\s\S]*)$/);
      if (!m) { b.name = ""; b.arg = ""; return; }
      b.name = m[1];
      b.arg = (m[2] || "").trim();
    });
    return { blocks: blocks, errs: errs };
  };

  /* ============================================================
   * 3. 块体条目切分
   * ============================================================ */
  /* 块体 → 条目列表。分号与换行等价（§1.3）；方括号内的逗号不参与切分。
     注意：逗号不是条目分隔符——它在「值列表」里才起作用，故不在此处切。 */
  function entries(body) {
    return splitAware(body, ";\n", { bracket: true })
      .map(function (t) { return t.trim(); })
      .filter(Boolean);
  }

  /* 条目 → { key, value }；无冒号则 key=null（裸值） */
  function splitEntry(item) {
    var p = splitOnce(item, ":");
    if (!p) return { key: null, value: item.trim() };
    return { key: p[0].trim(), value: p[1].trim() };
  }

  // 键名去引号并剥 ! 标记（前导为主，尾部容错——历史笔误形态）
  function normKey(k) {
    return stripQuotes(String(k).replace(/^[!！]/, "").replace(/[!！]$/, "").trim());
  }

  var KEYALIAS = {
    "标题": "title", "名字": "title", "名称": "title", "title": "title",
    "填表人": "filler", "filler": "filler", "作者": "filler",
    "作品": "work", "work": "work", "ip": "work",
    "时间": "created", "建表时间": "created", "created": "created"
  };

  var BLOCK_NAME = {
    "#": { "标题": "head", "title": "head", "head": "head" },
    ".": {
      "布局": "layout", "layout": "layout",
      "样式": "style", "style": "style",
      "图例": "legend", "legend": "legend",
      "时间轴": "timeline", "timeline": "timeline"
    },
    "@": {
      "关系": "relation", "relation": "relation",
      "原子": "atom", "atom": "atom",
      "组合": "group", "group": "group"
    },
    "!": { "喜好": "favor", "favor": "favor", "收藏": "favor" }
  };
  // `!喜好 关系` 的第二段
  var FAVOR_TARGET = {
    "原子": "atom", "atom": "atom",
    "关系": "relation", "relation": "relation",
    "组合": "group", "group": "group"
  };

  var STROKE_NAME = {
    "实线": "solid", "solid": "solid",
    "虚线": "dashed", "dashed": "dashed",
    "点线": "dotted", "dotted": "dotted",
    "双线": "double", "double": "double",
    "隐藏": "hidden", "hidden": "hidden"
  };
  var LOGIC_NAME = { "喜好": "favor", "关系": "relation", "favor": "favor", "relation": "relation" };

  var HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
  var LW_RE = /^(\d+(?:\.\d+)?)(px|rem|em|%)?$/;

  /* ============================================================
   * 4. 主解析
   * ============================================================ */
  D.parse = function (text) {
    var res = { doc: Core.blank(), errs: [], warns: [], stats: { chars: 0, links: 0, styles: 0, skipped: [], autoWords: [] } };
    var norm = D.normalize(text);
    var sc = D.scan(norm);
    res.errs = res.errs.concat(sc.errs);

    // 词 → 期望层（由使用处决定：@关系 → top，!喜好 → bottom）
    var layerWish = {};   // name -> "top" | "bottom"
    var styleDecl = {};   // name -> {logic,color,lw,stroke}
    var relEdges = [];    // {word, edges:[...]}
    var favEdges = [];
    var favAtoms = [];
    var head = { title: "", filler: "", work: "", created: "" };
    var layoutRows = [];
    var legendRaw = null;

    function wish(name, layer, line) {
      if (!name) return;
      // 预设词的层是固定的（本命/很喜欢/路好/不吃 恒为强度档，爱情/友情/亲情/QPR 恒为定义档）——
      // 写在哪一块都不改变它的归属，否则「本命」写进 @关系 会被拽到关系层，语义就错了
      var p = Core.PRESET[name];
      if (p && (p.layer === "bottom" || p.layer === "top")) { layerWish[name] = p.layer; return; }
      if (layerWish[name] && layerWish[name] !== layer) {
        res.errs.push({
          code: "E302", line: line,
          msg: "「" + name + "」同时出现在 " + layerWish[name] + " 与 " + layer + " 两层（底层槽名须唯一），按后者处理"
        });
      }
      layerWish[name] = layer;
    }

    sc.blocks.forEach(function (b) {
      var kind = BLOCK_NAME[b.sigil] && BLOCK_NAME[b.sigil][b.name];
      if (!kind) {
        res.warns.push({ code: "W400", line: b.line, msg: "未知块 " + b.sigil + b.name + "，已跳过" });
        return;
      }
      if (kind === "timeline" || kind === "atom" || kind === "group") {
        // v1.0 范围外：语法接受、内容跳过，不报错
        res.stats.skipped.push(b.sigil + b.name);
        return;
      }

      if (kind === "head") {
        entries(b.body).forEach(function (it) {
          var e = splitEntry(it);
          if (e.key == null) { if (!head.title) head.title = stripQuotes(e.value); return; }
          var k = KEYALIAS[normKey(e.key)];
          if (!k) return;                       // 未知表头字段：忽略
          head[k] = stripQuotes(e.value);
        });
        return;
      }

      if (kind === "layout") {
        entries(b.body).forEach(function (it) { layoutRows.push({ raw: it, line: b.line }); });
        return;
      }

      if (kind === "style") {
        entries(b.body).forEach(function (it) {
          var e = splitEntry(it);
          if (e.key == null) { res.errs.push({ code: "E203", line: b.line, msg: "样式行缺冒号：" + it }); return; }
          var name = stripQuotes(e.key);
          var decl = {};
          splitAware(e.value, ",", {}).map(stripQuotes).filter(Boolean).forEach(function (p) {
            if (HEX_RE.test(p)) { decl.color = p; return; }
            if (STROKE_NAME[p]) { decl.stroke = STROKE_NAME[p]; return; }
            if (Core.LOGIC_WHITELIST.indexOf(p) >= 0) { decl.logic = p; return; }
            if (LOGIC_NAME[p]) { decl.logic = LOGIC_NAME[p]; return; }
            var m = p.match(LW_RE);
            if (m) { decl.lw = m[1] + (m[2] || "px"); return; }
          });
          if (!decl.color && !decl.logic && !decl.lw && !decl.stroke) {
            res.errs.push({ code: "E203", line: b.line, msg: "样式行无有效字段：" + it });
            return;
          }
          styleDecl[name] = Object.assign(styleDecl[name] || {}, decl);
          if (decl.logic) wish(name, Core.layerOfLogic(decl.logic) === "bottom" ? "bottom" : "top", b.line);
          res.stats.styles++;
        });
        return;
      }

      if (kind === "legend") {
        legendRaw = b.body;
        return;
      }

      if (kind === "relation") {
        entries(b.body).forEach(function (it) {
          var e = splitEntry(it);
          if (e.key == null) { res.errs.push({ code: "E203", line: b.line, msg: "关系行缺冒号：" + it }); return; }
          var word = stripQuotes(e.key);
          wish(word, "top", b.line);
          relEdges.push({ word: word, edges: parseEdgeList(e.value, res, b.line, "relation") });
        });
        return;
      }

      if (kind === "favor") {
        var target = FAVOR_TARGET[b.arg.split(/\s+/)[0]] || "relation";
        if (target === "group") { res.stats.skipped.push("!喜好 组合"); return; }
        entries(b.body).forEach(function (it) {
          var e = splitEntry(it);
          if (e.key == null) { res.errs.push({ code: "E203", line: b.line, msg: "喜好行缺冒号：" + it }); return; }
          var word = stripQuotes(e.key);
          wish(word, "bottom", b.line);
          if (target === "atom") {
            favAtoms.push({ word: word, names: parseAtomList(e.value, res, b.line) });
          } else {
            favEdges.push({ word: word, edges: parseEdgeList(e.value, res, b.line, "favor") });
          }
        });
        return;
      }
    });

    /* ---------- 组装文档 ---------- */
    var doc = res.doc;
    if (head.title) doc.title = Core.clipName ? Core.clipName(head.title, 18) : head.title;
    doc.filler = String(head.filler || "").slice(0, 12);
    if (head.work) {
      var wp = splitOnce(head.work, ">");
      doc.work = wp
        ? { ip: stripQuotes(wp[0]), name: stripQuotes(wp[1]) }
        : { ip: "", name: stripQuotes(head.work) };
    }
    doc.created = head.created || "";

    /* ---------- 样式先落（自建词先建好，后面连线才挂得上） ---------- */
    Object.keys(styleDecl).forEach(function (name) {
      var decl = styleDecl[name];
      var row = Core.ensureRow(doc, name, decl);
      var layer = layerWish[name] || (decl.logic ? Core.layerOfLogic(decl.logic) : null);
      if (layer === "bottom" || layer === "top") moveRowTo(doc, row, layer);
    });

    /* ---------- 布局 ---------- */
    var layout = parseLayout(layoutRows, res);
    applyLayout(doc, layout, res);

    /* ---------- 喜好：原子 → 角色涂色 ---------- */
    favAtoms.forEach(function (g) {
      if (!Core.findRow(doc, g.word)) res.stats.autoWords.push(g.word);
      var row = ensureWordRow(doc, g.word, layerWish[g.word] || "bottom");
      if (!row) return;
      g.names.forEach(function (nm) {
        var c = Core.charByName(doc, nm);
        if (!c) { res.warns.push({ code: "W401", line: 0, msg: "喜好引用了不存在的角色：" + nm }); return; }
        if (c.like && c.like !== row.key) {
          res.warns.push({ code: "W402", line: 0, msg: "「" + nm + "」已有喜好属性，后者覆盖" });
        }
        c.like = row.key;
      });
    });

    /* ---------- 关系 / 喜好 连线 ---------- */
    var allEdgeGroups = relEdges.map(function (g) { return { word: g.word, edges: g.edges, layer: "top" }; })
      .concat(favEdges.map(function (g) { return { word: g.word, edges: g.edges, layer: "bottom" }; }));
    allEdgeGroups.forEach(function (g) {
      if (!Core.findRow(doc, g.word)) res.stats.autoWords.push(g.word);
      var row = ensureWordRow(doc, g.word, layerWish[g.word] || g.layer);
      if (!row) return;
      // 连线的层跟着「词」走，不跟着「块」走 —— 保证词与它挂的线永远同层，
      // 否则会出现「词在顶层表、线却记在底层」的错配，渲染取色时找不到。
      var rowLayer = doc.tables.bottom.indexOf(row) >= 0 ? "bottom" : "top";
      g.edges.forEach(function (ed) {
        var a = Core.charByName(doc, ed.a), b = Core.charByName(doc, ed.b);
        if (!a) { res.warns.push({ code: "W401", line: 0, msg: "引用了不存在的角色：" + ed.a }); return; }
        if (!b) { res.warns.push({ code: "W401", line: 0, msg: "引用了不存在的角色：" + ed.b }); return; }
        // `A<->B` 是语法糖：展开为一条无向 + 两条有向（三条独立记录）
        var list = ed.expand
          ? [{ type: "line", src: a.id, dst: b.id, arrow: "none" },
             { type: "dir", src: a.id, dst: b.id, arrow: "one" },
             { type: "dir", src: b.id, dst: a.id, arrow: "one" }]
          : [{ type: ed.type, src: a.id, dst: b.id, arrow: ed.type === "dir" ? "one" : "none" }];
        list.forEach(function (x) {
          var link = { id: Core.uid("l"), src: x.src, dst: x.dst, layer: rowLayer, type: x.type, ckey: row.key, arrow: x.arrow };
          var key = Core.linkKey(link);
          var hit = null;
          for (var i = 0; i < doc.links.length; i++) { if (Core.linkKey(doc.links[i]) === key) { hit = doc.links[i]; break; } }
          if (hit) { hit.ckey = row.key; hit.arrow = x.arrow; }
          else doc.links.push(link);
          res.stats.links++;
        });
      });
    });

    /* ---------- 图例 ---------- */
    if (legendRaw != null) doc.legend = parseLegend(legendRaw, res);
    if (!doc.legend.relation.length) {
      doc.legend.relation = doc.tables.top.filter(function (r) { return !r.hidden; }).map(function (r) { return r.name; });
    }
    if (!doc.legend.favor.length) {
      doc.legend.favor = doc.tables.bottom.filter(function (r) { return !r.hidden; }).map(function (r) { return r.name; });
    }

    /* ---------- 图例词必须在样式表里有定义（W403） ---------- */
    [].concat(doc.legend.relation, doc.legend.favor).forEach(function (n) {
      if (!Core.findRow(doc, n) && !Core.PRESET[n]) {
        res.warns.push({ code: "W403", line: 0, msg: "图例词未定义样式：" + n });
      }
    });

    /* ---------- 连线 / 喜好里没定义过的样式词：已自动补全，提示 + 指路（W404） ---------- */
    // 文本里「用户故意删了这行样式」与「用户压根没写」字面完全相同，解析器无从区分，
    // 故一律补全；想连同连线一起删掉，只能去「样式」面板删（那里是明确的删除意图）。
    if (res.stats.autoWords.length) {
      var aw = res.stats.autoWords;
      res.warns.unshift({
        code: "W404", line: 0,
        msg: "有 " + aw.length + " 个样式没定义，已自动补全：" + aw.slice(0, 3).join("、") +
          (aw.length > 3 ? " 等" : "") + "。要连同连线一起删掉，请到「样式」面板删除"
      });
    }

    doc.links = Core.dedupeLinks(doc.links);
    res.stats.chars = doc.chars.length;
    res.doc = Core.normalizeDoc(doc);
    res.doc.title = doc.title;
    res.doc.filler = doc.filler;
    res.doc.work = doc.work;
    res.doc.created = doc.created;
    res.doc.legend = doc.legend;
    return res;
  };

  /* 词 → 表行（不存在则新建），并保证落在指定层 */
  function ensureWordRow(doc, name, layer) {
    var existed = !!Core.findRow(doc, name);
    var row = Core.ensureRow(doc, name, null);
    if (!row) return null;
    if (layer === "bottom" || layer === "top") moveRowTo(doc, row, layer);
    // 自建词首次落表时补上该层的合理默认线宽（预设词已有各自的值，不动）
    if (!existed && !Core.PRESET[name]) {
      if (layer === "bottom" && row.lw === "2px") row.lw = "4px";
      if (layer === "top" && row.lw === "4px") row.lw = "2px";
    }
    return row;
  }

  function moveRowTo(doc, row, layer) {
    if (!row || !layer) return;
    var cur = (doc.tables.bottom || []).indexOf(row) >= 0 ? "bottom" : "top";
    if (cur !== layer) {
      doc.tables[cur] = doc.tables[cur].filter(function (r) { return r !== row; });
      if (!doc.tables[layer].some(function (r) { return r.name === row.name; })) doc.tables[layer].push(row);
    }
    // 层决定逻辑：落在底层的词一律 favor，落在顶层的一律 relation
    // （逻辑档词由 .样式{} 显式声明，不走这里）
    if (layer === "bottom" && row.logic === "relation") row.logic = "favor";
    else if (layer === "top" && row.logic === "favor") row.logic = "relation";
  }

  /* ---------- 原子列表（!喜好 原子 的值） ---------- */
  function parseAtomList(value, res, line) {
    var out = [];
    splitAware(value, ",", {}).map(stripQuotes).filter(Boolean).forEach(function (nm) {
      if (hasOutside(nm, "*") || hasOutside(nm, "+")) {
        res.errs.push({ code: "E303", line: line, msg: "「!喜好 原子」的值不能含关系/组合：" + nm });
        return;
      }
      out.push(nm);
    });
    return out;
  }

  /* ---------- 边表达式解析 ---------- */
  function cleanName(x) {
    var s = stripQuotes(x).trim();
    while (s.charAt(0) === "@") s = s.slice(1).trim();
    s = s.replace(/\[[^\]]*\]/g, "").trim();   // 剥时间标注 [main] / [0]
    return stripQuotes(s);
  }

  function parseEdgeList(value, res, line, ctx) {
    var out = [];
    splitAware(value, ",", {}).map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (tok) {
      var s = stripQuotes(tok);
      if (!s) return;
      while (s.charAt(0) === "@") s = s.slice(1).trim();
      var p;
      if ((p = splitOnce(s, "<->"))) {
        var a1 = cleanName(p[0]), b1 = cleanName(p[1]);
        if (!a1 || !b1) { res.errs.push({ code: "E203", line: line, msg: "双向写法看不懂：" + tok }); return; }
        out.push({ expand: true, a: a1, b: b1, src: tok });
        return;
      }
      if ((p = splitOnce(s, "->"))) {
        var a2 = cleanName(p[0]), b2 = cleanName(p[1]);
        if (!a2 || !b2 || hasOutside(a2, "*") || hasOutside(b2, "*")) {
          res.errs.push({ code: "E201", line: line, msg: "有向边两侧须各为单个名字：" + tok });
          return;
        }
        out.push({ type: "dir", a: a2, b: b2, src: tok });
        return;
      }
      if ((p = splitOnce(s, "<-"))) {
        var a3 = cleanName(p[1]), b3 = cleanName(p[0]);
        if (!a3 || !b3) { res.errs.push({ code: "E203", line: line, msg: "反向写法看不懂：" + tok }); return; }
        out.push({ type: "dir", a: a3, b: b3, src: tok });
        return;
      }
      if ((p = splitOnce(s, "*"))) {
        var a4 = cleanName(p[0]), b4 = cleanName(p[1]);
        if (!a4 || !b4 || hasOutside(a4, "*") || hasOutside(b4, "*")) {
          res.errs.push({ code: "E201", line: line, msg: "无向对须恰为两人：" + tok });
          return;
        }
        out.push({ type: "line", a: a4, b: b4, src: tok });
        return;
      }
      if ((p = splitOnce(s, "-"))) {
        var a5 = cleanName(p[0]), b5 = cleanName(p[1]);
        if (a5 && b5) { out.push({ type: "line", a: a5, b: b5, src: tok }); return; }
      }
      // 没有方向符也没有 *：裸原子
      if (ctx === "favor") {
        res.errs.push({ code: "E304", line: line, msg: "「!喜好 关系」的值必须是关系（含 * 或 ->）：" + tok });
      } else {
        res.errs.push({ code: "E203", line: line, msg: "关系行缺少关系符号（* 或 ->）：" + tok });
      }
    });
    return out;
  }

  /* ---------- 布局：轨道行 ---------- */
  function parseLayout(rows, res) {
    var plan = [];
    rows.forEach(function (r) {
      var e = splitEntry(r.raw);
      if (e.key == null) { res.errs.push({ code: "E203", line: r.line, msg: "布局行看不懂：" + r.raw }); return; }
      var hd = e.key.trim();
      var ring = null, slots = null, radius = null;
      var m = hd.match(/^(圆心|中心|center|圈?0|0)$/i);
      if (m || /^(圆心|中心|center)$/i.test(hd)) {
        ring = 0;
      } else {
        var mm = hd.match(/^(\d+)\s*(?:\[([^\]]*)\])?$/);
        if (!mm) { res.errs.push({ code: "E203", line: r.line, msg: "轨道号看不懂：" + hd }); return; }
        ring = parseInt(mm[1], 10);
        if (mm[2] != null) {
          mm[2].split(",").forEach(function (tok) {
            var t = tok.trim();
            if (!t) return;
            var u = t.match(/^(\d+(?:\.\d+)?)(px|rem|em|%)$/);
            if (u) { radius = Number(u[1]); return; }        // 带单位 → 半径
            if (/^\d+$/.test(t)) { slots = parseInt(t, 10); return; } // 裸数字 → 槽位
          });
        }
      }
      var names = [];
      splitAware(e.value, ",", {}).forEach(function (x) {
        var v = stripQuotes(x);
        v = v.replace(/\[[^\]]*\]/g, "").trim();   // 剥节点时间标注
        names.push(v ? v : null);                   // 空元素 = 空槽
      });
      while (names.length && names[names.length - 1] == null) names.pop();
      plan.push({ ring: ring, slots: slots, radius: radius, names: names, line: r.line });
    });
    return plan;
  }

  function applyLayout(doc, plan, res) {
    var maxRing = 0;
    plan.forEach(function (p) {
      if (p.ring > 0) {
        while (doc.rings.length < p.ring) {
          var prev = doc.rings.length ? doc.rings[doc.rings.length - 1].rad : 120;
          doc.rings.push({ rad: prev + 120, slots: null });
        }
        if (p.radius != null) doc.rings[p.ring - 1].rad = Math.max(40, Math.min(800, p.radius));
        if (p.slots != null) doc.rings[p.ring - 1].slots = p.slots;
        var n = p.names.filter(Boolean).length;
        if (p.slots != null && n > p.slots) {
          res.warns.push({ code: "W405", line: p.line, msg: "第 " + p.ring + " 圈声明槽位 " + p.slots + " 少于人数 " + n + "，已按人数自动扩容" });
          doc.rings[p.ring - 1].slots = n;
        }
        if (p.ring > maxRing) maxRing = p.ring;
      }
      var denom = (doc.rings[p.ring - 1] && doc.rings[p.ring - 1].slots) || p.names.filter(Boolean).length || 1;
      p.names.forEach(function (nm, i) {
        if (!nm) return;
        if (Core.charByName(doc, nm)) return;      // 重名保留先出现的
        doc.chars.push({
          id: Core.uid("c"),
          name: nm,
          ring: p.ring,
          angle: p.ring === 0 ? 0 : -Math.PI / 2 + (i * 2 * Math.PI) / denom,
          slot: null, like: null, avatar: null
        });
      });
    });
    // 圆心唯一
    var centers = doc.chars.filter(function (c) { return c.ring === 0; });
    centers.slice(1).forEach(function (c) { c.ring = 1; c.angle = null; });
    while (doc.rings.length < maxRing) doc.rings.push({ rad: 150 + doc.rings.length * 120, slots: null });
  }

  /* ---------- 图例 ---------- */
  var LEGEND_ALIAS = {
    "关系类型": "relation", "relation": "relation", "关系": "relation",
    "用户喜好": "favor", "喜好": "favor", "favor": "favor",
    "情感指向": "pointing", "pointing": "pointing", "指向": "pointing"
  };

  function parseLegend(body, res) {
    var out = { relation: [], favor: [], pointing: [] };
    splitAware(body, ",", { bracket: true }).forEach(function (seg) {
      var t = seg.trim();
      if (!t) return;
      var p = splitOnce(t, ":");
      if (!p) return;
      var k = LEGEND_ALIAS[stripQuotes(p[0])];
      if (!k) { res.warns.push({ code: "W400", line: 0, msg: "未知图例分组：" + p[0] }); return; }
      var inner = p[1].trim().replace(/^\[/, "").replace(/\]$/, "");
      if (k === "pointing") {
        // 指向是「A->B」一个整体，引号只是名字的边界，需逐个剥而不是整体剥
        var s = inner.replace(/["']/g, "").trim();
        out.pointing = s ? [s] : [];
        return;
      }
      out[k] = splitAware(inner, ",", {}).map(function (x) {
        return stripQuotes(x).trim();
      }).filter(Boolean);
    });
    return out;
  }

  /* ============================================================
   * 5. 导出（doc → 文本）
   * ============================================================ */
  var NAME_UNSAFE = /[,\-<>+*:;!@#.{}~[\]()\s"']/;
  function q(name) {
    var s = String(name == null ? "" : name);
    return NAME_UNSAFE.test(s) ? '"' + s + '"' : s;
  }

  D.export = function (doc) {
    var st = Core.normalizeDoc(doc);
    var out = [];

    /* 表头 */
    var headLines = ["  " + q(st.title) + ";"];
    if (st.filler) headLines.push("  !填表人: " + q(st.filler) + ";");
    if (st.work && (st.work.ip || st.work.name)) {
      headLines.push("  作品: " + q(st.work.ip ? st.work.ip + " > " + st.work.name : st.work.name) + ";");
    }
    if (st.created) headLines.push("  时间: " + q(st.created) + ";");
    out.push("#标题{");
    out.push(headLines.join("\n"));
    out.push("}");

    /* 布局 */
    var groups = {};
    st.chars.forEach(function (c) {
      (groups[c.ring] = groups[c.ring] || []).push(c);
    });
    var rings = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    var lay = [];
    rings.forEach(function (ring) {
      var list = groups[ring].slice().sort(function (a, b) {
        return (a.angle == null ? -Math.PI / 2 : a.angle) - (b.angle == null ? -Math.PI / 2 : b.angle);
      });
      var hd;
      if (ring === 0) hd = "0";
      else {
        hd = String(ring);
        var rd = st.rings[ring - 1];
        var defRad = 150 + (ring - 1) * 120;
        var parts = [];
        if (rd && rd.slots && rd.slots >= list.length) parts.push(String(rd.slots));
        if (rd && rd.rad && Math.abs(rd.rad - defRad) > 1) parts.push(Math.round(rd.rad) + "px");
        if (parts.length) hd += "[" + parts.join(", ") + "]";
      }
      lay.push("  " + hd + ": " + list.map(function (c) { return q(c.name); }).join(", ") + ";");
    });
    if (lay.length) { out.push(""); out.push(".布局{"); out.push(lay.join("\n")); out.push("}"); }

    /* 关系（top 层） */
    var relLines = edgeLinesFor(st, "top");
    if (relLines.length) { out.push(""); out.push("@关系{"); out.push(relLines.join("\n")); out.push("}"); }

    /* 喜好：原子（角色涂色） */
    var likeGroups = {};
    st.chars.forEach(function (c) {
      if (!c.like) return;
      var w = Core.nameOfRowById(st, c.like);
      if (!w) return;
      (likeGroups[w] = likeGroups[w] || []).push(c);
    });
    var fw = Object.keys(likeGroups);
    if (fw.length) {
      out.push(""); out.push("!喜好 原子{");
      out.push(fw.map(function (w) {
        return "  " + q(w) + ": " + likeGroups[w].map(function (c) { return q(c.name); }).join(", ") + ";";
      }).join("\n"));
      out.push("}");
    }

    /* 喜好：关系（bottom 层连线） */
    var botLines = edgeLinesFor(st, "bottom");
    if (botLines.length) {
      out.push(""); out.push("!喜好 关系{");
      out.push(botLines.join("\n"));
      out.push("}");
    }

    /* 样式：只写偏离预设的部分 */
    var sty = [];
    ["bottom", "top"].forEach(function (layer) {
      (st.tables[layer] || []).forEach(function (r) {
        if (!r || !r.name) return;
        var p = Core.PRESET[r.name] || null;
        var bits = [];
        if (!p || p.logic !== r.logic) bits.push(r.logic);
        if (!p || String(p.color).toLowerCase() !== String(r.color).toLowerCase()) bits.push(r.color);
        if (!p || p.lw !== r.lw) bits.push(r.lw);
        if (!p || p.stroke !== r.stroke) {
          bits.push({ solid: "实线", dashed: "虚线", dotted: "点线", double: "双线", hidden: "隐藏" }[r.stroke] || r.stroke);
        }
        if (bits.length) sty.push("  " + q(r.name) + ": " + bits.join(", ") + ";");
      });
    });
    if (sty.length) { out.push(""); out.push(".样式{"); out.push(sty.join("\n")); out.push("}"); }

    /* 图例三组 */
    var lg = st.legend || { relation: [], favor: [], pointing: [] };
    var L = [];
    if (lg.relation && lg.relation.length) {
      L.push('  "关系类型": [' + lg.relation.map(function (x) { return '"' + x + '"'; }).join(", ") + "]");
    }
    if (lg.favor && lg.favor.length) {
      L.push('  "用户喜好": [' + lg.favor.map(function (x) { return '"' + x + '"'; }).join(", ") + "]");
    }
    if (lg.pointing && lg.pointing.length) {
      L.push('  "情感指向": ["' + lg.pointing[0] + '"]');
    }
    if (L.length) { out.push(""); out.push(".图例{"); out.push(L.join(",\n")); out.push("}"); }

    return out.join("\n") + "\n";
  };

  /* 按层生成连线行：同一对角色间若有「一条无向 + 两条反向有向」且同词，
   * 还原成 `A<->B` 一条写法（与解析端的展开互为逆运算，保证往返稳定）。 */
  function edgeLinesFor(st, layer) {
    var byId = {};
    st.chars.forEach(function (c) { byId[c.id] = c; });
    var byWord = {};
    st.links.forEach(function (k) {
      if (k.layer !== layer) return;
      var w = Core.nameOfRowById(st, k.ckey);
      if (!w) return;
      var a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return;
      (byWord[w] = byWord[w] || []).push({ k: k, a: a, b: b });
    });
    var lines = [];
    Object.keys(byWord).forEach(function (w) {
      var items = byWord[w];
      var used = items.map(function () { return false; });
      var parts = [];
      // 同一对（无序）分桶
      var buckets = {};
      items.forEach(function (it, i) {
        var pk = Core.uniqPair(it.a.name, it.b.name);
        (buckets[pk] = buckets[pk] || []).push(i);
      });
      Object.keys(buckets).forEach(function (pk) {
        var idxs = buckets[pk];
        if (idxs.length < 3) return;
        var base = items[idxs[0]].a.name;
        var li = -1, ab = -1, ba = -1;
        idxs.forEach(function (i) {
          if (Core.linkTypeOf(items[i].k) !== "dir") { if (li < 0) li = i; return; }
          if (items[i].a.name === base) { if (ab < 0) ab = i; } else if (ba < 0) ba = i;
        });
        if (li >= 0 && ab >= 0 && ba >= 0) {
          used[li] = used[ab] = used[ba] = true;
          parts.push(q(items[li].a.name) + "<->" + q(items[li].b.name));
        }
      });
      items.forEach(function (it, i) {
        if (used[i]) return;
        if (Core.linkTypeOf(it.k) === "dir") parts.push(q(it.a.name) + "->" + q(it.b.name));
        else parts.push(q(it.a.name) + "*" + q(it.b.name));
      });
      if (parts.length) lines.push("  " + q(w) + ": " + parts.join(", ") + ";");
    });
    return lines.sort();
  }

  /* ============================================================
   * 6. 合并（解析结果 → 既有文档）
   * ============================================================
   * 语义：布局中已存在的角色保留原位不动；连线追加 / 同键覆盖。
   */
  D.merge = function (base, parsed) {
    var dst = Core.normalizeDoc(base);
    var src = Core.normalizeDoc(parsed);
    var res = { addedChars: 0, addedLinks: 0, addedWords: 0, errs: [] };

    if (src.title && src.title !== "未命名关系图") dst.title = src.title;
    if (src.filler) dst.filler = src.filler;
    if (src.work && (src.work.ip || src.work.name)) dst.work = src.work;
    if (src.created) dst.created = src.created;

    /* 词表：补齐缺失的行（含 lw/stroke/logic 全字段） */
    ["bottom", "top"].forEach(function (layer) {
      src.tables[layer].forEach(function (r) {
        var has = Core.findRow(dst, r.name);
        if (has) {
          has.color = r.color; has.lw = r.lw; has.stroke = r.stroke; has.logic = r.logic;
        } else {
          dst.tables[layer].push(Object.assign({}, r, { key: Core.uid(layer === "bottom" ? "b_" : "t_") }));
          res.addedWords++;
        }
      });
    });

    /* 圈参数 */
    src.rings.forEach(function (r, i) {
      while (dst.rings.length <= i) dst.rings.push({ rad: 150 + dst.rings.length * 120, slots: null });
      if (r.rad) dst.rings[i].rad = r.rad;
      if (r.slots) dst.rings[i].slots = r.slots;
    });

    /* 角色：同名保留原位（只补空缺的涂色），新名追加 */
    src.chars.forEach(function (c) {
      var has = Core.charByName(dst, c.name);
      if (has) { if (!has.like && c.like) has.like = likeKeyMap(src, dst, c.like); return; }
      var nc = Object.assign({}, c, { id: Core.uid("c"), like: likeKeyMap(src, dst, c.like) });
      dst.chars.push(nc);
      res.addedChars++;
    });
    // 圆心唯一
    var centers = dst.chars.filter(function (x) { return x.ring === 0; });
    if (centers.length > 1) {
      centers.slice(1).forEach(function (x) { x.ring = 1; x.angle = null; });
    }
    // 新圈补齐半径
    var maxRing = Math.max(0, Math.max.apply(null, dst.chars.map(function (x) { return x.ring; })));
    while (dst.rings.length < maxRing) dst.rings.push({ rad: 150 + dst.rings.length * 120, slots: null });

    /* 连线：同键覆盖，否则追加 */
    src.links.forEach(function (k) {
      var a = src.chars.filter(function (c) { return c.id === k.src; })[0];
      var b = src.chars.filter(function (c) { return c.id === k.dst; })[0];
      if (!a || !b) return;
      var da = Core.charByName(dst, a.name), db = Core.charByName(dst, b.name);
      if (!da || !db) return;
      var wname = Core.nameOfRowById(src, k.ckey);
      var row = wname ? Core.findRow(dst, wname) : null;
      if (!row) return;
      var link = { id: Core.uid("l"), src: da.id, dst: db.id, layer: k.layer, type: k.type, ckey: row.key, arrow: k.arrow };
      var key = Core.linkKey(link);
      var hit = null;
      for (var i = 0; i < dst.links.length; i++) { if (Core.linkKey(dst.links[i]) === key) { hit = dst.links[i]; break; } }
      if (hit) { hit.ckey = row.key; hit.arrow = k.arrow; }
      else { dst.links.push(link); res.addedLinks++; }
    });

    /* 图例 */
    if (src.legend.relation.length) dst.legend.relation = src.legend.relation.slice();
    if (src.legend.favor.length) dst.legend.favor = src.legend.favor.slice();
    if (src.legend.pointing.length) dst.legend.pointing = src.legend.pointing.slice();

    return { doc: dst, res: res };
  };

  function likeKeyMap(src, dst, likeKey) {
    if (!likeKey) return null;
    var w = Core.nameOfRowById(src, likeKey);
    if (!w) return null;
    var row = Core.findRow(dst, w);
    return row ? row.key : null;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof window !== "undefined" ? window : globalThis);
