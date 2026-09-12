/*
 * CP Chart · 全局文案软代码（i18n 字典）
 * ------------------------------------------------------------
 * 作用：
 *   1. 所有「长文档类」文案（帮助 / 关于 / 欢迎 / 提示 / 批量录入语法说明）
 *      集中在此，改文案不必动 ui.js —— 你直接在这里改字即可。
 *   2. 国际化预留：pack 里再加一门语言（如 en）即可导入翻译包，
 *      运行时 I18N.setLang('en') 切换；缺词自动回退中文（zh）。
 *
 * 用法（ui.js 里）：
 *   - 取字符串文案：  I18N.t('help_title')
 *   - 取数组型文案：  I18N.txt.about_future   （如列表，逐条 map 成 <li>）
 *   - 切换语言：      I18N.setLang('en')        （需先 I18N.loadPack('en', {...})）
 *   - 导入语言包：    I18N.loadPack('en', enDict)
 *
 * 加新语言示例：
 *   I18N.loadPack('en', { help_title: "CP Chart Guide", help_body: "...", ... });
 *   I18N.setLang('en');
 */
(function () {
  var pack = {
    zh: {
      // ---------------- 帮助弹窗 ----------------
      help_title: "CP Chart 使用指南",
      help_body: `<div class="help-card">
  <div class="help-intro">轻量/高效/便捷/极简/人类友好的角色关系连线图。用最快的方式帮助绘制！</div>

  <div class="help-h">快速开始！</div>
  <div class="help-step"><b>第一步 · 录入人物</b>：<br>「人物」→「<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 20C22.866 20 26 16.866 26 13C26 9.13401 22.866 6 19 6C15.134 6 12 9.13401 12 13C12 16.866 15.134 20 19 20Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"></path><path d="M36 29V41M30 35H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path><path d="M27 28H18.8C14.3196 28 12.0794 28 10.3681 28.8719C8.86278 29.6389 7.63893 30.8628 6.87195 32.3681C6 34.0794 6 36.3196 6 40.8V42H27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg>批量编辑名单」; 或者悬浮窗+号→导入数据<br>
    <code>1: 甲，乙，丙</code><br><code>2: 丁，戊，己，庚</code><br>
    中英文逗号、空格都能分隔。<code>圆心: 某人</code> 或 <code>0: 某人</code> 把某人放最中间；直接写 <code>1:</code> 也可以，圆心就先空着。</div>
  <div class="help-step"><b>第二步 · 画连线</b>：点底部「连线」，先选好三样：<br>
    ◯ 粗线 = 喜好度（本命 / 很喜欢 / 路好 / 不吃）<br>
    ● 细线 = 关系类型（爱情 / 友情 / 亲情 / QPR）<br>
    ➜ 箭头 = 方向（无 / 单箭头 / 双箭头）<br>
    然后在角色圆上按住，拖到另一个角色上松手，线就画好了。同一对人后画的会盖掉先画的；A→B 和 B→A 的单箭头可以各画各的，用不同颜色区分。</div>
  <div class="help-step"><b>第三步 · 导出</b>：点画布右侧的「菜单」→ 可以导出图片存相册、复制名单文本、备份完整快照，或直接发布笔记。</div>

  <div class="help-h">各 Tab 是干嘛的</div>
  <div class="help-tab"><b>样式</b>：调颜色、改图例名字、决定哪些类型显示/隐藏、换背景色</div>
  <div class="help-tab"><b>人物</b>：导入或编辑名单、传头像、设喜好度、定圆心</div>
  <div class="help-tab"><b>连线</b>：选笔刷、画线/删线、批量整理、看连线记录</div>
  <div class="help-tab"><b>布局</b>：拖动换圈、调圈大小、加/减轨道、一键均匀排布</div>
  <div class="help-tab"><b>抓手</b>：纯看图、隐藏界面截图、存图片</div>

  <div class="help-h">常用操作小贴士</div>
  <div class="help-tip">
    • <b>拖角色换圈</b>：布局模式按住角色，拖到目标圈附近松手<br>
    • <b>调圈半径</b>：拖圈顶 12 点方向的蓝色小圆点，或在布局面板输入数值<br>
    • <b>删线</b>：连线 →「{{eraser}} 删线模式」，点一下线就删掉这对之间的全部关系线<br>
    • <b>撤销/重做</b>：画布右侧悬浮 ↩︎ / ↪︎ 可回退几乎所有操作<br>
    • <b>改图名 / 填表人</b>：菜单 → 工具 → 改图名 / 填表人<br>
    • <b>缩放/平移</b>：双指缩放，单指拖空白区域平移<br>
    • <b>找不着图了？</b>点画布右侧悬浮 <b>¤ 定位坐标</b>，圆心立刻回到画面正中，并自动缩放到全部轨道可见<br>
    • <b>图例直切</b>：点画布左上角图例色块可直接切换对应笔刷</div>

  <div class="help-h">关于数据安全</div>
  <div class="help-tip">
    • 数据只存在你这台设备的本地草稿里，不会上传、不会外泄<br>
    • 编辑会自动存草稿；想长期保存就点「导出完整快照」，把那段文本发到别的设备再「导入快照」就能恢复<br>
    • 快照不含头像，导入后头像要重新传一下</div>

  <div class="help-end">还有问题？点「菜单 → 关于」能看到版本和作者信息。祝你用得顺手！</div>
</div>
<div class="modal-btns"><button class="btn primary" data-cmd="m-close">{{ok}}</button></div>`,

      // ---------------- 关于页 ----------------
      about_sub: "快速 · 方便 · 友好 · 直观 | 人物关系图生成器",
      about_date: "更新于 2026-09-12",
      about_sec_log: "📌 更新日志",
      about_sec_future: "🔮 未来前瞻",
      about_future: [
        "导入双入口：拆分「全量覆盖」与「增量导入」，覆盖后能直接看到删了什么",
        "超点与时间轴：一个角色占多圈 / 多时间点的可视化",
        "视图记忆：导出或切 Tab 后保留当前缩放与平移位置",
        "界面结构整体重排：操作更顺手",
        "手感升级：触控与交互细节打磨（触点放大、反馈更跟手）",
        "更多功能期待反馈",
      ],
      about_sec_credit: "👤 制作",
      about_credit: [
        "小红书号：6357261896",
        "小红书小工具@CP-Chart",
        "基于 vibecoding 构建",
      ],
      btn_ok: "知道了",

      // ---------------- 欢迎引导 ----------------
      welcome_title: "欢迎 · 人物关系连线图",
      welcome_guide: "三步走完即可开工：一填图名（顶栏显示用），二填表人（导出署名，可留空），三粘角色名单（一行一圈：<code>圆心: 我</code>、<code>1: 甲，乙，丙</code>）。不想手敲直接点「载入示例」。",
      welcome_lbl_title: "图名",
      welcome_lbl_filler: "填表人（可选）",
      welcome_lbl_list: "角色名单",
      welcome_ph_title: "未命名关系图",
      welcome_ph_filler: "未填写则不显示“填表：”",
      welcome_ph_list: "圆心: 我&#10;1: 甲，乙，丙&#10;2: 丁，戊，己",
      welcome_btn_skip: "跳过",
      welcome_btn_start: "开始编辑",
      welcome_btn_load: "载入示例",
      welcome_btn_load_title: "把示例名单塞进上面文本框",
      welcome_toast_load: "已载入示例名单",

      // ---------------- 布局说明（提示） ----------------
      layout_hint: "拖拽角色时，可以更换轨道/沿轨道移动角色位置；<br><b>槽位关</b>时，角色圆可以以不规则间距停在轨道任意角度，不会自动均分，想恢复整齐时点「平均排布」。<br><b>槽位开</b>时，角色圆则会自动吸附到就近空槽中，槽位数量必须大于轨道上的人物数量。<br>拖动圈顶蓝点可以改半径；点角色时出现操作条。",

      // ---------------- 连线空态（提示） ----------------
      link_empty_filtered: "「{{name}}」暂无连线",
      link_empty_none: "暂无连线。先在下方选笔刷，再点角色拖向另一个角色。",

      // ---------------- 模式切换 Toast（提示） ----------------
      toast_char_brush: "角色模式开：点/划人物赋「{{brush}}」",
      toast_char_nobrush: "角色模式开：先选一个粗线（喜好度）笔刷",
      toast_erase: "删线模式开：点一条线即删除这对之间的全部关系线，点人物筛选其相关连线",

      // ---------------- 统一编辑器：批量录入（人物名单） ----------------
      ed_people_title: "批量录入",
      ed_people_hint: "粘贴名单（按圈号）或一整份 CPChart 文本——自动识别类型。只增不减，不覆盖已有内容。",
      ed_people_ph: "0：甲；1：乙，丙，丁，戊，己，庚，辛；2：A，B，C，D，E，F，G，H",
      ed_people_help: "<b>两种内容都收</b>，按类型自动识别：<br>· <b>只写名单</b>：<code>0：甲</code>（圆心）、<code>1：乙，丙</code>（第 1 圈）、<code>2：丁，戊</code>（第 2 圈）——冒号后写名字，分号「；」等于换行。<br>· <b>整份关系表</b>：直接粘贴一整份 CPChart 文本，也会自动读进来。<br>改名 / 删人 / 加人，直接改文字后点「保存」。",

      // ---------------- 统一编辑器：全量覆盖（整份 CPChart 文本） ----------------
      ed_link_title: "全量覆盖",
      ed_link_hint: "粘贴一整份 CPChart 文本，整体替换画板——文本里没写的人物与连线会被删除。",
      ed_link_ph: "#标题{我的CP图；!填表人：我的名字}\n.布局{0：甲；1：乙，丙，丁}\n@关系{爱情：甲 -> 乙；宿敌：丁 -> 戊}\n!喜好 原子{本命：甲；很喜欢：乙，丙}",
      // ⚠️ 提示文案若写成多行，必须用反引号（模板字符串）包裹；用双引号跨行 = 语法错误会整站崩
      ed_link_help: `恭喜！你找到了 CPChart 的高级用法。你可以批量导入导出、编辑文字，甚至让 AI 帮你分析你喜欢什么样的关系。<br><br>
先认识几个标点。<br><br>
<b>「！」</b>是只有你能填、AI 不能代写的部分：你的喜好，你的感受，你对这些 CP 的理解。<b>「你」不在这张表上，「你」无处不在。</b><br>
所以，好好写上 <code>!填表人：你的名字</code>，然后展示表格吧！<br>
（它写在开头的标题块里，例如 <code>#标题{我的关系图；!填表人：你的名字}</code>）<br><br>
<b>「.」</b>是可以复制粘贴的部分 —— 交给别人，他们就能从你整理好的名单开始，建自己的图。<br><br>
<b>【布局】</b><br>
<code>0：甲</code> —— 圆心，通常写主角；群像作品可以留空<br>
<code>1[4,150px]：乙， ，丙，丁</code> —— 第 1 圈 4 个槽位（空位默认排最后；这样写是把空位显式放在第二个位置），半径 150px<br>
<code>2：戊，己</code> —— 圈号越大，人越靠外<br><br>
<b>【谁和谁是什么关系】</b><br>
<code>崇拜：甲 -> 乙</code> —— 甲指向乙<br>
<code>爱情：乙 &lt;-&gt; 丙</code> —— 互相<br>
<code>友情：丁 * 戊</code> —— 不分方向<br>
（「&lt;-&gt;」相当于一条「*」加上「-&gt;」和「&lt;-」；只想表达一个方向时，单独写那一条就行）<br>
（粗线词：本命 / 很喜欢 / 路好 / 不吃 = 有多喜欢；细线词：爱情 / 友情 / 亲情 / QPR = 是什么关系）<br><br>
<b>「@」</b>标记可被视作「超点」的对象 —— 一对 CP 由两个人组成，但「喜好」标记的 AB 是「一个对象」；而「关系」字段存的，就是这些超点到底是什么。<br>
<code>!喜好 原子{}</code> 标记作为原子的角色，<code>!喜好 关系{}</code> 标记作为超点的关系。<br><br>
<b>【.样式】</b>存的是图例，分两类：<code>favor</code>（喜好度）与 <code>relation</code>（关系型）。区别很直接：是「我」喜欢这两个人的关系，还是「这两个人」本身是什么关系。<br>
新词只写一个颜色就行（如 <code>#031499</code>），其余自动补全。<br>
你甚至可以把「情感指向」改成「攻受」再分享出去，让 AI 看看你的口味 —— CPChart 奖励那些与众不同的差异：作者相信，正是偏离标准值的部分构成了你。哪怕是热门 CP 粉，也一样会有属于自己的「关系理解」。<br><br>
<b>⚠️ 这里是整体替换：没写进文本的人物和连线会被删掉。只想往上加人，请到「批量录入」页。</b>`, 

      // ---------------- 统一编辑器：数据包（导出 / 导入） ----------------
      ed_data_import_title: "导入数据包",
      ed_data_import_hint: "粘贴一整份数据串。",
      ed_data_import_ph: "在这里粘贴数据串",
      ed_data_import_help: "把别人给你的整串数据粘进来，点「上传」。<br>导入会覆盖当前画板全部内容。",
      ed_data_export_title: "导出数据包",
      ed_data_export_hint: "长按输入框手动全选复制。",
      ed_data_export_help: "这串文字包含人物、连线、布局、图例、头像的全部信息。<br>复制后发给别人，对方在「导入数据包」粘贴即可还原。",
    },
    // 国际化预留：填一门英文包即可 I18N.setLang('en')
    en: null,
  };

  var lang = "zh";
  function current() { return pack[lang] || pack.zh; }

  function t(key) {
    var c = current();
    if (c && c[key] !== undefined) return c[key];
    if (pack.zh[key] !== undefined) return pack.zh[key]; // 缺词回退中文
    return key;
  }

  window.I18N = {
    pack: pack,
    get txt() { return current(); },   // 数组型文案用 I18N.txt.xxx
    get lang() { return lang; },
    setLang: function (l) { if (pack[l]) { lang = l; return true; } return false; },
    loadPack: function (l, dict) { pack[l] = dict; },
    t: t,
  };
})();
