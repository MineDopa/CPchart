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
          id: App.uid("c"), name: App.clipName(p.name), ring: p.ring, angle: null, slot: null,
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
    // 喜好度行：唯一真源 = 角色自身涂色 char.like（与圆心无关）。
    // 同轴单值 → 一个角色只会出现在一条喜好度行里，导出不会同名重复。名字按字典序排。
    const fav = [];
    (st.tables.bottom || []).forEach((t) => {
      const names = st.chars
        .filter((c) => c.like === t.key && c.name)
        .map((c) => c.name)
        .sort((a, b) => String(a).localeCompare(String(b), "zh"));
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
    const res = { added: 0, skipped: 0, errs: [] };
    const raw = String(text || "").replace(/\r/g, "");
    const items = raw.split(/[；;\n]+/).map((x) => x.trim()).filter(Boolean);
    const pending = [];
    items.forEach((it) => {
      // 先判方向符 → 连线条目；否则含冒号 → 喜好度条目
      let arrow = "none", parts = null;
      if (it.indexOf("<->") >= 0) { arrow = "both"; parts = it.split("<->"); }
      else if (it.indexOf("->") >= 0 || it.indexOf("→") >= 0 || it.indexOf("》") >= 0 || it.indexOf("➡️") >= 0) {
        arrow = "one"; parts = it.split(/->|→|》|➡️/);
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
      if (it) res.errs.push("存在无法识别的格式：“" + it + "”。可能原因：连线行需含 — 或 - 或 →；喜好度需用半角冒号「:」而非全角「：」");
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
        // 喜好度 = 给这个角色自己涂色（单值覆盖、重复贴同一行幂等），不再依赖圆心、不再建连线
        const bkey = lgKeyOfName("bottom", p.bottomName);
        if (!bkey) return;
        p.char.like = bkey;
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

  // ---------------- CPC 格式 v2（《数据格式语义定义-v2-cpc.md》§3-§5）----------------
  // 五段分段：注释头 / #标题# / #布局# / #喜好# / #连线# / #样式#
  // 核心语义：连线两正交维度（强度档 bottom=多喜欢 / 定义档 top=是什么），方向对两层都开放。
  var CPC_URL = "解读格式见「CPC 语言说明」";
  // 内置样式预注入（§4.6）：默认词未声明时走这套，不是未定义样式。样式段只导出偏离默认的部分。
  var CPC_DEF_BOTTOM = { "本命": "#d32f2f", "很喜欢": "#f57c00", "路好": "#fbc02d", "不吃": "#222222" };
  var CPC_DEF_TOP = { "爱情": "#ec407a", "友情": "#43a047", "亲情": "#1976d2", "QPR": "#8e24aa" };
  // 名字含语法字符 → 导出时引号包裹（§4.5）
  var CPC_NAME_UNSAFE = /[，,、：:；;()（）\-—–－<>＜＞+＋*#"'\u2018\u2019\u201c\u201d]/;

  function cpcName(n) {
    const s = String(n == null ? "" : n);
    return CPC_NAME_UNSAFE.test(s) ? "'" + s + "'" : s;
  }
  // 引号感知归一化（§5）：引号内内容不动，引号外做通配归一
  function cpcNormalize(text) {
    const raw = String(text || "").replace(/\r/g, "");
    const parts = raw.split(/('[^']*'|‘[^’]*’|“[^”]*”)/g);
    return parts.map((p) => {
      if (/^'[^']*'$/.test(p) || /^‘[^’]*’$/.test(p) || /^“[^”]*”$/.test(p)) return p;
      return p
        .replace(/\/\*[\s\S]*?\*\//g, "")   // 注释块
        .replace(/[，、]/g, ",")            // 全角逗号/顿号
        .replace(/；/g, ";")                // 全角分号
        .replace(/[—–－]/g, "-")            // 横线族（横线只管连，方向由>/<决定）
        .replace(/：/g, ":")
        .replace(/＞/g, ">")
        .replace(/＜/g, "<")
        .replace(/[→➔➜➞⇒⟶]/g, "->")          // 漂亮箭头族 → 半角 ->（AI 偏好全角 → 易踩坑）
        .replace(/[←⇐⟵]/g, "<-")             // 反向漂亮箭头 → 半角 <-
        .replace(/[↔⇄⇆]/g, "<->");            // 双向漂亮箭头 → 半角 <->
    }).join("");
  }
  function cpcStripQ(s) {
    const t = String(s == null ? "" : s).trim();
    const m = t.match(/^['\u2018\u201c]([\s\S]*)['\u2019\u201d]$/);
    return m ? m[1].trim() : t;
  }
  // 引号感知的逗号切分（引号内逗号不切）
  function cpcSplitList(s) {
    const out = [];
    let cur = "", inQ = false, close = "";
    const str = String(s == null ? "" : s);
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inQ) { cur += ch; if (ch === close) inQ = false; continue; }
      if (ch === "'") { inQ = true; close = "'"; cur += ch; continue; }
      if (ch === "\u2018") { inQ = true; close = "\u2019"; cur += ch; continue; }
      if (ch === "\u201c") { inQ = true; close = "\u201d"; cur += ch; continue; }
      if (ch === ",") { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  // 引号感知的分隔符查找/切分（方向符切分用；只切第一处）
  function cpcFindSep(str, sep) {
    let inQ = false, close = "";
    for (let i = 0; i + sep.length <= str.length; i++) {
      const ch = str[i];
      if (inQ) { if (ch === close) inQ = false; continue; }
      if (ch === "'") { inQ = true; close = "'"; continue; }
      if (ch === "\u2018") { inQ = true; close = "\u2019"; continue; }
      if (ch === "\u201c") { inQ = true; close = "\u201d"; continue; }
      if (str.startsWith(sep, i)) return i;
    }
    return -1;
  }
  function cpcSplitBy(str, sep) {
    const i = cpcFindSep(str, sep);
    if (i < 0) return null;
    return [str.slice(0, i), str.slice(i + sep.length)];
  }
  function cpcLooksLike(text) {
    return /#\s*(标题|布局|喜好|连线|样式|title|layout|fav|link|style)\s*#/i.test(String(text || ""));
  }
  var CPC_SEC = {
    "标题": "title", "title": "title", "布局": "layout", "layout": "layout",
    "喜好": "fav", "fav": "fav", "连线": "link", "link": "link", "样式": "style", "style": "style",
  };
  function cpcSplitSections(text) {
    const sec = { title: "", layout: [], fav: [], link: [], style: [] };
    let cur = null;
    String(text).split("\n").forEach((ln) => {
      const t = ln.trim();
      if (!t) return;
      const m = t.match(/^#([^#]{1,6})#\s*/);
      if (m && CPC_SEC[m[1].toLowerCase()] != null) {
        const key = CPC_SEC[m[1].toLowerCase()];
        if (key === "title") { sec.title = cpcStripQ(t.slice(m[0].length).trim()); cur = null; }
        else cur = key;
        const rest = t.slice(m[0].length).trim();
        if (cur && rest) sec[cur].push(rest);
        return;
      }
      if (cur) sec[cur].push(t);
    });
    return sec;
  }
  function cpcHexColor(s) {
    const t = String(s || "").trim().replace(/^#?/, "#");
    return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t : null;
  }

  // 旧分段制导出（#标题# / #布局# …）。当前导出已换块语法，此函数仅作历史参照保留。
  App.exportCPCLegacy = function () {
    const st = App.state;
    function pairText(p) {
      let s = p.s, d = p.d;
      if (p.arr === "-" && String(s).localeCompare(String(d), "zh") > 0) { const t = s; s = d; d = t; }
      return cpcName(s) + p.arr + cpcName(d);
    }
    const out = [];
    out.push("/* 该数据由 CP Chart 导出 | " + CPC_URL + " */");
    out.push("/* 解读该 CPC 请参考本工具的「CPC 语言说明」 */");
    out.push("#标题# " + String(st.title || "未命名关系图").replace(/[\r\n]+/g, " ").trim());
    // 布局：圈号(槽位?)[半径px?]: 名单；圈上按 angle 从 12 点方向顺时针
    const groups = new Map();
    st.chars.forEach((c) => {
      if (!groups.has(c.ring)) groups.set(c.ring, []);
      groups.get(c.ring).push(c);
    });
    const lay = [];
    [...groups.keys()].sort((a, b) => a - b).forEach((ring) => {
      const list = groups.get(ring).slice()
        .sort((a, b) => ((a.angle == null ? -Math.PI / 2 : a.angle) - (b.angle == null ? -Math.PI / 2 : b.angle)));
      let head = ring === 0 ? "0" : String(ring);
      if (ring > 0) {
        const rd = st.rings[ring - 1];
        const defRad = 150 + (ring - 1) * 120;
        if (rd && rd.slots && rd.slots >= list.length) head += "(" + rd.slots + ")";
        if (rd && rd.rad && Math.abs(rd.rad - defRad) > 1) head += "[" + Math.round(rd.rad) + "px]";
      }
      lay.push(head + ": " + list.map((c) => cpcName(c.name)).join(",") + ";");
    });
    if (lay.length) { out.push("#布局#"); out.push(lay.join("\n")); }
    // 喜好：唯一真源 = char.like（单角色涂色）
    const fav = [];
    (st.tables.bottom || []).forEach((t) => {
      const names = st.chars
        .filter((c) => c.like === t.key && c.name)
        .map((c) => c.name)
        .sort((a, b) => String(a).localeCompare(String(b), "zh"));
      if (names.length) fav.push(t.name + ":" + names.map(cpcName).join(",") + ";");
    });
    if (fav.length) { out.push("#喜好#"); out.push(fav.join("\n")); }
    // 连线：一个类型词一行；强度词(bottom)与定义词(top)分组；有向对按存储方向，无向按字典序（往返稳定）
    const grpB = new Map(), grpT = new Map();
    st.links.forEach((k) => {
      const a = st.chars.find((x) => x.id === k.src), b = st.chars.find((x) => x.id === k.dst);
      if (!a || !b || !a.name || !b.name) return;
      const w = lgNameOf(k.layer, k.ckey);
      if (!w) return;
      const grp = k.layer === "bottom" ? grpB : grpT;
      if (!grp.has(w)) grp.set(w, []);
      const arr = k.arrow === "both" ? "<->" : k.arrow === "one" ? "->" : "-";
      grp.get(w).push({ s: a.name, d: b.name, arr: arr });
    });
    const conn = [];
    grpB.forEach((arrs, w) => conn.push(w + ":" + arrs.map(pairText).join(",") + ";"));
    grpT.forEach((arrs, w) => conn.push(w + ":" + arrs.map(pairText).join(",") + ";"));
    if (conn.length) { out.push("#连线#"); out.push(conn.join("\n")); }
    // 样式：只导出偏离内置预设的词（自建词 / 改色词）；px/Z 按层给内置默认值
    const sty = [];
    ["bottom", "top"].forEach((layer) => {
      const defs = layer === "bottom" ? CPC_DEF_BOTTOM : CPC_DEF_TOP;
      (st.tables[layer] || []).forEach((r) => {
        if (!r || !r.name) return;
        const dc = defs[r.name];
        if (!dc || (dc && dc.toLowerCase() !== String(r.color || "").toLowerCase())) {
          sty.push(cpcName(r.name) + ":" + r.color + ", " + (layer === "bottom" ? "4px" : "2px") + ", " + layer + ";");
        }
      });
    });
    if (sty.length) { out.push("#样式#"); out.push(sty.join("\n")); }
    return out.join("\n");
  };

  // 布局段解析：plan = [{ring, slots, radius, items:[名字|null]}]；超员只报错不建（§4.2 容错）
  function cpcPlanLayout(lines, res) {
    const plan = [];
    lines.forEach((ln) => {
      String(ln).split(";").forEach((seg0) => {
        const seg = seg0.trim();
        if (!seg) return;
        const m = seg.match(/^(圆心|中心|center|\d+)\s*(?:\((\d+)\))?\s*(?:\[([\d.]+)\s*px\])?\s*:?\s*([\s\S]*)$/i);
        if (!m) { res.errs.push("布局行看不懂：" + seg); return; }
        if (!m[4].trim()) return; // 圈号后没写名字：宽容跳过
        const ring = /^(圆心|中心|center)$/i.test(m[1]) ? 0 : Math.max(0, parseInt(m[1], 10));
        const slots = m[2] ? parseInt(m[2], 10) : null;
        const radius = m[3] ? Math.max(40, Math.min(800, parseFloat(m[3]))) : null;
        const rawItems = cpcSplitList(m[4]);
        while (rawItems.length && !rawItems[rawItems.length - 1].trim()) rawItems.pop(); // 行尾多余逗号
        const items = rawItems.map((x) => { const v = cpcStripQ(x); return v ? v : null; }); // 空元素=空槽
        plan.push({ ring: ring, slots: slots, radius: radius, items: items, seg: seg });
      });
    });
    plan.forEach((p) => {
      if (p.slots != null) {
        const n = p.items.filter(Boolean).length;
        if (n > p.slots) {
          res.errs.push("第 " + p.ring + " 圈声明槽位 (" + p.slots + ") 少于人数 " + n + "，已按人数自动扩容");
          p.autoSlots = n;
        }
      }
    });
    return plan;
  }
  // 布局应用：新角色按列表序精确落角（顺序=数据）；已有角色保留原位（合并语义）
  function cpcApplyLayout(plan, res) {
    if (res.errs.length) return 0;
    const byName = {};
    App.state.chars.forEach((c) => { byName[c.name] = c; });
    const fresh = [];
    plan.forEach((p) => {
      if (p.ring > 0) {
        App.radiusFor(p.ring);
        if (p.autoSlots) p.slots = p.autoSlots; // 超员自动改正（用户确认路径）
        if (p.slots != null) App.state.rings[p.ring - 1].slots = p.slots;
        if (p.radius != null) App.state.rings[p.ring - 1].rad = p.radius;
      }
      const denom = p.slots || p.items.filter(Boolean).length || 1;
      p.items.forEach((name, i) => {
        if (!name) return;
        if (byName[name]) return; // 已存在：保留原设置
        const c = {
          id: App.uid("c"), name: App.clipName(name), ring: p.ring,
          angle: p.ring === 0 ? 0 : -Math.PI / 2 + (i * 2 * Math.PI) / denom,
          slot: null, like: null, avatar: null, x: 0, y: 0,
        };
        App.state.chars.push(c);
        byName[name] = c;
        fresh.push(c);
      });
    });
    // 圆心唯一：多余的圆心移到第 1 圈
    const centers = App.state.chars.filter((c) => c.ring === 0);
    centers.slice(1).forEach((c) => { c.ring = 1; c.angle = null; });
    // 混合圈（已有+新角色同圈）→ 锚定均分；全新圈保持精确列表序
    const touched = new Set(fresh.map((c) => c.ring));
    touched.forEach((r) => {
      if (r === 0) return;
      const on = App.charsOnRing(r);
      const freshN = on.filter((c) => fresh.indexOf(c) >= 0).length;
      if (freshN > 0 && freshN < on.length) App.distributeRing(r, { anchor: true });
    });
    const maxRing = Math.max(1, ...App.state.chars.map((c) => c.ring));
    App.radiusFor(maxRing);
    return fresh.length;
  }
  // 样式段：词: 颜色[, Npx][, top|bottom] —— 颜色生效；px 暂不生效（数据模型无字段，接受不报错）；z 决定建到哪层
  function cpcApplyStyle(lines, res) {
    lines.forEach((ln) => {
      String(ln).split(";").forEach((seg0) => {
        const seg = seg0.trim();
        if (!seg) return;
        const ci = cpcFindSep(seg, ":");
        if (ci < 0) { res.errs.push("样式行缺冒号：" + seg); return; }
        const name = cpcStripQ(seg.slice(0, ci));
        const parts = cpcSplitList(seg.slice(ci + 1)).map(cpcStripQ).filter(Boolean);
        if (!name) { res.errs.push("样式行缺词名：" + seg); return; }
        const colorTok = parts.find((x) => cpcHexColor(x));
        const zTok = parts.find((x) => /^(top|bottom)$/i.test(x));
        const layer = zTok ? zTok.toLowerCase() : "bottom";
        if (!colorTok) { res.errs.push("样式行缺颜色：" + seg); return; }
        const color = cpcHexColor(colorTok);
        let row = (App.state.tables[layer] || []).find((x) => x.name === name)
          || (App.state.tables[layer === "top" ? "bottom" : "top"] || []).find((x) => x.name === name);
        if (row) { row.color = color; return; }
        const key = App.addLegendAuto(layer, name);
        const r = (App.state.tables[layer] || []).find((x) => x.key === key);
        if (r) r.color = color;
      });
    });
  }
  // 喜好段：词: 角色, 角色（char.like 单值覆盖，幂等）
  function cpcApplyFav(lines, res) {
    lines.forEach((ln) => {
      String(ln).split(";").forEach((seg0) => {
        const seg = seg0.trim();
        if (!seg) return;
        const ci = cpcFindSep(seg, ":");
        if (ci < 0) { res.errs.push("喜好行缺冒号：" + seg); return; }
        const lname = cpcStripQ(seg.slice(0, ci));
        let bkey = lgKeyOfName("bottom", lname);
        if (!bkey) bkey = App.addLegendAuto("bottom", lname);
        cpcSplitList(seg.slice(ci + 1)).forEach((x) => {
          const nm = cpcStripQ(x);
          if (!nm) return;
          const c = charByName(nm);
          if (!c) { res.errs.push("未知名：" + nm); return; }
          c.like = bkey;
          res.added++;
        });
      });
    });
  }
  // 连线段：词: A 方向符 B, ...（方向符 <-> / -> / <- / -；横线只管连、箭头才管方向）
  function cpcApplyLink(lines, res) {
    lines.forEach((ln) => {
      String(ln).split(";").forEach((seg0) => {
        const seg = seg0.trim();
        if (!seg) return;
        const ci = cpcFindSep(seg, ":");
        if (ci < 0) { res.errs.push("连线行缺冒号：" + seg); return; }
        const lname = cpcStripQ(seg.slice(0, ci));
        if (!lname) { res.errs.push("连线行缺类型词：" + seg); return; }
        cpcSplitList(seg.slice(ci + 1)).forEach((item) => {
          const it = item.trim();
          if (!it) return;
          let arrow = "none", parts = null;
          if ((parts = cpcSplitBy(it, "<->")) != null) arrow = "both";
          else if ((parts = cpcSplitBy(it, "->")) != null) arrow = "one";
          else if ((parts = cpcSplitBy(it, "<-")) != null) { arrow = "one"; parts = [parts[1], parts[0]]; }
          else if ((parts = cpcSplitBy(it, "-")) != null) arrow = "none";
          else { res.errs.push("连线缺方向符（需 - 或 -> 或 <->）：" + it); return; }
          const a = cpcStripQ(parts[0]), b = cpcStripQ(parts[1]);
          if (!a || !b) { res.errs.push("连线格式看不懂：" + it); return; }
          const ca = charByName(a), cb = charByName(b);
          if (!ca) { res.errs.push("未知名：" + a); return; }
          if (!cb) { res.errs.push("未知名：" + b); return; }
          // 类型词 → 层：bottom 表 = 强度档，top 表 = 定义档；
          // 两表都没有的未知词兜底 top（用户新建词绝大多数是关系定义，如"敌对/主从"；强度档几乎只有默认四词。写 #样式# 的 z 参数可显式指定层）
          let layer, key = lgKeyOfName("bottom", lname);
          if (key) { layer = "bottom"; }
          else if ((key = lgKeyOfName("top", lname))) { layer = "top"; }
          else { layer = "top"; key = App.addLegendAuto("top", lname); }
          if (layer === "bottom") {
            App.addLink(ca.id, cb.id, "bottom", key, arrow); // 底层粗线一律画成线（含连圆心），好感度是两人关系，与圆心无关
          } else {
            const exist = App.state.links.find((k) => k.layer === "top" &&
              (k.src === ca.id && k.dst === cb.id || k.src === cb.id && k.dst === ca.id));
            if (exist && arrow === "none") {
              // 无向细线：任一方向已存在则覆盖该条（往返稳定），否则新建
              exist.ckey = key; exist.arrow = arrow;
            } else {
              App.addLink(ca.id, cb.id, "top", key, arrow);
            }
          }
          res.added++;
        });
      });
    });
  }

  // 旧分段制导入（#标题# / #布局# …）：保留只读兼容，存量文本仍可导入
  App.importCPCLegacy = function (text) {
    if (!cpcLooksLike(text)) return null;
    const res = { added: 0, skipped: 0, errs: [], autoFixText: null };
    const norm = cpcNormalize(text);
    const sec = cpcSplitSections(norm);
    // 布局先行：超员等纯解析错误在动数据前报出（§4.2 报错 + 自动改正）
    const plan = cpcPlanLayout(sec.layout, res);
    if (res.errs.length) {
      // 生成自动改正文本：超员行的 (n) 换成实际人数
      let fixed = String(text);
      plan.forEach((p) => {
        if (p.autoSlots) fixed = fixed.replace(p.seg, p.seg.replace(/\((\d+)\)/, "(" + p.autoSlots + ")"));
      });
      res.autoFixText = fixed;
      return res;
    }
    App.act(() => {
      cpcApplyLayout(plan, res);
      if (!res.errs.length) {
        cpcApplyStyle(sec.style, res); // 样式先于连线：自建词先建好
        cpcApplyFav(sec.fav, res);
        cpcApplyLink(sec.link, res);
        if (sec.title) App.state.title = App.clipName(sec.title, 18);
        if (App.fitContent) App.fitContent();
      }
    });
    return res;
  };

  // ---------------- 块语法收发（v5.1）----------------
  // 数据层与解析层在 cpc-core.js / cpc-dsl.js；本段只做「应用状态 ←→ 语义文档」的桥接。
  var CPC_OK = !!(window.CPC && window.CPC.dsl);

  // 应用状态 → 语义文档（补齐旧状态里没有的字段：填表人 / 作品 / 时间 / 图例三组 / 线型 / 逻辑）
  function cpcToDoc(st) {
    var doc = CPC.normalizeDoc({
      title: st.title, bg: st.bg, rings: st.rings, chars: st.chars, links: st.links,
      tables: st.tables, ui: st.ui, meta: st.meta,
      filler: (st.meta && st.meta.filler) || "",
      work: st.work || null, created: st.created || "",
      legend: st.legend || null
    });
    if (!doc.legend.relation.length) {
      doc.legend.relation = doc.tables.top.filter(function (r) { return !r.hidden; }).map(function (r) { return r.name; });
    }
    if (!doc.legend.favor.length) {
      doc.legend.favor = doc.tables.bottom.filter(function (r) { return !r.hidden; }).map(function (r) { return r.name; });
    }
    if (!doc.legend.pointing.length) doc.legend.pointing = ["情感主体->情感对象"];
    return doc;
  }

  // 语义文档 → 应用状态（只覆盖语义字段；背景 / 界面偏好等保持不动）
  function cpcFromDoc(st, doc) {
    st.title = doc.title;
    st.rings = doc.rings;
    st.chars = (doc.chars || []).map(function (c) {
      return {
        id: c.id, name: c.name, ring: c.ring, angle: c.angle, slot: c.slot,
        like: c.like || null, avatar: c.avatar || null, x: 0, y: 0
      };
    });
    st.links = doc.links;
    st.tables = doc.tables;
    st.meta = st.meta || {};
    st.meta.filler = doc.filler || "";
    st.work = doc.work;
    st.created = doc.created;
    st.legend = doc.legend;
  }

  // 文本是否块语法（形如 `@关系{`）；否则按旧分段制处理
  function cpcIsBlockSyntax(text) {
    return /(^|\n)\s*[#.@!][^\n{]{0,24}\{/.test(String(text || ""));
  }

  App.exportCPC = function () {
    if (!CPC_OK) return "";
    return CPC.dsl.export(cpcToDoc(App.state));
  };

  // mode: 省略或 "merge" = 增量合并；"replace" = 整份覆盖（文本里没写的人物/连线会被删除）
  App.importCPC = function (text, mode) {
    var src = String(text == null ? "" : text);
    if (!CPC_OK || !cpcIsBlockSyntax(src)) return App.importCPCLegacy(src);
    var r = CPC.dsl.parse(src);
    if (r.errs.length) {
      return {
        added: 0,
        errs: r.errs.map(function (e) { return (e.code ? e.code + " " : "") + e.msg; }),
        warns: [],
        autoFixText: null
      };
    }
    var empty = !r.doc.chars.length && !r.doc.links.length && !r.doc.filler &&
      r.doc.title === "未命名关系图";
    if (empty) return null;
    // ★全量覆盖：整份文本直接替换画板（含删除文本里没有的人物/连线）
    if (mode === "replace") {
      App.act(function () {
        cpcFromDoc(App.state, r.doc);
        if (App.fitContent) App.fitContent();
      });
      return {
        added: (r.doc.chars ? r.doc.chars.length : 0) + (r.doc.links ? r.doc.links.length : 0),
        errs: [],
        warns: r.warns.map(function (w) { return w.msg; }),
        autoFixText: null,
        replaced: true
      };
    }
    var merged = CPC.dsl.merge(cpcToDoc(App.state), r.doc);
    App.act(function () {
      cpcFromDoc(App.state, merged.doc);
      if (App.fitContent) App.fitContent();
    });
    return {
      added: merged.res.addedChars + merged.res.addedLinks,
      errs: [],
      warns: r.warns.map(function (w) { return w.msg; }),
      autoFixText: null
    };
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

  // 居中标题/署名（可选底衬：只有传 backing 才垫半透明圆角块；不传则文字直接压在顶部色带上）
  function drawCaption(ctx, text, cx, cy, fontSize, weight, fg, backing) {
    ctx.font = (weight || "") + " " + fontSize + "px " + BAND_FONT;
    if (backing) {
      const tw = ctx.measureText(text).width;
      const padX = fontSize * 0.6, padY = fontSize * 0.42;
      const bw = tw + padX * 2, bh = fontSize + padY * 2;
      roundRectPath(ctx, cx - bw / 2, cy - bh / 2, bw, bh, Math.min(12, bh / 2));
      ctx.fillStyle = backing;
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fg;
    ctx.fillText(text, cx, cy);
  }

  // 导出图例（标题下方居中、三行：箭头方向 / 粗线(喜好) / 细线(关系)）
  function legendRows(st) {
    const rows = [];
    const arrowName = (st.meta && st.meta.arrowName) ? String(st.meta.arrowName) : "情感指向";
    if (arrowName) rows.push([{ kind: "arrow", name: arrowName }]);
    const b = st.tables.bottom.filter((r) => r && r.name && !r.hidden);
    if (b.length) rows.push(b.map((r) => ({ kind: "dot", color: r.color, name: r.name })));
    const t = st.tables.top.filter((r) => r && r.name && !r.hidden);
    if (t.length) rows.push(t.map((r) => ({ kind: "bar", color: r.color, name: r.name })));
    return rows;
  }
  function legItemW(ctx, it, font) {
    let sw;
    if (it.kind === "arrow") { sw = font * 1.15 + 4; }
    else if (it.kind === "dot") sw = font * 0.84 + 4;
    else sw = font * 1.15 + 4;
    ctx.font = font + "px " + BAND_FONT;
    return sw + ctx.measureText(it.name).width;
  }
  function measureLegend(st, ctx, font) {
    const rows = legendRows(st);
    const gap = Math.max(6, Math.round(font * 0.5));
    const rowH = Math.round(font * 1.5);
    const widths = rows.map((row) => {
      let w = 0;
      row.forEach((it, i) => { w += (i ? gap : 0) + legItemW(ctx, it, font); });
      return w;
    });
    return { rows, gap, rowH, widths, totalH: rows.length * rowH };
  }
  function drawLegendItemScaled(ctx, it, x, cy, font, textColor) {
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    if (it.kind === "dot") {
      const r = font * 0.42;
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(x + r, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.16)"; ctx.lineWidth = Math.max(0.6, font * 0.08); ctx.stroke();
      x += r * 2 + 4;
    } else if (it.kind === "bar") {
      const bw = font * 1.15, bh = font * 0.7, r = bh * 0.4;
      ctx.fillStyle = "#ffffff";
      roundRectPath(ctx, x, cy - bh / 2, bw, bh, r); ctx.fill();
      ctx.fillStyle = it.color;
      roundRectPath(ctx, x + bw * 0.15, cy - bh * 0.3, bw * 0.7, bh * 0.6, r * 0.6); ctx.fill();
      x += bw + 4;
    } else if (it.kind === "arrow") {
      const aw = font * 1.15, ah = font * 0.8, ay = cy - ah / 2;
      ctx.strokeStyle = textColor; ctx.lineWidth = Math.max(1.2, font * 0.1); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x + ah * 0.2, cy);
      ctx.lineTo(x + aw - ah * 0.4, cy);
      ctx.moveTo(x + aw - ah * 0.7, cy - ah * 0.3);
      ctx.lineTo(x + aw - ah * 0.15, cy);
      ctx.lineTo(x + aw - ah * 0.7, cy + ah * 0.3);
      ctx.stroke();
      x += aw + 4;
    } else {
      ctx.font = Math.round(font * 1.15) + "px " + BAND_FONT;
      ctx.fillStyle = textColor;
      const iw = ctx.measureText(it.icon).width;
      ctx.fillText(it.icon, x, cy + 0.5);
      x += iw + 4;
      ctx.font = font + "px " + BAND_FONT;
    }
    ctx.fillStyle = textColor;
    ctx.fillText(it.name, x, cy);
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

        // 标题/副标题/图例 比例字号 + 顶部带高（随画布宽 W 缩放，不同导出比例更和谐）
        const titleFont = Math.max(15, Math.round(w * 0.045));
        const subFont = Math.max(10, Math.round(w * 0.024));
        const legFont = Math.max(9, Math.round(w * 0.02));
        const titleY = Math.round(titleFont * 0.95);
        const subY = titleY + Math.round(titleFont * 0.75) + Math.round(subFont * 0.55);
        const legendGap = Math.round(subFont * 0.8);
        const legTop = subY + Math.round(subFont * 0.7) + legendGap;
        const _mctx = document.createElement("canvas").getContext("2d");
        const _leg = measureLegend(st, _mctx, legFont);
        const topBand = legTop + (_leg.rows.length ? _leg.totalH : 0) + Math.round(legFont * 0.6) + 6;

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
          const W = w, H = h + topBand;
          const cv = document.createElement("canvas");
          cv.width = Math.round(W * s);
          cv.height = Math.round(H * s);
          const ctx = cv.getContext("2d");
          ctx.scale(s, s);
          const dispBg = App.displayBg(); // 夜间模式下导出图跟随当前模式（深色）
          ctx.fillStyle = dispBg;
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(chartCanvas, 0, topBand, w, h);

          const fg = App.readableTextColor(dispBg);
          const title = st.title || "未命名关系图";
          const filler = App.getFiller();
          const subtitle = filler
            ? "填表：" + filler + "　制表：小红书小工具@CP-Chart"
            : "制表：小红书小工具@CP-Chart";
          // 顶部带本身是纯色底、文字颜色已按对比度反色 → 标题/署名不再垫半透明块（曾看起来像一块多余的色块）
          drawCaption(ctx, title, W / 2, titleY, titleFont, "600 ", fg);
          drawCaption(ctx, subtitle, W / 2, subY, subFont, "400 ", fg);

          // ③ 图例：副标题下方居中、三行（箭头方向 / 粗线喜好 / 细线关系）
          if (_leg.rows.length) {
            let ly = legTop + _leg.rowH / 2;
            _leg.rows.forEach((row, ri) => {
              let lx = (W - _leg.widths[ri]) / 2;
              row.forEach((it, i) => {
                drawLegendItemScaled(ctx, it, lx, ly, legFont, fg);
                lx += (i ? _leg.gap : 0) + legItemW(ctx, it, legFont);
              });
              ly += _leg.rowH;
            });
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
