/* ui.js —— 面板渲染、Tab、菜单、弹窗、Toast */
(function () {
  const App = (window.App = window.App || {});

  App.activeTab = "link";
  App.fullUI = false;
  App.panelMode = "half";   // 底部二级面板四档：collapsed / min / half / full（单源；panelCollapsed/panelMin/panelFull 为派生 bool 供旧 API 读取）
  App.panelCollapsed = false; // 派生：== (App.panelMode === "collapsed")
  App.panelMin = false;        // 派生：== (App.panelMode === "min")，最简展开：只显各 Tab 第一行必要功能
  App.panelFull = false;      // 派生：== (App.panelMode === "full")
  let modalCloseCb = null;
  let pendingAvatarFor = null;
  let lastColorFocus = null;
  let nodeRBefore = null; // 角色圆圈滑块拖动前的值（用于一次性记历史，避免每像素一条 undo）

  // 批量编辑名单按钮图标（内联 SVG，currentColor 跟随按钮文字色，夜间自动变浅）
  const IC_PEOPLE_PLUS =
    '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M19 20C22.866 20 26 16.866 26 13C26 9.13401 22.866 6 19 6C15.134 6 12 9.13401 12 13C12 16.866 15.134 20 19 20Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M36 29V41M30 35H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M27 28H18.8C14.3196 28 12.0794 28 10.3681 28.8719C8.86278 29.6389 7.63893 30.8628 6.87195 32.3681C6 34.0794 6 36.3196 6 40.8V42H27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  // 内联 SVG 图标表（沿用 .ic-svg 规范：currentColor 描边，夜间自动变浅）
  const ICONS = {
    del:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg>',
    starLine: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z"/></svg>',
    starFill: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" stroke-linejoin="round"><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z" fill="#f5a623" stroke="#f5a623" stroke-width="4"/></svg>',
    person: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
    like:   '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 8C8.92487 8 4 12.9249 4 19C4 30 17 40 24 42.3262C31 40 44 30 44 19C44 12.9249 39.0751 8 33 8C29.2797 8 25.9907 9.8469 24 12.6738C22.0093 9.8469 18.7203 8 15 8Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    compat: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h12l-3-3M20 16H8l3 3"/></svg>',
    eye:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7c2 0 3.7.7 5 1.8M22 12s-4 7-10 7c-2 0-3.7-.7-5-1.8"/><path d="M3 3l18 18"/></svg>',
    search: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    // 「筛选」：素材库的「筛选_filter」svg（currentColor 跟随主题）
    filter: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L20.4 25.8178V38.4444L27.6 42V25.8178L42 9H6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
    eraser: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 42H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 4L7 28L13 34H21L41 14L31 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>',
    moon:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>',
    save:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h12l4 4v14H5z"/><path d="M8 3v6h7V3M8 21v-6h7v6"/></svg>',
    hide:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    brush:  '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.9897 22.6108L24.8892 32.5103"/><path d="M14.9897 22.6108L6.50447 31.0961C3.7708 33.8298 3.7708 38.2619 6.50447 40.9956V40.9956C9.23814 43.7293 13.6703 43.7293 16.404 40.9956L24.8892 32.5103"/><path d="M14.9897 32.5103L10.7471 36.7529"/><path d="M24.8892 32.5102L39.7966 26.0778C42.4838 24.9183 43.605 21.6988 41.8821 19.3331C37.7183 13.6159 32.1049 8.60333 27.9636 5.53585C25.6741 3.83998 22.6337 4.8951 21.5049 7.51115L14.9897 22.6107L24.8892 32.5102Z" fill="none"/></svg>',
    pen:    '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.9995 8.99902L38.9995 16.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.99953 31.999L35.9994 4L43.9995 11.999L15.9995 39.999L5.99951 41.999L7.99953 31.999Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30.9995 8.99902L38.9995 16.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.99951 31.999L15.9995 38.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.9995 34.999L34.9995 12.999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    style:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.2-1-1.5-1-2.5s1-1.5 2-1.5h1a4 4 0 0 0 4-4c0-4.4-4-6-7-6z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10.5" r="1"/></svg>',
    hand:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v5M16 9a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.6L4 16a1.5 1.5 0 0 1 2.5-1.6L7 15"/></svg>',
    layout: '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10.5"/></svg>',
    globe:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    link:   '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 39.3706C16.3908 41.6439 20.0371 42.9999 24 42.9999C27.9629 42.9999 31.6092 41.6439 34.5 39.3706" stroke="currentColor" stroke-width="4"/><path d="M19 9.74707C12.0513 11.8822 7 18.3511 7 25.9999C7 27.9247 7.31989 29.7748 7.9094 31.4999" stroke="currentColor" stroke-width="4"/><path d="M29 9.74707C35.9487 11.8822 41 18.3511 41 25.9999C41 27.9247 40.6801 29.7748 40.0906 31.4999" stroke="currentColor" stroke-width="4"/><path d="M43 36C43 37.3416 42.4716 38.5597 41.6117 39.4577C40.7015 40.4082 39.4199 41 38 41C35.2386 41 33 38.7614 33 36C33 33.9899 34.1861 32.2569 35.8967 31.4626C36.536 31.1657 37.2487 31 38 31C40.7614 31 43 33.2386 43 36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 36C15 37.3416 14.4716 38.5597 13.6117 39.4577C12.7015 40.4082 11.4199 41 10 41C7.23858 41 5 38.7614 5 36C5 33.9899 6.18614 32.2569 7.89667 31.4626C8.53604 31.1657 9.24867 31 10 31C12.7614 31 15 33.2386 15 36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 9C29 10.3416 28.4716 11.5597 27.6117 12.4577C26.7015 13.4082 25.4199 14 24 14C21.2386 14 19 11.7614 19 9C19 6.98991 20.1861 5.25686 21.8967 4.4626C22.536 4.16572 23.2487 4 24 4C26.7614 4 29 6.23858 29 9Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    dlIn:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>',
    dlOut:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 5h16"/></svg>',
    pkg:    '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    plus:   '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    distributeH: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 43L8 5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M40 43L40 5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="20" y="14" width="8" height="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    // 「添加角色」：素材库的「添加_add-three」svg（currentColor 跟随主题）
    addBox: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 32V16M42 27V21M6 27V21M14 6H8C6.89543 6 6 6.89543 6 8V14M34 6H40C41.1046 6 42 6.89543 42 8V14M34 42H40C41.1046 42 42 41.1046 42 40V34M14 42H8C6.89543 42 6 41.1046 6 40V34M27 6H21M32 24H16M27 42H21" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    help:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.1" fill="currentColor"/></svg>',
    // 箭头：单箭头向右（取自素材库的「箭头上」svg，旋转 90°）
    arrowR: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none"><g transform="rotate(90 24 24)"><path d="M24 6V42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18L24 6L36 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>',
    ringB:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="7"/></svg>',
    ringT:  '<svg class="ic-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6.5"/></svg>',
    swap:   '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M14 4l4 4-4 4M20 16H7M10 20l-4-4 4-4"/></svg>',
    // 以下 7 个：二级菜单项图标（素材库矢量，currentColor 跟随主题）
    newDoc: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 10V7C19 5.89543 19.8954 5 21 5H41C42.1046 5 43 5.89543 43 7V29C43 30.1046 42.1046 31 41 31H37" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="18" width="24" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 25V35" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 30H22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    send:   '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43 5L29.7 43L22.1 25.9L5 18.3L43 5Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M43.0001 5L22.1001 25.9" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copyOne:'<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 38H41V16H30V4H13V38Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4L41 16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 20V44H28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 20H23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M19 28H31" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    filePlus:'<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 23V14L31 4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44H22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 29V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 36H33H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4V14H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    filePen:'<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 23V14L31 4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44H22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 44L42 34L38 30L28 40V44H32Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4V14H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    peopleGr:'<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="29" r="5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34" cy="29" r="5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="9" r="5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 44C24 38.4772 19.5228 34 14 34C8.47715 34 4 38.4772 4 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 44C44 38.4772 39.5228 34 34 34C28.4772 34 24 38.4772 24 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 24C34 18.4772 29.5228 14 24 14C18.4772 14 14 18.4772 14 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    imgOut: '<svg class="ic-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44 24C44 22.8954 43.1046 22 42 22C40.8954 22 40 22.8954 40 24H44ZM24 8C25.1046 8 26 7.10457 26 6C26 4.89543 25.1046 4 24 4V8ZM39 40H9V44H39V40ZM8 39V9H4V39H8ZM40 24V39H44V24H40ZM9 8H24V4H9V8ZM9 40C8.44772 40 8 39.5523 8 39H4C4 41.7614 6.23857 44 9 44V40ZM39 44C41.7614 44 44 41.7614 44 39H40C40 39.5523 39.5523 40 39 40V44ZM8 9C8 8.44772 8.44771 8 9 8V4C6.23858 4 4 6.23857 4 9H8Z" fill="currentColor"/><path d="M6 35L16.6931 25.198C17.4389 24.5143 18.5779 24.4953 19.3461 25.1538L32 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 31L32.7735 26.2265C33.4772 25.5228 34.5914 25.4436 35.3877 26.0408L42 31" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 13L37 18L42 13" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 6L37 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  App.ICONS = ICONS; // 暴露给 render.js 用（抓手 chip 内嵌 SVG）

  const $ = App.byId;

  // =============== Tab 切换 ===============
  // 面板四档（折叠/最简/半开/全开）单源：App.panelMode
  // 旧 API（setPanelCollapsed / setPanelFull）作为兼容壳保留，switchTab、homeBtn 等旧调用方不破
  App.setPanelMode = function (m, opts) {
    if (m !== "collapsed" && m !== "min" && m !== "half" && m !== "full") return;
    App.panelMode = m;
    App.panelCollapsed = (m === "collapsed");
    App.panelMin = (m === "min");
    App.panelFull = (m === "full");
    document.body.classList.toggle("panel-collapsed", App.panelCollapsed);
    document.body.classList.toggle("panel-min", App.panelMin);
    document.body.classList.toggle("panel-full", App.panelFull);
    const head = $("panelHead");
    if (head) head.setAttribute("data-state", m);
    const home = $("homeBtn");
    if (home) home.classList.toggle("hidden", !App.panelFull);
    // 离开拖动状态：清掉 inline 高度（让 class 重新接管）
    if (!(opts && opts.keepDragHeight)) {
      const p = $("panel");
      if (p) {
        p.classList.remove("dragging");
        // 强制回流：让 transition 在同帧内立即恢复，否则浏览器会把「去过渡 + 改高度」
        // 合并成一次跳变，松手吸附就没有动画了（v0.14.17）
        void p.offsetHeight;
        p.style.maxHeight = "";
      }
      if (head) head.classList.remove("dragging");
    }
  };
  // 兼容壳
  App.setPanelCollapsed = function (v) {
    if (v) App.setPanelMode("collapsed");
    else if (App.panelMode === "collapsed") App.setPanelMode("half");
  };
  // 面板全开态：返回钮出现在左上（避开容器左上角按钮）
  App.setPanelFull = function (v) {
    if (v) App.setPanelMode("full");
    else if (App.panelMode === "full") App.setPanelMode("half");
  };
  // =============== 画板模式（连线/角色/删线 三选一 Switch）===============
  // 单一状态 App.paintMode；App.eraser / state.ui.charMode 作为派生量同步维护，避免三个布尔开关并存导致互斥漏洞
  App.syncPaintMode = function () {
    const m = (App.state && App.state.ui && App.state.ui.charMode) ? "char" : "link";
    App.paintMode = m;
    App.eraser = false;
  };
  App.setPaintMode = function (m) {
    if (m !== "link" && m !== "char" && m !== "erase") return;
    if (App.paintMode === m && m !== "link") m = "link"; // 同段再点 = 回到连线模式（保留 toggle 体感）
    App.paintMode = m;
    App.eraser = (m === "erase");
    if (App.state && App.state.ui) App.state.ui.charMode = (m === "char");
    App.linkSource = null;
    App.dragGhost = null;
    App.pendingLinkDel = null;
    if (m === "char") {
      App.toast(App.brush && App.brush.bottom
        ? I18N.t("toast_char_brush").replace("{{brush}}", App.nameOf("bottom", App.brush.bottom))
        : I18N.t("toast_char_nobrush"));
    } else if (m === "erase") {
      App.toast(I18N.t("toast_erase"));
    }
    if (App.render) App.render();
    if (App.renderPanel) App.renderPanel();
  };
  // 启动时按当前 state.ui.charMode 对齐一次（兼容旧草稿 charMode=true 加载）
  App.syncPaintMode();
  App.switchTab = function (tab) {
    App.activeTab = tab;
    App.pendingLinkDel = null; // 切 Tab 清除删线待确认态
    if (App.panelCollapsed) App.setPanelCollapsed(false); // 切 Tab 视为要操作面板 → 自动展开
    if (App.panelFull) App.setPanelFull(false); // 切 Tab 一律回半开
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tab") === tab);
    });
    if (tab !== "layout") {
      App.selCharId = null;
      $("nodeOps").classList.add("hidden");
    }
    renderPanel();
    App.render();
  };

  // =============== 面板渲染 ===============
  function renderPanel() {
    const p = $("panel");
    const t = App.activeTab;
    if (t === "style") p.innerHTML = panelStyle();
    else if (t === "person") p.innerHTML = panelPerson();
    else if (t === "link") p.innerHTML = panelLink();
    else if (t === "layout") p.innerHTML = panelLayout();
    else if (t === "hand") p.innerHTML = panelHand();
    if (t === "layout") updateNodeOps();
  }

  // ---------- 样式 ----------
  function tableRows(layer, isArrow) {
    const tb = App.state.tables[layer];
    return tb.map((r) => {
      if (isArrow) {
        const icon = r.type === "one" ? "➜" : r.type === "both" ? "⇄" : "—";
        return `<div class="trow">
          <span class="mini" style="width:18px;text-align:center">${icon}</span>
          <span class="tname"><input type="text" data-row-edit="name" data-layer="${layer}" data-key="${r.key}"
            maxlength="20" value="${App.esc(r.name)}" placeholder="名称" ${r.key === "none" ? "readonly" : ""}></span>
          ${r.key === "none" ? "" : `<span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">${ICONS.del}</span>`}
        </div>`;
      }
      return `<div class="trow${r.hidden ? " off" : ""}">
        <span class="sw" style="background:${r.color};border-color:var(--legend-edge)"></span>
        <input type="color" value="${r.color}" data-row-edit="color" data-layer="${layer}" data-key="${r.key}">
        <span class="tname"><input type="text" data-row-edit="name" data-layer="${layer}" data-key="${r.key}"
          maxlength="20" value="${App.esc(r.name)}" placeholder="名称"></span>
        <span class="pal">${PALETTE.map((c) => `<i data-cmd="pal" data-layer="${layer}" data-key="${r.key}" data-c="${c}" style="background:${c}"></i>`).join("")}</span>
        <span class="mini eye ${r.hidden ? "off" : ""}" data-cmd="tbl-hide" data-layer="${layer}" data-key="${r.key}"
          title="${r.hidden ? "已隐藏（不进图例、连线也隐藏），点一下恢复" : "点一下隐藏（不进图例，连线也一起隐藏）"}">${r.hidden ? ICONS.eyeOff : ICONS.eye}</span>
        <span class="mini danger del" data-cmd="tbl-del" data-layer="${layer}" data-key="${r.key}">${ICONS.del}</span>
      </div>`;
    }).join("");
  }

  const PALETTE = ["#d32f2f", "#f57c00", "#ffb300", "#6d4c41", "#88d90b", "#008080", "#2196f3", "#7054bc", "#f06292", "#222222", "#888888", "#f0f0f0"];

  function panelStyle() {
    const arrowName = (App.state.meta && App.state.meta.arrowName) ? String(App.state.meta.arrowName) : "情感指向";
    const night = !!(App.state.ui && App.state.ui.night);
    return `<div class="pg">
      <div class="ctrl-row">外观：
        <div class="paint-seg" role="tablist" aria-label="外观模式">
          <button class="paint-seg-btn ${!night ? "active" : ""}" data-cmd="ui-night" data-val="day" title="日间模式：浅色外壳">${ICONS.sun}<span class="lbl">日间</span></button>
          <button class="paint-seg-btn ${night ? "active" : ""}" data-cmd="ui-night" data-val="night" title="夜间模式：深色外壳">${ICONS.moon}<span class="lbl">夜间</span></button>
        </div>
        <span class="seg-spacer"></span>
        <span class="sw-txt">背景色：</span><input type="color" data-set="bg" value="${App.state.bg}">
      </div>
      <div class="pg-t"><span class="pg-t-l">${ICONS.ringB} 底层色（喜好等级 · 粗线）</span><button class="mini" data-cmd="tbl-add" data-layer="bottom" aria-label="添加底层色">${ICONS.plus}</button></div>
      <div>${tableRows("bottom", false)}</div>
      <div class="pg-t"><span class="pg-t-l">${ICONS.ringT} 顶层色（关系类型 · 细线+白描边）</span><button class="mini" data-cmd="tbl-add" data-layer="top" aria-label="添加顶层色">${ICONS.plus}</button></div>
      <div>${tableRows("top", false)}</div>
      <div class="pg-t">${ICONS.arrowR} 箭头含义</div>
      <div class="trow"><span class="lg-ic">${ICONS.arrowR}</span>
        <span class="tname"><input type="text" data-set="arrowName" value="${App.esc(arrowName)}" placeholder="情感指向"></span>
      </div>
      <div class="pg-t">细线描边样式</div>
      <div class="ctrl-row">描边粗细
        <input type="range" data-set="thinW" min="2.2" max="10" step="0.2" value="${App.state.ui.thinW || 6.5}" style="flex:1">
        <span class="thinW-val" style="width:44px;text-align:right">${(App.state.ui.thinW || 6.5)}</span>
      </div>
      <div class="ctrl-row">
        <span style="color:var(--sub);font-size:11px">细线（顶层关系线）的外圈白描边宽度</span></div>
    </div>`;
  }

  // ---------- 人物 ----------
  function avaInner(c) {
    if (c.avatar) return `<img src="${c.avatar}" alt="">`;
    return "👤";
  }
  // 「添加角色」：取最小未占用的「新角色N」（如已存在新角色1，则下一个是新角色2）
  function nextNewCharName() {
    const used = {};
    App.state.chars.forEach(function (c) { used[c.name] = 1; });
    let i = 1;
    while (used["新角色" + i]) i++;
    return "新角色" + i;
  }
  function panelPerson() {
    const st = App.state;
    // 路径筛选进行中：把链上的人按「起点 → 第1层 → 第2层…」提到前面，同层保持原顺序；
    // 不在链上的人（另一条链/孤立角色）接在后面，一个不少 —— 只改显示顺序，不动数据
    const fm = App.filterMap(App.filterRoot);
    let list = st.chars;
    if (fm) {
      list = st.chars
        .map((c, i) => ({ c: c, i: i }))
        .sort((A, B) => {
          const da = fm.dist[A.c.id], db = fm.dist[B.c.id];
          return (da === undefined ? Infinity : da) - (db === undefined ? Infinity : db) || A.i - B.i;
        })
        .map((x) => x.c);
    }
    const rows = list.map((c) => {
      const likeOpts = ['<option value="">— 无 —</option>']
        .concat(st.tables.bottom.map((r) => `<option value="${r.key}" ${c.like === r.key ? "selected" : ""}>${App.esc(r.name)}</option>`).join(""));
      const m = st.ui.avatarMode;
      const ringTxt = c.ring === 0 ? "圆心" : `圈${c.ring}`;
      return `<div class="prow" data-pid="${c.id}">
        <div class="ava" data-cmd="pm-avatar" data-id="${c.id}" title="设置头像">${avaInner(c)}</div>
        <div class="pn"><input type="text" data-cmd="pm-rename" data-id="${c.id}" maxlength="20" value="${App.esc(c.name)}" placeholder="角色名"></div>
        <span class="mini" style="color:var(--sub);font-size:11px">${ringTxt}</span>
        <select data-cmd="pm-like" data-id="${c.id}">${likeOpts}</select>
        <button class="mini" data-cmd="pm-center" data-id="${c.id}" title="${c.ring === 0 ? "取消圆心" : "设为圆心"}"><span class="pm-star">${c.ring === 0 ? ICONS.starFill : ICONS.starLine}</span></button>
        <button class="mini danger" data-cmd="pm-del" data-id="${c.id}" title="删除">${ICONS.del}</button>
      </div>`;
    }).join("");

    const rootChar = App.filterRoot ? st.chars.find((c) => c.id === App.filterRoot) : null;
    const rootName = rootChar ? rootChar.name : null;

    return `<div class="pg pg-person">
      <div class="ctrl-row avatar-row">
        <span class="rlab">头像显示</span>
        <div class="paint-seg" role="tablist" aria-label="头像显示">
          <button class="paint-seg-btn ${st.ui.avatarMode === "avatar" ? "active" : ""}" data-cmd="pm-mode" data-val="avatar" title="圆点上显示头像">${ICONS.person}<span class="lbl">头像</span></button>
          <button class="paint-seg-btn ${st.ui.avatarMode === "like" ? "active" : ""}" data-cmd="pm-mode" data-val="like" title="圆点上显示喜好度涂色">${ICONS.like}<span class="lbl">喜好度</span></button>
          <button class="paint-seg-btn ${st.ui.avatarMode === "both" ? "active" : ""}" data-cmd="pm-mode" data-val="both" title="头像+喜好度一起显示">${ICONS.compat}<span class="lbl">兼容</span></button>
        </div>
        <span class="seg-spacer"></span>
        <span class="sw-row"><span class="sw-txt">名字</span><span class="swbox ${st.ui.showNames ? "on" : ""}" data-cmd="pm-names" role="switch" aria-checked="${st.ui.showNames}" aria-label="显示名字"><i></i></span></span>
        <button class="circ-fab" data-cmd="pm-batch" title="按圈批量编辑角色名单" aria-label="批量编辑名单">${IC_PEOPLE_PLUS}</button>
      </div>
      <div class="pg-t"><span class="pg-t-l">角色列表（${st.chars.length}）</span><span class="pg-t-r">${rootName ? "筛选：" + App.esc(rootName) + "（点漏斗退出）" : "点击行内 📷 上传头像"}<button class="mini flt-btn ${App.filterRoot ? "on" : ""}" data-cmd="pm-filter" title="${App.filterRoot ? "退出筛选：恢复全部连线与列表顺序" : "点人物即沿连线高亮；这里可退出筛选"}" aria-label="路径筛选">${ICONS.filter}</button><button class="mini" data-cmd="pm-add" title="添加一个角色" aria-label="添加角色">${ICONS.addBox}</button></span></div>
      ${rows || '<div class="hint">暂无角色，点上方圆形按钮按圈录入</div>'}
    </div>`;
  }

  // ---------- 连线 ----------
  function brushChips() {
    const st = App.state;
    const b = App.brush;
    const bottom = st.tables.bottom.map((r) => `<button class="chip ${b.bottom === r.key ? "on" : ""}" data-cmd="br-b" data-key="${r.key}"><span class="sw" style="background:${r.color}"></span>${App.esc(r.name)}</button>`).join("");
    const top = st.tables.top.map((r) => `<button class="chip ${b.top === r.key ? "on" : ""}" data-cmd="br-t" data-key="${r.key}"><span class="sw sw-top" style="background:${r.color}"></span>${App.esc(r.name)}</button>`).join("");
    const arrow = st.tables.arrow.map((r) => {
      const icon = r.type === "one" ? "➜" : r.type === "both" ? "⇄" : "—";
      return `<button class="chip ${b.arrow === r.key ? "on" : ""}" data-cmd="br-a" data-key="${r.key}"><span class="chip-ic">${icon}</span>${App.esc(r.name)}</button>`;
    }).join("");
    return { bottom, top, arrow };
  }

  function recentLinks() {
    const st = App.state;
    const byId = {};
    st.chars.forEach((c) => (byId[c.id] = c));
    const selName = App.selCharId ? (byId[App.selCharId] ? byId[App.selCharId].name : null) : null;
    let list = st.links.slice().reverse();
    if (selName) {
      const sel = App.selCharId;
      list = list.filter((k) => k.src === sel || k.dst === sel);
    }
    if (!list.length) return `<div class="hint">${selName ? I18N.t("link_empty_filtered").replace("{{name}}", App.esc(selName)) : I18N.t("link_empty_none")}</div>`;
    return list.map((k) => {
      const a = byId[k.src], b = byId[k.dst];
      if (!a || !b) return "";
      const isTop = k.layer === "top";
      const col = isTop ? App.colorOf("top", k.ckey) : App.colorOf("bottom", k.ckey);
      const ar = st.tables.arrow.find((x) => x.key === k.arrow);
      const aName = App.esc(a.name), bName = App.esc(b.name);
      const dot = isTop ? `<span class="ln-thin" style="background:${col}"></span>` : `<span class="ln-dot" style="background:${col}"></span>`;
      return `<div class="dlrow" data-pid="${k.src}">
        <span class="dl-main" data-cmd="link-edit" data-id="${k.id}" title="点击编辑箭头/方向">${dot}<span>${aName} ${ar && ar.type === "one" ? "➜" : ar && ar.type === "both" ? "⇄" : "—"} ${bName}</span></span>
        <button class="mini" data-cmd="filter-link" data-id="${k.src}" title="只看此人连线">${ICONS.search}</button>
        <button class="mini danger" data-cmd="link-del" data-id="${k.id}" title="删除">${ICONS.del}</button>
      </div>`;
    }).join("");
  }

  function panelLink() {
    const c = brushChips();
    return `<div class="pg">
      <div class="ctrl-row seg-row">
        <div class="paint-seg" role="tablist" aria-label="画板模式">
          <button class="paint-seg-btn ${App.paintMode === "link" ? "active" : ""}" data-cmd="paint-set" data-mode="link" title="连线模式：点人物起一条线，再点结束">${ICONS.link}<span class="lbl">连线模式</span></button>
          <button class="paint-seg-btn ${App.paintMode === "char" ? "active" : ""}" data-cmd="paint-set" data-mode="char" title="角色模式：点/划人物批量赋当前粗线笔刷">${ICONS.person}<span class="lbl">角色模式</span></button>
          <button class="paint-seg-btn ${App.paintMode === "erase" ? "active" : ""}" data-cmd="paint-set" data-mode="erase" title="删线模式：点一条线即删除这对之间的全部关系线">${ICONS.eraser}<span class="lbl">删线模式</span></button>
        </div>
        <span class="seg-spacer"></span>
        <button class="btn icon-only" data-cmd="lnk-batch" title="用文字批量编辑喜好度与连线">${ICONS.pen}</button>
        <button class="btn danger icon-only" data-cmd="lnk-clear" title="删除画板上全部连线">${ICONS.del}</button>
      </div>
      <div class="pg-t brushline"><span class="brush-ic">${ICONS.brush}</span><div class="chips">${c.bottom || '<span class="hint">暂无底层色，去样式页添加</span>'}</div></div>
      <div class="pg-t brushline"><span class="brush-ic">${ICONS.pen}</span><div class="chips">${c.top || '<span class="hint">暂无顶层色，去样式页添加</span>'}</div></div>
      <div class="pg-t brushline"><span class="brush-ic">${ICONS.arrowR}</span><div class="chips">${c.arrow}</div></div>
      <div class="pg-t"><span class="pg-t-l"><svg class="ic-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M5.81836 6.72729V14H13.0911" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 24C4 35.0457 12.9543 44 24 44V44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C16.598 4 10.1351 8.02111 6.67677 13.9981" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.005 12L24.0038 24.0088L32.4832 32.4882" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>连线记录</span><span class="pg-t-r">${App.selCharId ? "已按人物筛选" : "点画布人物可筛选"}</span></div>
      ${recentLinks()}
    </div>`;
  }

  // ---------- 布局 ----------
  function ringRows() {
    const st = App.state;
    return st.rings.map((r, i) => {
      const ringNo = i + 1;
      const n = App.charsOnRing(ringNo).length;
      const slotPart = st.ui.slotMode
        ? ` 槽位<input type="number" class="inp" style="width:56px" data-set="slots" data-ring="${ringNo}" value="${Math.max(r.slots || 0, App.SLOT_MIN, n)}" min="${Math.max(1, n)}">`
        : "";
      // 第 1 圈不可删，不提供删除入口
      const delPart = ringNo > 1
        ? `<button class="mini danger" data-cmd="ly-delring" data-ring="${ringNo}" title="删除该轨道">${ICONS.del}</button>`
        : "";
      return `<div class="ctrl-row ring-row"><span style="width:44px">圈${ringNo}</span>
        半径<input type="number" class="inp" style="width:76px" data-set="rad" data-ring="${ringNo}" value="${Math.round(r.rad)}" min="40">
        ${slotPart}<span style="color:#999;font-size:11px">${n}人</span>${delPart}</div>`;
    }).join("");
  }

  function panelLayout() {
    const st = App.state;
    return `<div class="pg">
      <div class="ctrl-row">
        <button class="btn primary" data-cmd="ly-even">${ICONS.distributeH} 平均排布</button>
        <button class="btn" data-cmd="ly-addring">${ICONS.plus} 添加轨道</button>
        <span class="sw-row"><span class="sw-txt">槽位</span><span class="swbox ${st.ui.slotMode ? "on" : ""}" data-cmd="ly-slots" role="switch" aria-checked="${st.ui.slotMode}" aria-label="槽位吸附"><i></i></span></span>
        <span class="seg-spacer"></span>
        <button class="hint-toggle" data-cmd="ly-hint" aria-expanded="${st.ui.layoutHint ? "true" : "false"}" aria-controls="layoutHint" title="${st.ui.layoutHint ? "收起说明" : "展开说明"}">${ICONS.help}</button>
      </div>
      <div id="layoutHint" class="hint ${st.ui.layoutHint ? "" : "hint-collapsed"}">${I18N.t("layout_hint")}</div>
      <div class="pg-t">角色圆圈</div>
      <div class="ctrl-row">大小
        <input type="range" data-set="nodeR" min="${App.NODE_R_MIN}" max="${App.NODE_R_MAX}" step="1" value="${App.nodeR()}" style="flex:1">
        <span id="nodeRVal" style="width:44px;text-align:right">${App.nodeR()}</span>
      </div>
      <div class="pg-t">圈的半径与槽位</div>
      ${ringRows()}
    </div>`;
  }

  // ---------- 抓手 ----------
  function panelHand() {
    const z = Math.round(App.view.s * 100);
    return `<div class="pg">
      <div class="ctrl-row hand-row">
        <button class="btn icon-only" data-cmd="hd-hide" title="${App.fullUI ? "退出全屏" : "隐藏UI全屏"}">${ICONS.hide}</button>
        <div class="zoom-wrap"><span class="zoom-lab">缩放</span>
          <input type="range" id="zoomRange" min="30" max="260" value="${z}" style="flex:1">
          <span id="zoomVal" style="width:44px;text-align:right">${z}%</span>
        </div>
        <button class="btn primary icon-only" data-cmd="hd-save" title="保存图片">${ICONS.save}</button>
      </div>
      <div class="hint">不触发操作，仅移动视口</div>
    </div>`;
  }

  // 节点操作条（布局模式选中角色）
  function updateNodeOps() {
    const box = $("nodeOps");
    const c = App.state.chars.find((x) => x.id === App.selCharId);
    if (App.activeTab !== "layout" || !c) { box.classList.add("hidden"); return; }
    const maxRing = Math.max(1, c.ring, App.state.rings.length);
    let opts = '<option value="0">圆心</option>';
    for (let i = 1; i <= maxRing + 1; i++) {
      opts += `<option value="${i}" ${c.ring === i ? "selected" : ""}>圈${i}</option>`;
    }
    $("opsRingSel").innerHTML = opts;
    // 槽位模式：在圆环选择旁提供「槽位」下拉，仅列出空闲槽（含当前槽），避免重叠
    const slotWrap = $("opsSlotSel");
    if (App.state.ui.slotMode && c.ring > 0) {
      const sl = App.state.rings[c.ring - 1].slots || 0;
      if (sl >= 1) {
        const occ = new Set(App.charsOnRing(c.ring).filter((x) => x.id !== c.id).map((x) => x.slot).filter((s) => s != null));
        // 只显示「槽 N」，不带「（当前）」后缀；未落槽时占位项显示「槽位」
        let so = c.slot == null
          ? `<option value="-1" selected>槽位</option>`
          : `<option value="${c.slot}" selected>槽${c.slot + 1}</option>`;
        for (let s = 0; s < sl; s++) {
          if (occ.has(s) || s === c.slot) continue;
          so += `<option value="${s}">槽${s + 1}</option>`;
        }
        slotWrap.innerHTML = so;
        slotWrap.classList.remove("hidden");
      } else {
        slotWrap.classList.add("hidden");
      }
    } else {
      slotWrap.classList.add("hidden");
    }
    // ⑦ 圆心星标两态：实心=已是圆心（再点取消），空心=可设为圆心（纯 icon，不配文字）
    const isC = c.ring === 0;
    $("opsCenter").innerHTML = `<span class="pm-star">${isC ? ICONS.starFill : ICONS.starLine}</span>`;
    $("opsCenter").title = isC ? "取消圆心" : "设为圆心";
    box.classList.remove("hidden");
  }

  // =============== 菜单 / 弹窗 ===============
  // 夜间模式外壳类同步（画布主题在 render.js 按 ui.night 处理）
  App.applyNight = function () {
    const night = !!(App.state.ui && App.state.ui.night);
    document.body.classList.toggle("night", night);
    if (night) document.body.style.removeProperty("--bg"); // 防 inline 覆盖夜间变量
    else document.body.style.setProperty("--bg", App.state.bg || "#ffffff");
  };
  // 改名弹窗（顶栏标题点击 → 改名）
  App.openTitleModal = function (onSaved) {
    App._titleOkCb = onSaved || null;
    App.openModal(`${modalHead("修改图名 / 填表人")}
      <div style="font-size:12px;color:var(--sub);margin:2px 0 4px">图名</div>
      <input type="text" id="promptTitle" class="inp" style="width:100%" maxlength="18" value="${App.esc(App.state.title)}">
      <div style="font-size:12px;color:var(--sub);margin:12px 0 4px">填表人（可选）</div>
      <input type="text" id="promptFiller" class="inp" style="width:100%" maxlength="12" value="${App.esc(App.getFiller())}" placeholder="未填写则不显示“填表：”">
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="title-ok">确定</button></div>`);
    modalCloseCb = null;
  };
  App.openModal = function (bodyHtml, full) {
    $("modalBox").classList.toggle("full", !!full);
    $("modalBox").innerHTML = bodyHtml;
    $("modalRoot").classList.remove("hidden");
  };
  App.closeModal = function () {
    $("modalRoot").classList.add("hidden");
    $("modalBox").classList.remove("full");
    if (modalCloseCb) { const f = modalCloseCb; modalCloseCb = null; f(); }
  };
  // 连线记录编辑弹窗：改箭头类型（无/单/双）、翻转方向（顶层有向）、删除
  // 同一对角色的所有连线（粗线 + 细线可能各一条）
  function pairOf(k) {
    return App.state.links.filter((x) => (x.src === k.src && x.dst === k.dst) || (x.src === k.dst && x.dst === k.src));
  }
  function eachPair(k, fn) { pairOf(k).forEach(fn); }
  // 箭头 / 翻转的作用对象：优先细线
  function pairTarget(id) {
    const k = App.getLink(id);
    if (!k) return null;
    const list = pairOf(k);
    return list.find((x) => x.layer === "top") || list[0] || null;
  }
  // 设置某一层的线：val 为空 = 去掉这一层
  function setLinkLayer(id, layer, val) {
    const k0 = App.getLink(id);
    if (!k0) return;
    const list = pairOf(k0);
    const cur = list.find((x) => x.layer === layer) || null;
    if (!val) {
      if (cur) App.state.links = App.state.links.filter((x) => x !== cur);
    } else if (cur) {
      cur.ckey = val;
    } else {
      const base = list[0];
      App.addLink(base ? base.src : k0.src, base ? base.dst : k0.dst, layer, val, layer === "top" ? ((base || {}).arrow || "none") : "none");
    }
    App.render();
    if (App.renderPanel) App.renderPanel();
    const rest = pairOf(k0);
    if (rest.length) App.openLinkEdit(rest[0].id);
    else App.closeModal();
  }

  // 编辑连线：以「同一对角色」为单位，粗线（喜好度）与细线（关系）可同时设定
  App.openLinkEdit = function (id) {
    const k0 = App.getLink(id);
    if (!k0) { App.toast("连线不存在", true); return; }
    const st = App.state;
    const list = pairOf(k0);
    const bot = list.find((x) => x.layer === "bottom") || null;
    const top = list.find((x) => x.layer === "top") || null;
    const main = top || bot || k0;
    const arrow = main.arrow || "none";
    const nm = (cid) => { const c = st.chars.find((x) => x.id === cid); return c ? c.name : "?"; };
    const opts = (selId) => st.chars.map((c) =>
      `<option value="${c.id}"${c.id === selId ? " selected" : ""}>${App.esc(c.name)}</option>`).join("");
    const chips = (layer, cur, cmd) => {
      const rows = (st.tables[layer] || []).filter((r) => r.show !== false);
      const h = rows.map((r) => `<span class="chip ${r.key === cur ? "on" : ""}" data-cmd="${cmd}" data-id="${k0.id}" data-val="${r.key}"><span class="sw" style="background:${r.color}"></span>${App.esc(r.name)}</span>`).join("");
      return `<div class="chips">${h}<span class="chip ${cur ? "" : "on"}" data-cmd="${cmd}" data-id="${k0.id}" data-val="">无</span></div>`;
    };
    const html = `<div class="mh">编辑连线 · ${App.esc(nm(k0.src))} ↔ ${App.esc(nm(k0.dst))}<span class="x" data-cmd="m-close">${ICONS.close}</span></div>
      <div class="ln-ends">
        <select class="inp" data-cmd="link-edit-end" data-end="src" data-id="${k0.id}" aria-label="这一端是谁">${opts(k0.src)}</select>
        <button class="ln-swap" data-cmd="link-edit-flip" data-id="${k0.id}" aria-label="交换两端" title="交换两端">${ICONS.swap}</button>
        <select class="inp" data-cmd="link-edit-end" data-end="dst" data-id="${k0.id}" aria-label="另一端是谁">${opts(k0.dst)}</select>
      </div>
      <div class="pg-t">粗线（喜好度）</div>
      ${chips("bottom", bot ? bot.ckey : "", "link-edit-thick")}
      <div class="pg-t">细线（关系）</div>
      ${chips("top", top ? top.ckey : "", "link-edit-thin")}
      <div class="pg-t">箭头</div>
      <div class="chips">
        <span class="chip ${arrow === "none" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="none">无箭头</span>
        <span class="chip ${arrow === "one" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="one">单箭头</span>
        <span class="chip ${arrow === "both" ? "on" : ""}" data-cmd="link-edit-type" data-id="${k0.id}" data-val="both">双箭头</span>
      </div>
      <div class="modal-btns">
        <button class="btn danger" data-cmd="link-edit-del" data-id="${k0.id}">删除此连线</button>
        <button class="btn primary" data-cmd="m-close">完成</button>
      </div>`;
    App.openModal(html, true);
    // 端点换成别的角色
    document.querySelectorAll("#modalBox [data-cmd='link-edit-end']").forEach((sel) => {
      sel.addEventListener("change", () => {
        const nid = sel.value, end = sel.getAttribute("data-end");
        const oldId = end === "src" ? k0.src : k0.dst;
        if (!nid || nid === oldId) return;
        if (nid === (end === "src" ? k0.dst : k0.src)) {
          App.toast("两端不能是同一个人", true);
          App.openLinkEdit(k0.id);
          return;
        }
        eachPair(k0, (x) => {
          if (end === "src") { if (x.src === oldId) x.src = nid; }
          else if (x.dst === oldId) x.dst = nid;
        });
        App.render();
        if (App.renderPanel) App.renderPanel();
        App.openLinkEdit(k0.id);
      });
    });
  };
  // 图例点击 → 应用对应笔刷（不 commitHist，切换行为与 §十二 P5 一致）
  App.applyLegendBrush = function (layer, key) {
    if (layer === "bottom") App.brush.bottom = key;
    else if (layer === "top") App.brush.top = key;
    else if (layer === "arrow") App.brush.arrow = key;
    if (App.activeTab !== "link") {
      if (App.paintMode !== "link") App.setPaintMode("link"); // 切 Tab 顺便退出非连线模式
      App.selCharId = null;
      App.switchTab("link");
      return;
    }
    if (App.paintMode === "erase") App.setPaintMode("link"); // 选笔刷时若处于删线模式 → 回连线模式
    if (App.renderPanel) App.renderPanel();
    App.render();
  };
  function modalHead(title) {
    return `<div class="mh">${title}<span class="x" data-cmd="m-close">${ICONS.close}</span></div>`;
  }
  App.confirm = function (msg, okText, onOk) {
    App.openModal(`${modalHead("确认")}
      <div class="hint" style="font-size:15px">${msg}</div>
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="m-ok">${okText || "确定"}</button></div>`);
    modalCloseCb = null;
    App._okCb = onOk;
  };
  App.promptText = function (title, init, onOk) {
    App.openModal(`${modalHead(title)}
      <input type="text" id="promptVal" class="inp" style="width:100%" value="${App.esc(init)}">
      <div class="modal-btns"><button class="btn" data-cmd="m-close">取消</button>
      <button class="btn primary" data-cmd="m-ok2">确定</button></div>`);
    App._okCb = onOk;
  };
  App.helpModal = function () {
    App.openModal(modalHead(I18N.t("help_title")) + I18N.t("help_body")
      .replace("{{eraser}}", ICONS.eraser)
      .replace("{{ok}}", I18N.t("btn_ok")));
  };

  // 关于页 · 更新日志数据源（发新版时把新版本插到数组最前，展开范围自动重置）
  // 采用「约定式提交规范」：每条改动 = { t: 类型, n: 功能名, h: 如何使用 }
  // 用户可见中文类型标签：feat 新增 / perf 优化 / style·refactor 调整 / fix 修复 / docs 文档 / chore 整理
  // 规则：只展开最近 ABOUT_LOG_OPEN 个版本并显示「功能：如何使用」；更早的收起，且只留「功能」名
  const ABOUT_LOG_OPEN = 1;
  const ABOUT_TYPE = { feat: "新增", perf: "优化", style: "调整", refactor: "调整", fix: "修复", docs: "文档", chore: "整理" };
  const ABOUT_LOG = [
    { ver: "v1.0.0", date: "2026-09-12", changes: [
      { t: "feat", n: "1.0 正式版", h: "填写格式与界面定型，后续更新以打磨为主" },
      { t: "docs", n: "帮助重写", h: "先看一份完整例子，再逐段认识每个符号" },
      { t: "style", n: "版本历史", h: "更新日志按世代收拢，一眼看清每个大版的变化" },
    ] },
    { ver: "v0.15 系列", date: "2026-09-11 ~ 09-12", changes: [
      { t: "feat", n: "填写格式换代", h: "文本改成一块一块写：标题、布局、关系各占一块，更便于人机协作" },
      { t: "feat", n: "喜好分成两类", h: "既能标「喜欢这个角色」，也能单独标「喜欢这对关系」" },
      { t: "feat", n: "样式只写改动", h: "内置一份默认样式表，只想换颜色就只写颜色，其余自动继承" },
      { t: "feat", n: "导入分两种", h: "批量录入只增不减；全量覆盖整份替换，能直接看到删了什么" },
      { t: "feat", n: "路径筛选", h: "点人物，关系链亮起、越往外越淡，角色列表也按远近重排" },
      { t: "feat", n: "面板四档", h: "折叠 / 最简 / 半开 / 全开，电脑上占屏更小" },
      { t: "feat", n: "悬停看关系", h: "鼠标移到角色上，与他相连的线亮起、其余淡出" },
      { t: "fix", n: "显示与手感修复", h: "箭头描边、连线高亮、导出图片、导入后画布等问题的修复" },
    ] },
    { ver: "早期版本", date: "2026-09-07 ~ 09-10", changes: [
      { t: "feat", n: "三合一编辑器", h: "人物名单、连线、完整数据在一个编辑器里改" },
      { t: "feat", n: "径向菜单与二级窗", h: "点画布右侧 ➕ 绽开一圈按钮，导入导出各收进一个小窗" },
      { t: "feat", n: "槽位布局", h: "每圈按槽数等分，空槽画虚线占位；关掉槽位可自由摆放" },
      { t: "feat", n: "适配小红书小工具", h: "顶栏按钮移入悬浮条，菜单改底部弹出，面板可折叠" },
      { t: "feat", n: "喜好度记在角色身上", h: "标了本命 / 路好就记在这个人身上，重复标只覆盖" },
      { t: "style", n: "界面打磨一轮", h: "夜间可读性提升、图标换代、行高与控件尺寸统一" },
    ] },
  ];
  // 渲染更新日志：最近 ABOUT_LOG_OPEN 个版本展开（带中文类型标签）+ 完整说明；其余收起 + 只留功能名
  // v0.14.1–v0.14.20 这些早期小版本统一收进 v0.14.0 折叠块内的二级折叠（只留面向用户的条目）
  // 注：v0.14.x 于 2026-09-12 按「更新日志给用户看」原则合并为单个「v0.14 系列」块，
  // 下列二级折叠规则当前无匹配项（保留以备将来需要再拆分显示）。
  const HIST_RE = /^v0\.14\.(?:[1-9]|1[0-9]|20)$/;
  function logItemHTML(it) {
    return "<li>【" + (ABOUT_TYPE[it.t] || "调整") + "】<b>" + it.n + "</b>" + (it.h ? "：" + it.h : "") + "</li>";
  }
  function renderAboutLog() {
    const hist = ABOUT_LOG.filter(function (v) { return HIST_RE.test(v.ver); });
    const main = ABOUT_LOG.filter(function (v) { return !HIST_RE.test(v.ver); });
    const histLabel = hist.length ? hist[hist.length - 1].ver + " – " + hist[0].ver : "";
    return main.map(function (v, i) {
      const full = i < ABOUT_LOG_OPEN;
      const list = v.changes || [];
      const body = full
        ? '<ul class="about-list">' + list.map(logItemHTML).join("") + "</ul>"
        : '<div class="log-brief">' + list.map(function (it) { return it.n; }).join(" · ") + "</div>";
      let sub = "";
      if (v.ver === "v0.14.0" && hist.length) {
        sub = '<details class="log-block log-sub"><summary class="log-ver">' + histLabel + "</summary>"
          + hist.map(function (sv) {
              return '<div class="log-subver">' + sv.ver + " · " + sv.date + "</div>"
                + '<ul class="about-list">' + (sv.changes || []).map(logItemHTML).join("") + "</ul>";
            }).join("")
          + "</details>";
      }
      return '<details class="log-block"' + (full ? " open" : "") + ">"
        + '<summary class="log-ver">' + v.ver + " · " + v.date + "</summary>" + body + sub + "</details>";
    }).join("");
  }

  // 关于页（P12 · 全屏信息卡）：版本号跟随当前开发包；容器版纯本地静态内容、无外链；
  // 网页分流版会在末尾追加开源仓库入口（App.renderAboutExtra；容器版不加载该覆盖层 → 钩子返回空）
  // 固定文案已软代码化至 js/i18n.js（about_* / btn_ok），改文案不必动此处
  App.aboutModal = function () {
    App.openModal(`<div class="about-page">
        <div class="about-logo"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"></circle>
          <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"></circle>
          <circle cx="32" cy="32" r="8" fill="currentColor"></circle>
          <line x1="12" y1="12" x2="24" y2="24" stroke="currentColor" stroke-width="2"></line>
          <line x1="52" y1="12" x2="40" y2="24" stroke="currentColor" stroke-width="2"></line>
          <line x1="12" y1="52" x2="24" y2="40" stroke="currentColor" stroke-width="2"></line>
          <line x1="52" y1="52" x2="40" y2="40" stroke="currentColor" stroke-width="2"></line>
          <text x="32" y="37" font-size="11" text-anchor="middle" fill="currentColor" font-weight="bold">CP</text>
        </svg></div>
        <div class="about-name">CPChart <em>${ABOUT_LOG[0].ver}</em></div>
        <div class="about-sub">${I18N.t("about_sub")}</div>
        <div class="about-date">${I18N.t("about_date")}</div>

        <div class="about-sec">${I18N.t("about_sec_log")}</div>
        ${renderAboutLog()}

        <div class="about-sec">${I18N.t("about_sec_future")}</div>
        <ul class="about-list">
          ${I18N.txt.about_future.map(function (s) { return "<li>" + s + "</li>"; }).join("")}
        </ul>

        <div class="about-sec">${I18N.t("about_sec_credit")}</div>
        <ul class="about-list credit">
          ${I18N.txt.about_credit.map(function (s) { return "<li>" + s + "</li>"; }).join("")}
        </ul>

        ${App.renderAboutExtra ? App.renderAboutExtra() : ""}

        <div class="about-btn"><button class="btn primary" data-cmd="m-close">${I18N.t("btn_ok")}</button></div>
      </div>`, true);
  };

  // 导出文本弹窗（E-2 模式）
  // opts = { extraBtns:"", okText:"导入" }（批量编辑名单用到：附加「复制全部」+ 主钮改「保存」）
  App.textModal = function (title, hint, text, importMode, onImport, opts) {
    const o = opts || {};
    const ta = `<textarea class="export-txt" id="txtArea" ${importMode ? "" : "readonly"}>${App.esc(text)}</textarea>`;
    const btns = importMode
      ? `<button class="btn" data-cmd="m-close">取消</button>${o.extraBtns || ""}<button class="btn primary" data-cmd="txt-import">${o.okText || "导入"}</button>`
      : `<button class="btn" data-cmd="txt-select">全选</button><button class="btn primary" data-cmd="m-close">关闭</button>`;
    App.openModal(`${modalHead(title)}<div class="hint">${hint}</div>${ta}
      <div class="modal-btns">${btns}</div>`);
    modalCloseCb = null;
    App._txtImport = function (v) { App.closeModal(); if (onImport) onImport(v); };
    const area = $("txtArea");
    if (!importMode) {
      setTimeout(() => {
        try { area.focus(); area.select(); area.setSelectionRange(0, area.value.length); } catch (e) {}
      }, 60);
    }
  };

  // =============== 事件绑定 ===============
  function bindEvents() {
    // Tab
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.addEventListener("click", () => App.switchTab(b.getAttribute("data-tab")));
    });

    // 画布内图例：点任意图例项 = 应用对应笔刷
    $("legendChip").addEventListener("click", (e) => {
      const lg = e.target.closest(".lg[data-layer]");
      if (!lg) return;
      App.applyLegendBrush(lg.getAttribute("data-layer"), lg.getAttribute("data-key"));
    });

    // 撤销 / 重做 / 标题 / 菜单
    // 撤销/重做已移入径向主菜单（#radialMenu .radial-btn[data-act=undo/redo]）
    // 定位坐标：圆心归位到画面正中 + 自动缩放全览
    const rcBtn = $("btnRecenter");
    if (rcBtn) rcBtn.addEventListener("click", () => App.recenter());
    // 面板四档把手（折叠/最简/半开/全开）：单击循环 + 拖动跟手
    //   - 单击（移动 < 8px）：按 collapsed → min → half → full → collapsed 循环
    //   - 拖动（移动 ≥ 8px）：面板高度实时跟手；松手吸附到最近档位
    const head = $("panelHead");
    if (head) {
      // 四档（占视口比例，留出 panelHead 26 + tabs 49 高度）；min 只显各 Tab 第一行，r 取到单行实际占比
      const STOPS = [
        { m: "collapsed", r: 0 },
        { m: "min",       r: 0.09 },
        { m: "half",      r: 0.4 },
        { m: "full",      r: 0.92 },
      ];
      const ratioToMode = (r) => {
        let best = STOPS[0], bd = Math.abs(r - STOPS[0].r);
        for (let i = 1; i < STOPS.length; i++) {
          const d = Math.abs(r - STOPS[i].r);
          if (d < bd) { bd = d; best = STOPS[i]; }
        }
        return best.m;
      };
      const currentRatio = () => {
        const p = $("panel");
        if (!p) return 0;
        return p.getBoundingClientRect().height / (window.innerHeight || 800);
      };
      const setLiveHeight = (ratio) => {
        const p = $("panel"); if (!p) return;
        p.style.maxHeight = (ratio * 100).toFixed(1) + "vh";
      };
      let active = false, moved = false, startY = 0, startRatio = 0, pid = -1;
      let rafId = 0, pendingRatio = 0;
      // rAF 节流：高刷屏（120Hz）下 pointermove 每帧多次触发，合并成一次写样式，避免掉帧
      const flushHeight = () => { rafId = 0; setLiveHeight(pendingRatio); };
      head.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        active = true; moved = false;
        startY = e.clientY; startRatio = currentRatio(); pid = e.pointerId;
        try { head.setPointerCapture(pid); } catch (err) {}
      });
      head.addEventListener("pointermove", (e) => {
        if (!active) return;
        let dy = e.clientY - startY;
        if (!moved) {
          if (Math.abs(dy) < 8) return; // 8px 阈值，避免误触切档
          moved = true;
          // 阈值补偿：把起点的 8px 让掉，手指一过阈值就立刻跟手，不会先顿一下
          startY += dy > 0 ? 8 : -8;
          dy = e.clientY - startY;
          // 折叠态 #panel 是 display:none，不先放出来拖动全程看不见面板（v0.14.17）
          if (App.panelMode === "collapsed") App.setPanelMode("half", { keepDragHeight: true });
          const p0 = $("panel");
          if (p0) p0.classList.add("dragging"); // 关过渡 + 视觉反馈，只加一次
          head.classList.add("dragging");
        }
        const vh = window.innerHeight || 800;
        // 向上拖 dy<0 高度增大，向下拖 dy>0 高度减小
        pendingRatio = Math.max(0, Math.min(0.98, startRatio + (-dy) / vh));
        if (!rafId) rafId = requestAnimationFrame(flushHeight);
      });
      const endDrag = () => {
        if (!active) return;
        active = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; setLiveHeight(pendingRatio); }
        if (!moved) {
          // 单击：循环切档
          const seq = ["collapsed", "min", "half", "full"];
          const i = seq.indexOf(App.panelMode);
          App.setPanelMode(seq[(i + 1) % seq.length]);
        } else {
          // 拖动结束：吸附到最近档位
          const ratio = currentRatio();
          App.setPanelMode(ratioToMode(ratio));
        }
        try { head.releasePointerCapture(pid); } catch (err) {}
      };
      head.addEventListener("pointerup", endDrag);
      head.addEventListener("pointercancel", endDrag);
      // 键盘可访问性：Space / Enter 循环切档
      head.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          const seq = ["collapsed", "min", "half", "full"];
          const i = seq.indexOf(App.panelMode);
          App.setPanelMode(seq[(i + 1) % seq.length]);
        }
      });
    }
    // 全开态左上角「返回画板」钮（与帮助钮同槽位，见 index.html #topbar 注释）
    const homeBtn = $("homeBtn");
    if (homeBtn) homeBtn.addEventListener("click", () => App.setPanelFull(false));
    // 顶栏帮助钮（常态槽位；面板全开时 CSS 切换为返回画板，见 app.css .top-slot-btn）
    const helpBtn = $("btnHelp");
    if (helpBtn) helpBtn.addEventListener("click", () => App.helpModal());
    // 顶栏标题可点：点击「图名 / 填表人 的 图名」弹改名窗（标题区非容器两角，点击合规）
    const titleBox = $("titleBox");
    if (titleBox) titleBox.addEventListener("click", () => App.openTitleModal());
    // 径向主菜单（撤销/重做/导入/保存/关于，围绕 + 号绽开）
    const btnMenuEl = $("btnMenu");
    if (btnMenuEl) btnMenuEl.addEventListener("click", toggleRadial);
    const radialMaskEl = $("radialMask");
    if (radialMaskEl) radialMaskEl.addEventListener("click", closeRadial);
    document.querySelectorAll("#radialMenu .radial-btn").forEach((b) => {
      b.addEventListener("click", () => onRadialAct(b.getAttribute("data-act")));
    });
    // 二级菜单窗口（导入 / 保存，按钮带文字）
    const subMaskEl = $("subMenuMask");
    if (subMaskEl) subMaskEl.addEventListener("click", closeSubMenu);
    $("fullExit").addEventListener("click", () => {
      App.fullUI = false;
      document.body.classList.remove("hideui");
      $("fullExit").classList.add("hidden");
      renderPanel();
    });
    $("modalMask").addEventListener("click", () => App.closeModal());

    // 弹窗按钮委托
    $("modalBox").addEventListener("click", (e) => {
      const ok = e.target.closest('[data-cmd="m-ok"]');
      if (ok) { const cb = App._okCb; App._okCb = null; App.closeModal(); if (cb) cb(); return; }
      const ok2 = e.target.closest('[data-cmd="m-ok2"]');
      if (ok2) {
        const v = ($("promptVal") || {}).value;
        const cb = App._okCb; App._okCb = null; App.closeModal(); if (cb) cb(v);
        return;
      }
      // 标题/填表人双输入
      const titleOk = e.target.closest('[data-cmd="title-ok"]');
      if (titleOk) {
        const t1 = ($("promptTitle") || {}).value;
        const f1 = ($("promptFiller") || {}).value;
        App.closeModal();
        App.act(() => {
          // 标题上限 18 字、填表人 12 字（与弹窗 maxlength 一致，兜底存量超限数据）
          App.state.title = Array.from(String(t1 == null ? "" : t1).trim()).slice(0, 18).join("") || "未命名关系图";
          App.state.meta.filler = Array.from(String(f1 == null ? "" : f1).trim()).slice(0, 12).join("");
        });
        const cb = App._titleOkCb; App._titleOkCb = null; if (cb) cb();
        return;
      }
      // 保存相册重试（导出失败/被拒后预览面板内）
      const saveRetry = e.target.closest('[data-cmd="save-retry"]');
      if (saveRetry) {
        const url = App._retrySaveUrl;
        if (!url) { App.toast("没有可保存的图片", true); return; }
        App.saveImage(url).then((r2) => {
          if (r2 && r2.ok) {
            App.closeModal();
            App._retrySaveUrl = null;
            App.toast("已保存到相册");
          } else {
            App.toast("保存未成功，请重试或长按图片另存", true);
          }
        });
        return;
      }
      // 结果屏：发布小红书（publishNote 内部自生成图并唤起发布页）
      const pub = e.target.closest('[data-cmd="publish"]');
      if (pub) { App.closeModal(); App.publishNote(); return; }
      // 结果屏：建立新画布
      const nc = e.target.closest('[data-cmd="new-canvas"]');
      if (nc) { App.newDoc(); App.closeModal(); App.render(); return; }
      if (e.target.closest('[data-cmd="m-close"]')) { App.closeModal(); return; }
      // 统一编辑器：切 Tab / 切导出导入（切换前先把当前输入存进内存）
      const edTab = e.target.closest('[data-cmd="ed-tab"]');
      if (edTab) {
        const a0 = $("txtArea");
        if (a0 && App._ed) App._ed.buf[App._ed.tab] = a0.value;
        App._ed.tab = edTab.getAttribute("data-tab");
        renderEditor();
        return;
      }
      const edMode = e.target.closest('[data-cmd="ed-mode"]');
      if (edMode) {
        const a1 = $("txtArea");
        if (a1 && App._ed) App._ed.buf[App._ed.tab] = a1.value;
        App._ed.dataMode = edMode.getAttribute("data-mode");
        delete App._ed.buf[App._ed.tab];
        renderEditor();
        return;
      }
      const sel = e.target.closest('[data-cmd="txt-select"]');
      if (sel) {
        const a = $("txtArea");
        try { a.focus(); a.select(); a.setSelectionRange(0, a.value.length); } catch (err) {}
        const h = document.querySelector("#modalBox .hint");
        if (h) h.textContent = "已全部选中，需手动长按点击复制";
        return;
      }
      const imp = e.target.closest('[data-cmd="txt-import"]');
      if (imp) {
        const cb = App._txtImport;
        const val = ($("txtArea") || {}).value || "";
        // 是否关闭由回调决定：返回 false（或抛错）= 应用失败，保留弹窗与已输入的文字
        if (cb) { try { cb(val); } catch (err) { App.toast(err.message || "导入失败", true); } }
        else App.closeModal();
      }
      // 编辑器标题旁的「写法说明」
      const edHelp = e.target.closest('[data-cmd="ed-help"]');
      if (edHelp) {
        const a2 = $("txtArea");
        if (a2 && App._ed) App._ed.buf[App._ed.tab] = a2.value;
        App._ed.helpOpen = !App._ed.helpOpen;
        renderEditor();
        return;
      }
      // 连线编辑弹窗内的操作（以「同一对角色」为单位）
      const leThick = e.target.closest('[data-cmd="link-edit-thick"]');
      if (leThick) { setLinkLayer(leThick.getAttribute("data-id"), "bottom", leThick.getAttribute("data-val")); return; }
      const leThin = e.target.closest('[data-cmd="link-edit-thin"]');
      if (leThin) { setLinkLayer(leThin.getAttribute("data-id"), "top", leThin.getAttribute("data-val")); return; }
      const leType = e.target.closest('[data-cmd="link-edit-type"]');
      if (leType) {
        const lid = leType.getAttribute("data-id");
        // 箭头优先落在细线（顶层）上，没有细线时才挂粗线
        const t = pairTarget(lid);
        if (t) App.setLinkArrow(t.id, leType.getAttribute("data-val"));
        App.openLinkEdit(lid); // 刷新弹窗高亮
        return;
      }
      const leFlip = e.target.closest('[data-cmd="link-edit-flip"]');
      if (leFlip) {
        const lid = leFlip.getAttribute("data-id");
        const k = App.getLink(lid);
        if (k) {
          eachPair(k, (x) => { const t = x.src; x.src = x.dst; x.dst = t; });
          App.render();
          if (App.renderPanel) App.renderPanel();
        }
        App.openLinkEdit(lid);
        return;
      }
      const leDel = e.target.closest('[data-cmd="link-edit-del"]');
      if (leDel) {
        const lid = leDel.getAttribute("data-id");
        const kd = App.getLink(lid);
        // 一对角色可能同时有粗线与细线，删就一起删，不留半条
        App.act(() => {
          (kd ? pairOf(kd) : []).forEach((x) => App.removeLink(x.id));
          if (!kd) App.removeLink(lid);
        });
        App.closeModal(); App.renderPanel();
        return;
      }
    });

    // 面板委托 click
    const panel = $("panel");
    panel.addEventListener("click", (e) => {
      const cmdEl = e.target.closest("[data-cmd]");
      if (!cmdEl) return;
      const cmd = cmdEl.getAttribute("data-cmd");
      onCmd(cmd, cmdEl);
    });
    // 面板 input/change（颜色、名称、半径等）
    panel.addEventListener("input", (e) => onInput(e));
    panel.addEventListener("change", (e) => onInput(e));
    // 可拖动输入（scrubber）：在数值输入框上按住左右拖动即可调数（半径/槽位等）
    document.addEventListener("pointerdown", function (e) {
      const el = e.target.closest && e.target.closest('input.inp[type=number][data-set]');
      if (!el || e.button !== 0) return;
      const startX = e.clientX;
      const startVal = parseFloat(el.value) || 0;
      const min = el.min !== "" ? parseFloat(el.min) : -Infinity;
      const max = el.max !== "" ? parseFloat(el.max) : Infinity;
      const step = parseFloat(el.step) || 1;
      let dragging = false;
      const move = function (ev) {
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) < 8) return;
        if (!dragging) {
          dragging = true;
          try { el.setPointerCapture(ev.pointerId); } catch (_) {}
          el.style.userSelect = "none";
          el.style.cursor = "ew-resize";
        }
        let v = startVal + dx * step;
        v = Math.max(min, Math.min(max, v));
        v = Math.round(v / step) * step;
        if (String(v) !== el.value) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      const up = function (ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (dragging) {
          el.style.userSelect = "";
          el.style.cursor = "";
          el.dispatchEvent(new Event("change", { bubbles: true }));
          ev.preventDefault();
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    // 焦点记录历史
    panel.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-row-edit]");
      if (el) App.commitHist(); // 为行编辑记录一次
      const pn = e.target.closest("[data-cmd=pm-rename],[data-cmd=pm-like]");
      if (pn) App.commitHist();
      const ring = e.target.closest("[data-set=rad]");
      if (ring) App.commitHist();
      const slot = e.target.closest("[data-set=slots]");
      if (slot) App.commitHist();
      const arrowNm = e.target.closest('[data-set="arrowName"]');
      if (arrowNm) App.commitHist();
    });
    panel.addEventListener("focusout", (e) => {
      const el = e.target.closest("[data-row-edit]");
      if (el) { App.notifyChanged(); }
    });
    document.addEventListener("click", (e) => {
      // nodeOps 内
      const c = e.target.closest("#nodeOps [data-cmd]");
      if (c) { onCmd(c.getAttribute("data-cmd"), c); }
      const opsClose = e.target.closest("#opsClose");
      if (opsClose) { App.selCharId = null; App.notifyChanged(); }
      // 人物/布局点击行选择（非输入区、非行内控件）
      // .ava 是 div 而非 button，且自带 pm-avatar 命令（上传图片）：点头像只传图，不触发筛选
      const row = e.target.closest(".prow[data-pid]");
      if (row && !e.target.closest("input") && !e.target.closest("select") && !e.target.closest("button") && !e.target.closest(".ava")) {
        const rid = row.getAttribute("data-pid");
        App.selCharId = rid;
        if (App.activeTab === "person") {
          // 人物页：点人物 = 以他为起点沿连线筛选（列表同步按远近重排）
          App.setFilter(rid);
          renderPanel();
          App.render();
        } else if (App.activeTab === "layout") { App.notifyChanged(); }
        else { App.render(); }
      }
    });

    // 头像文件选择：原生 <input>，仅相册取向——绝不设置 capture 属性，避免强制调用摄像头权限
    const fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.accept = "image/*";
    fileInp.style.display = "none";
    document.body.appendChild(fileInp);
    fileInp.addEventListener("change", () => onAvatarFilePicked(fileInp));
    App._avatarInput = fileInp;

    // 头像选择入口：默认走原生 <input>（无 capture，不调摄像头）。
    // 彻底"仅相册、屏蔽系统拍照入口"需容器相册选图 API（限定 sourceType:['album']）。
    // 小红书 miniTool 当前仅暴露 postNote/saveImageToPhotosAlbum/writeTempFile，无选图 API，故暂用原生 input。
    // 接入时实现 App.avatarPicker(id) → Promise<dataURL> 钩子即可，无需改动调用点。
    App.avatarPicker = null;
    App.pickAvatar = function (id) {
      pendingAvatarFor = id;
      if (typeof App.avatarPicker === "function") {
        App.avatarPicker(id).then((du) => applyAvatar(id, du)).catch(() => App._avatarInput.click());
      } else {
        App._avatarInput.click();
      }
    };
    function onAvatarFilePicked(inputEl) {
      const f = inputEl.files && inputEl.files[0];
      inputEl.value = "";
      const id = pendingAvatarFor; pendingAvatarFor = null;
      if (!f || !id) return;
      App.resizeAvatar(f).then((du) => applyAvatar(id, du)).catch((e) => App.toast(e.message || "头像处理失败", true));
    }
    function applyAvatar(id, dataUrl) {
      if (!id || !dataUrl) return;
      App.act(() => {
        const c = App.state.chars.find((x) => x.id === id);
        if (c) { c.avatar = dataUrl; App.AVATAR_CACHE[c.name] = dataUrl; }
      });
      App.toast("头像已设置");
    }

    bindFloatDrag();
  }

  function onCmd(cmd, el) {
    const st = App.state;
    switch (cmd) {
      // ---------- 样式 ----------
      case "ui-night": {
        const want = el.getAttribute("data-val") === "night";
        if (!!st.ui.night !== want) {
          App.act(() => { st.ui.night = want; });
          App.applyNight();
        }
        break;
      }
      case "thin-dash": {
        App.act(() => { st.ui.thinDash = !st.ui.thinDash; });
        App.render(); App.notifyChanged();
        break;
      }
      case "tbl-add": {
        const layer = el.getAttribute("data-layer");
        App.act(() => App.addTableRow(layer, {
          name: App.nextTableName(layer, layer === "arrow" ? "新箭头" : "新关系"), // 递增编号，连点不出同名
          type: layer === "arrow" ? "one" : undefined,
        }));
        App.toast("已添加");
        break;
      }
      case "tbl-del": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key");
        App.confirm("删除该表项？引用它的连线/喜好度会被清除。", "删除", () => {
          App.act(() => App.delTableRow(layer, key));
          if (App.brush.bottom === key) App.brush.bottom = null;
          if (App.brush.top === key) App.brush.top = null;
          App.toast("已删除");
        });
        break;
      }
      case "pal": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key"), col = el.getAttribute("data-c");
        App.act(() => App.recolorTableRow(layer, key, col));
        break;
      }
      case "tbl-hide": {
        const layer = el.getAttribute("data-layer"), key = el.getAttribute("data-key");
        const hidden = App.act(() => App.toggleTableHidden(layer, key));
        App.toast(hidden ? "已隐藏：不进图例与导出图" : "已恢复显示");
        break;
      }
      // ---------- 人物 ----------
      case "pm-batch": App.editorModal({ tab: "people" }); break;
      case "pm-add": {
        const nm = nextNewCharName();
        App.act(function () { App.addChar(nm, 1, true); }); // atTop=true → 新角色排在名单顶端
        App.toast("已添加「" + nm + "」");
        break;
      }
      case "pm-import": openImportNames(); break;
      case "pm-export": openExportNames(); break;
      case "pm-filter": {
        // 漏斗 = 筛选开关：筛选中 → 退出（恢复全部连线与列表顺序）；没筛选 → 提示怎么开始
        if (App.filterRoot) {
          App.setFilter(null);
          App.selCharId = null;
          App.toast("已退出筛选");
        } else {
          App.toast("点人物列表或画布头像即开始筛选，点这里退出");
        }
        App.render();
        App.renderPanel();
        break;
      }
      case "pm-mode": {
        App.act(() => { st.ui.avatarMode = el.getAttribute("data-val"); });
        break;
      }
      case "pm-names": {
        App.act(() => { st.ui.showNames = !st.ui.showNames; });
        break;
      }
      case "pm-avatar": {
        App.pickAvatar(el.getAttribute("data-id"));
        break;
      }
      case "pm-center": {
        const id = el.getAttribute("data-id");
        const c = App.state.chars.find((x) => x.id === id);
        if (c && c.ring === 0) {
          App.act(() => App.moveCharToRing(id, 1));
          App.toast("已取消圆心");
        } else {
          App.act(() => App.moveCharToRing(id, 0));
          App.toast("已设为圆心");
        }
        break;
      }
      case "pm-del": {
        const id = el.getAttribute("data-id");
        App.confirm("删除该角色及其连线？", "删除", () => {
          App.act(() => App.removeChar(id));
        });
        break;
      }
      // ---------- 连线 ----------
      case "br-b": { App.brush.bottom = App.brush.bottom === el.getAttribute("data-key") ? null : el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "br-t": { App.brush.top = App.brush.top === el.getAttribute("data-key") ? null : el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "br-a": { App.brush.arrow = el.getAttribute("data-key"); App.render(); App.renderPanel(); break; }
      case "lnk-batch": App.editorModal({ tab: "link" }); break;
      case "paint-set": {
        // 三选一模式：link=连线 / char=角色 / erase=删线（互斥，单源 App.paintMode）
        App.setPaintMode(el.getAttribute("data-mode"));
        break;
      }
      case "lnk-clear": {
        App.confirm("清空所有连线？", "清空", () => App.act(() => { App.state.links = []; }));
        break;
      }
      case "link-del": {
        const id = el.getAttribute("data-id");
        App.act(() => App.removeLink(id));
        break;
      }
      case "link-edit": {
        App.openLinkEdit(el.getAttribute("data-id"));
        break;
      }
      case "filter-link": {
        App.selCharId = el.getAttribute("data-id");
        renderPanel(); App.render();
        break;
      }
      // ---------- 布局 ----------
      case "ly-even": App.act(() => App.evenAll()); App.toast("已平均排布"); break;
      case "ly-hint": {
        st.ui.layoutHint = !st.ui.layoutHint;
        renderPanel();
        break;
      }
      case "ly-addring": {
        App.act(() => {
          App.state.rings.push({
            rad: (App.state.rings[App.state.rings.length - 1] || { rad: 150 }).rad + 120,
            slots: App.state.ui.slotMode ? App.SLOT_MIN : null,
          });
        });
        break;
      }
      case "ly-slots": {
        App.act(() => {
          st.ui.slotMode = !st.ui.slotMode;
          if (st.ui.slotMode) {
            st.rings.forEach((r, i) => {
              const n = App.charsOnRing(i + 1).length;
              r.slots = Math.max(r.slots || 0, App.SLOT_MIN, n);
            });
            App.evenAll();
          }
        });
        break;
      }
      case "ly-delring": {
        const ringNo = parseInt(el.getAttribute("data-ring"), 10);
        const n = App.charsOnRing(ringNo).length;
        const doDel = () => {
          try {
            App.act(() => App.deleteRing(ringNo));
            App.toast(`已删除圈 ${ringNo}`);
          } catch (err) { App.toast(err.message || "删除失败", true); }
        };
        if (ringNo <= 1) { App.toast("第 1 圈不可删除", true); break; }
        if (n > 0) {
          App.confirm(`圈 ${ringNo} 上还有 ${n} 位角色，删除后将移入最近的轨道（尽量保持原位，重叠则自动均分）。`, "移到最近轨道", doDel);
        } else {
          doDel();
        }
        break;
      }
      // nodeOps
      case "ops-del": {
        const c = App.state.chars.find((x) => x.id === App.selCharId);
        if (c) App.act(() => App.removeChar(c.id));
        break;
      }
      case "ops-center": {
        const c = App.state.chars.find((x) => x.id === App.selCharId);
        if (c && c.ring === 0) {
          App.act(() => App.moveCharToRing(c.id, 1));
          App.toast("已取消圆心");
        } else if (c) {
          App.act(() => App.moveCharToRing(c.id, 0));
          App.toast("已设为圆心");
        }
        break;
      }
      case "ops-close": { App.selCharId = null; App.notifyChanged(); break; }
      // ---------- 抓手 ----------
      case "hd-hide": {
        App.fullUI = !App.fullUI;
        document.body.classList.toggle("hideui", App.fullUI);
        $("fullExit").classList.toggle("hidden", !App.fullUI);
        renderPanel();
        break;
      }
      case "hd-save": exportImageFlow(); break;
    }
  }

  // 角色圆圈过大提示：任一圈上相邻角色的弧长间距放不下两个圆时提醒（不阻止）
  function warnNodeOverlap(R) {
    const st = App.state;
    const maxRing = Math.max(0, ...st.chars.map((c) => c.ring));
    for (let r = 1; r <= maxRing; r++) {
      const list = App.charsOnRing(r);
      if (list.length < 2) continue;
      const rad = Math.max(40, App.radiusFor(r) || 150);
      const need = (2 * R + 8) / rad;
      const angs = list.map((c) => App.normAngle(c.angle == null ? -Math.PI / 2 : c.angle)).sort((a, b) => a - b);
      for (let i = 0; i < angs.length; i++) {
        const j = (i + 1) % angs.length;
        let d = Math.abs(angs[j] - angs[i]);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < need) { App.toast("圆圈偏大，部分角色可能挤在一起，可调小或点「平均排布」", true); return; }
      }
    }
  }

  function onInput(e) {
    const t = e.target;
    const st = App.state;
    const rowEdit = t.closest("[data-row-edit]");
    if (rowEdit) {
      const layer = rowEdit.getAttribute("data-layer"), key = rowEdit.getAttribute("data-key");
      const kind = rowEdit.getAttribute("data-row-edit");
      if (kind === "name") {
        // 图例名规则：≤20 字、禁纯数字（纯数字会与「第 N 圈 / 行号」歧义）。被拒时失焦还原并提示
        const ok = App.renameTableRow(layer, key, t.value);
        if (!ok && e.type === "change") {
          const row = (App.state.tables[layer] || []).find((x) => x.key === key);
          t.value = row ? row.name : "";
          App.toast("图例名不能只写数字，容易和圈号搞混，已还原", true);
        }
      } else if (kind === "color") App.recolorTableRow(layer, key, t.value);
      App.render();
      if (e.type === "change") { App.notifyChanged(); }
      return;
    }
    const bg = t.closest('[data-set="bg"]');
    if (bg) {
      App.state.bg = t.value;
      if (!App.state.ui.night) document.body.style.setProperty("--bg", t.value); // 夜间时外壳保持深色，不跟随
      App.render();
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const arrowInp = t.closest('[data-set="arrowName"]');
    if (arrowInp) {
      if (!App.state.meta) App.state.meta = {};
      App.state.meta.arrowName = t.value;
      App.render(); // 图例实时更新箭头标注名
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const nrInp = t.closest('[data-set="nodeR"]');
    if (nrInp) {
      let v = parseInt(t.value, 10);
      if (!v || v < App.NODE_R_MIN) v = App.NODE_R;
      if (v > App.NODE_R_MAX) v = App.NODE_R_MAX;
      if (nodeRBefore == null) { nodeRBefore = st.ui.nodeR; App.commitHist(); } // 一次拖动只记一条 undo
      st.ui.nodeR = v;
      const nv = $("nodeRVal"); if (nv) nv.textContent = String(v);
      App.render();
      if (e.type === "change") { nodeRBefore = null; App.notifyChanged(); warnNodeOverlap(v); }
      return;
    }
    const radInp = t.closest('[data-set="rad"]');
    if (radInp) {
      const ring = parseInt(radInp.getAttribute("data-ring"), 10);
      const v = parseInt(t.value, 10);
      if (v > 20) { App.state.rings[ring - 1].rad = v; App.render(); }
      return;
    }
    const thinWInp = t.closest('[data-set="thinW"]');
    if (thinWInp) {
      let v = parseFloat(t.value);
      if (!v || v < 1) v = 1; if (v > 6) v = 6;
      if (nodeRBefore == null) { App.commitHist(); }
      App.state.ui.thinW = v;
      const tv = document.querySelector(".thinW-val"); if (tv) tv.textContent = String(v);
      App.render();
      if (e.type === "change") { App.notifyChanged(); }
      return;
    }
    const slotInp = t.closest('[data-set="slots"]');
    if (slotInp) {
      const ring = parseInt(slotInp.getAttribute("data-ring"), 10);
      const n = App.charsOnRing(ring).length;
      let v = parseInt(t.value, 10);
      if (!v || v < n) v = n;
      App.state.rings[ring - 1].slots = v;
      App.distributeRing(ring, { slots: v });
      App.render();
      return;
    }
    // 人物行 rename/like（change）
    const rename = t.closest("[data-cmd=pm-rename]");
    if (rename && e.type === "change") {
      const id = rename.getAttribute("data-id");
      const c = App.state.chars.find((x) => x.id === id);
      if (c) {
        const old = c.name;
        c.name = App.clipName(t.value.trim()) || old; // 20 字上限兜底（maxlength 之外防粘贴/存量超限）
        if (t.value !== c.name) t.value = c.name;
        if (App.AVATAR_CACHE[old] && !App.AVATAR_CACHE[c.name]) App.AVATAR_CACHE[c.name] = App.AVATAR_CACHE[old];
        App.notifyChanged();
      }
      return;
    }
    const like = t.closest("[data-cmd=pm-like]");
    if (like) {
      const id = like.getAttribute("data-id");
      const c = App.state.chars.find((x) => x.id === id);
      if (c) { c.like = t.value || null; App.render(); }
      if (e.type === "change") App.notifyChanged();
      return;
    }
    const zoom = t.closest("#zoomRange");
    if (zoom) {
      App.view.s = parseInt(zoom.value, 10) / 100;
      const zl = $("zoomLabel"); if (zl) zl.textContent = parseInt(zoom.value, 10) + "%";
      const zv = $("zoomVal"); if (zv) zv.textContent = parseInt(zoom.value, 10) + "%";
      App.render();
    }
  }

  // opsRingSel change（布局操作条移圈）
  function bindRingSel() {
    $("opsRingSel").addEventListener("change", (e) => {
      const id = App.selCharId;
      const ring = parseInt(e.target.value, 10);
      if (id != null) App.act(() => App.moveCharToRing(id, ring, true));
      App.notifyChanged();
    });
  }

  // opsSlotSel change（布局操作条：把选中角色移到指定空闲槽）
  function bindSlotSel() {
    $("opsSlotSel").addEventListener("change", (e) => {
      const id = App.selCharId;
      const c = App.state.chars.find((x) => x.id === id);
      if (!c || c.ring <= 0) return;
      const slotIdx = parseInt(e.target.value, 10);
      if (slotIdx < 0) return;
      const sl = Math.max(1, App.state.rings[c.ring - 1].slots || 1);
      App.act(() => {
        c.slot = slotIdx;
        c.angle = -Math.PI / 2 + (slotIdx * 2 * Math.PI) / sl;
      });
      App.toast(`已移到 圈${c.ring} 槽${slotIdx + 1}`);
    });
  }

  function onMenu(menu) {
    switch (menu) {
      case "help": App.helpModal(); break;
      case "rename": App.openTitleModal(); break;
      case "new": {
        App.confirm("新建将清空当前人物/连线/布局（三张表与背景保留）。", "新建", () => {
          App.newDoc();
          App.setTitleText();
          App.toast("已新建");
          openImportNames(true);
        });
        break;
      }
      case "publish": App.publishNote(); break;
      case "img": exportImageFlow(); break;
      case "expnames": openExportNames(); break;
      case "impnames": openImportNames(false); break;
      case "expsnap": App.editorModal({ tab: "data", dataMode: "export" }); break;
      case "impsnap": App.editorModal({ tab: "data", dataMode: "import" }); break;
      case "edpeople": App.editorModal({ tab: "people" }); break;
      case "edlink": App.editorModal({ tab: "link" }); break;
      case "about": App.aboutModal(); break;
    }
  }

  // ===== 径向主菜单 + 二级窗口 =====
  const SUBMENU = {
    // 导入菜单精简为三项（v0.14.18）：建立新图 / 增量导入（批量录入 Tab，只增不删）
    // / 全量编辑（完整数据 Tab，可全量查看与覆盖导入）
    import: { title: "导入", items: [
      { menu: "new",      label: "建立新连线图",  icon: "newDoc" },
      { menu: "edpeople", label: "增量导入数据",  icon: "filePlus" },
      { menu: "expsnap",  label: "全量编辑数据",  icon: "filePen" },
    ]},
    save: { title: "保存 / 导出", items: [
      { menu: "publish",  label: "发布小红书笔记", cls: "hl-danger", icon: "send" },
      { menu: "img",      label: "导出图片",     icon: "imgOut" },
      { menu: "expsnap",  label: "导出完整数据",  icon: "copyOne" },
      { menu: "expnames", label: "导出人物名单",  icon: "peopleGr" },
    ]},
  };

  function toggleRadial() {
    const rm = $("radialMenu");
    if (!rm) return;
    if (rm.classList.contains("hidden")) openRadial(); else closeRadial();
  }
  function openRadial() {
    const rm = $("radialMenu"), fab = $("btnMenu");
    if (!rm || !fab) return;
    const r = fab.getBoundingClientRect();
    rm.style.left = (r.left + r.width / 2) + "px";
    rm.style.top = (r.top + r.height / 2) + "px";
    rm.classList.remove("hidden");
    fab.classList.add("open");
    refreshRadial();
  }
  function closeRadial() {
    const rm = $("radialMenu"), fab = $("btnMenu");
    if (rm) rm.classList.add("hidden");
    if (fab) fab.classList.remove("open");
  }
  function refreshRadial() {
    const u = document.querySelector('#radialMenu [data-act="undo"]');
    const r = document.querySelector('#radialMenu [data-act="redo"]');
    if (u) u.disabled = !App.canUndo();
    if (r) r.disabled = !App.canRedo();
  }
  function onRadialAct(act) {
    closeRadial();
    if (act === "undo") App.undo();
    else if (act === "redo") App.redo();
    else if (act === "about") App.aboutModal();
    else if (act === "import") openSubMenu("import");
    else if (act === "save") openSubMenu("save");
  }
  function openSubMenu(kind) {
    const root = $("subMenuRoot");
    if (!root) return;
    const cfg = SUBMENU[kind];
    if (!cfg) return;
    $("subMenuTitle").textContent = cfg.title;
    $("subMenuList").innerHTML = cfg.items.map((it) =>
      `<button class="sub-item${it.cls ? " " + it.cls : ""}" data-menu="${it.menu}">${it.icon ? ICONS[it.icon] : ""}<span class="sub-label">${it.label}</span></button>`).join("");
    root.classList.remove("hidden");
    root.querySelectorAll(".sub-item").forEach((it) => {
      it.addEventListener("click", () => { closeSubMenu(); onMenu(it.getAttribute("data-menu")); });
    });
  }
  function closeSubMenu() {
    const root = $("subMenuRoot");
    if (root) root.classList.add("hidden");
  }

  // ---- 统一编辑器（v1.0 #7）：人物 / 连线 / 完整数据 三 Tab，共用现有弹窗形态 ----
  var ED_TABS = [["people", "批量录入"], ["link", "全量覆盖"], ["data", "生成数据包"]];

  // 导入提示：把软校验（引用了不存在的角色 / 图例词未定义等）带出来，别让用户白写
  function edWarnNote(r) {
    if (!r || !r.warns || !r.warns.length) return "";
    const w = r.warns.slice(0, 2).join("；");
    return "；提示：" + w + (r.warns.length > 2 ? " 等 " + r.warns.length + " 条" : "");
  }
  function edConf(tab) {
    if (tab === "people") {
      return {
        title: I18N.t("ed_people_title"),
        hint: I18N.t("ed_people_hint"),
        ph: I18N.t("ed_people_ph"),
        help: I18N.t("ed_people_help"),
        text: function () { return App.exportNameListText(); },
        okText: "保存",
        apply: function (v) {
          // ★Tab 1 自动路由：先试整份文本（含块语法段头），否则当名单增量合并
          const cpc = App.importCPC(v);
          if (cpc !== null) {
            if (cpc.errs && cpc.errs.length) {
              if (cpc.autoFixText != null) {
                App._ed.buf[App._ed.tab] = cpc.autoFixText;
                App.toast("槽位数少于人数，已按人数扩容，请再点一次「保存」", true);
                return false;
              }
              App.toast(cpc.errs.join("；"), true);
              return false;
            }
            App.toast("已批量录入 " + cpc.added + " 条（整份文本）" + edWarnNote(cpc));
            return;
          }
          // 回退：纯名单增量（合并语义，不破坏已有连线/喜好）
          App.importNameList(v);
          App.toast("名单已更新");
        },
      };
    }
    if (tab === "link") {
      return {
        title: I18N.t("ed_link_title"),
        hint: I18N.t("ed_link_hint"),
        ph: I18N.t("ed_link_ph"),
        help: I18N.t("ed_link_help"),
        text: function () { return App.exportCPC(); },
        okText: "覆盖",
        apply: function (v) {
          // ★全量覆盖：整份文本替换画板（提交后能直接看到删除结果）
          let r = App.importCPC(v, "replace");
          if (r === null) { App.importLinkText(v); App.toast("已按旧格式合并更新"); return; }
          if (r.errs && r.errs.length) {
            if (r.autoFixText != null) {
              App._ed.buf[App._ed.tab] = r.autoFixText;
              App.toast("槽位数少于人数，已按人数扩容，请再点一次「覆盖」", true);
              return false; // 保留弹窗并显示改正后的文本
            }
            App.toast(r.errs.join("；"), true);
            return false;
          }
          App.toast("已整体覆盖（" + r.added + " 条）" + edWarnNote(r));
        },
      };
    }
    if (App._ed.dataMode === "import") {
      return {
        title: I18N.t("ed_data_import_title"),
        hint: I18N.t("ed_data_import_hint"),
        ph: I18N.t("ed_data_import_ph"),
        help: I18N.t("ed_data_import_help"),
        text: function () { return ""; },
        okText: "上传",
        apply: function (v) {
          let obj = null;
          try { obj = App.parseDataImport(v); }
          catch (err) { App.toast(err.message || "数据读不出来", true); return false; }
          App.confirm("导入会覆盖当前画板全部数据（人物、连线、布局、图例）。确认？", "确认", function () {
            try {
              if (obj && obj.type === "NRD") { App._importLegacy(obj); App.toast("完整数据已导入"); return; }
              App.deserialize(JSON.stringify(obj)); // 内部已 notifyChanged → 画布刷新
              if (App.fitContent) App.fitContent();
              App.toast("完整数据已导入");
            } catch (err2) { App.toast("导入失败：" + (err2.message || ""), true); }
          });
        },
      };
    }
    return {
      title: I18N.t("ed_data_export_title"),
      hint: I18N.t("ed_data_export_hint"),
      help: I18N.t("ed_data_export_help"),
      text: function () { return App.exportFullData(); },
      readonly: true,
    };
  }
  function renderEditor() {
    const ed = App._ed, c = edConf(ed.tab);
    if (ed.buf[ed.tab] == null) ed.buf[ed.tab] = c.text ? c.text() : "";
    const val = ed.buf[ed.tab];
    const ro = !!c.readonly;
    const tabs = ED_TABS.map(function (t) {
      return '<button class="ed-tab' + (ed.tab === t[0] ? " on" : "") + '" data-cmd="ed-tab" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    const sub = ed.tab === "data"
      ? '<div class="ed-sub">' + [["export", "导出"], ["import", "导入"]].map(function (m) {
          return '<button class="ed-tab sm' + (ed.dataMode === m[0] ? " on" : "") + '" data-cmd="ed-mode" data-mode="' + m[0] + '">' + m[1] + "</button>";
        }).join("") + "</div>"
      : "";
    const helpBtn = c.help
      ? '<button class="mh-q' + (ed.helpOpen ? " on" : "") + '" data-cmd="ed-help" title="写法说明" aria-label="写法说明">' + ICONS.help + "</button>"
      : "";
    const helpBox = c.help && ed.helpOpen ? '<div class="ed-help">' + c.help + "</div>" : "";
    const btns = ro
      ? '<button class="btn" data-cmd="txt-select">全选</button><button class="btn primary" data-cmd="m-close">关闭</button>'
      : '<button class="btn" data-cmd="m-close">取消</button><button class="btn" data-cmd="txt-select">全选</button><button class="btn primary" data-cmd="txt-import">' + (c.okText || "应用") + "</button>";
    App.openModal(
      '<div class="mh"><span class="mh-title">' + c.title + "</span><span class=\"mh-right\">" + helpBtn + '<span class="x" data-cmd="m-close">' + ICONS.close + '</span></span></div>' +
      '<div class="ed-tabs">' + tabs + "</div>" + sub +
      '<div class="hint">' + c.hint + "</div>" + helpBox +
      '<textarea class="export-txt tall" id="txtArea" placeholder="' + App.esc(c.ph || "") + '"' + (ro ? " readonly" : "") + ">" + App.esc(val) + "</textarea>" +
      '<div class="modal-btns">' + btns + "</div>", true);
    modalCloseCb = null;
    // 返回 false = 应用失败：保留弹窗与已输入的文字，让用户就地改
    App._txtImport = function (v) {
      ed.buf[ed.tab] = v;
      let ok = true;
      if (c.apply) {
        try { ok = c.apply(v) !== false; }
        catch (err) { ok = false; App.toast(err.message || "应用失败", true); }
      }
      if (ok) { App._txtImport = null; App.closeModal(); }
      else { renderEditor(); } // 重绘，把刚输入的内容留在框里
      App.render();
    };
    if (ro) {
      setTimeout(function () {
        try { const a = $("txtArea"); a.focus(); a.select(); a.setSelectionRange(0, a.value.length); } catch (e) {}
      }, 60);
    }
  }
  // opts = { tab:'people'|'link'|'data', dataMode:'export'|'import' }
  App.editorModal = function (opts) {
    const o = opts || {};
    App._ed = App._ed || { tab: "people", dataMode: "export", buf: {}, helpOpen: false };
    if (o.tab) App._ed.tab = o.tab;
    if (o.dataMode) App._ed.dataMode = o.dataMode;
    App._ed.helpOpen = false; // 每次打开默认收起说明
    // 从入口重开 → 清空所有页签缓存：每个页签都重新从画板导出最新数据（真正的同步编辑）
    // 注：页签间切换仍沿用 buf 保留未提交的编辑，只有「重开面板」才整体刷新
    App._ed.buf = {};
    renderEditor();
  };

  // 打开名单导入弹窗
  function openImportNames(isNew) {
    const pre = isNew ? App.PRESET_TEXT : "";
    App.textModal(ICONS.dlIn + " 导入人物名单",
      "每圈一行：圈号加名字（用 ，或空格分隔）。示例：<br><code>圆心: 我<br>1: 甲，乙，丙<br>2: 丁，戊</code><br>直接粘贴你的名单并点“导入”。",
      pre, true, (txt) => { App.importNameList(txt); });
  }
  function openExportNames() {
    App.textModal(ICONS.dlOut + " 导出人物名单",
      "长按输入框手动全选复制；改动后可贴回“导入名单”。",
      App.exportNameListText(), false);
  }
  function openImportSnapshot() {
    App.textModal(ICONS.pkg + " 导入快照",
      "粘贴快照 JSON（含布局/三表/连线/背景）。旧版 NRD JSON 也可尝试导入。",
      "", true, (txt) => {
        try {
          const obj = JSON.parse(txt);
          if (obj && obj.type === "NRD") { App._importLegacy(obj); return; }
          App.deserialize(txt); // 内部已 notifyChanged（重绘 + 标题 + 自动存档）
          if (App.fitContent) App.fitContent();
          App.toast("快照已导入（头像未包含，需重新设置头像）");
        } catch (err) { App.toast("导入失败：" + err.message, true); }
      });
  }
  // 旧版 NRD 最小兼容
  App._importLegacy = function (obj) {
    App.newDoc();
    App.act(() => {
      const main = (obj.centers || []).find((c) => c.isMain) || (obj.centers || [])[0];
      if (main && Array.isArray(main.ringRadii) && main.ringRadii.length) {
        App.state.rings = main.ringRadii.map((rad) => ({ rad: Number(rad) || 150, slots: null }));
      }
      const map = { "red": "b1", "orange": "b2", "yellow": "b3", "black": "b4" };
      const tmap = { "pink": "t1", "green": "t2", "purple": "t4" };
      (obj.nodes || []).forEach((n) => {
        const rg = parseInt(n.ring, 10); // 圈号 0（圆心）合法，勿用 || 1 兜底
        App.addChar(n.name || "?", Number.isFinite(rg) ? rg : 1);
      });
      const cid = {};
      (obj.nodes || []).forEach((n, i) => { cid[n.id] = App.state.chars[i]; });
      // 圆心=主圆心角色
      if (main && main.nodeId && cid[main.nodeId]) {
        const c = cid[main.nodeId];
        App.moveCharToRing(c.id, 0);
      }
      (obj.links || []).forEach((k) => {
        const s = cid[k.source], d = cid[k.target];
        if (!s || !d) return;
        if (k.bottom && map[k.bottom]) App.addLink(s.id, d.id, "bottom", map[k.bottom], k.oneway ? "one" : "none");
        if (k.top && tmap[k.top]) App.addLink(s.id, d.id, "top", tmap[k.top], k.oneway ? "one" : "none");
      });
    });
    App.setTitleText();
    if (App.fitContent) App.fitContent();
    App.toast("旧版 NRD 已导入（多圆心部分被忽略）");
  };

  // 导出图片流程（E-1 + 容器保存）：
  // 容器环境 = 官方 API（writeTempFile{data} → saveImageToPhotosAlbum），失败 → 全屏预览 + 重试保存按钮；
  // 网页环境 = 无容器 API：若页面末尾挂了网页 IO 覆盖层（仅网页分流版挂载）则直接触发浏览器保存并提示，
  //            否则预览大图，由浏览器原生「长按/右键另存」承接（容器禁用能力不写入容器交付代码）。
  // 导出图片结果屏（v1.0 #10）：生成后展示成品图 + 极简提示 + 发布/新画布/保存/关闭
  async function exportImageFlow() {
    if (!App.state.chars.length) { App.toast("画布为空，先导入人物", true); return; }
    // 图名还是默认的「未命名关系图」→ 先弹改图名窗（与菜单「改图名 / 填表人」同一接口），确认后继续导出
    if (!App.state.title || App.state.title === "未命名关系图") {
      App.openTitleModal(() => { doExportImage(); });
      return;
    }
    doExportImage();
  }
  async function doExportImage() {
    App.toast("正在生成图片…");
    let dataUrl;
    try { dataUrl = await App.exportPNG(2); }
    catch (err) { App.toast("导出失败：" + err.message, true); return; }
    App._retrySaveUrl = dataUrl;
    // 环境判断收敛到 App.isXhs（main.js detectEnv 单一真源）；此处只额外确认相册 API 是否可用
    const hasSaveApi = !!(App.isXhs && window.xhs && window.xhs.miniTool
      && typeof window.xhs.miniTool.saveImageToPhotosAlbum === "function");
    let saved = false;
    try { const r = await App.saveImage(dataUrl); saved = !!(r && r.ok); }
    catch (e) { saved = false; }
    showResultScreen(dataUrl, saved, hasSaveApi);
  }

  // 结果屏：成品图 + 一行提示 + 操作钮（发布/新画布/保存/关闭）；关闭钮放底部避开顶部禁触碰区
  function showResultScreen(dataUrl, saved, hasSaveApi) {
    const note = saved ? "已保存到相册"
      : (hasSaveApi ? "若未自动保存，点下方「保存相册」重试" : "长按图片，或右键 → 图片另存为");
    const saveBtn = saved ? "" : '<button class="btn" data-cmd="save-retry">保存相册</button>';
    App.openModal(
      '<div class="mh"><span>生成完成</span></div>' +
      '<div class="rs-img"><img src="' + dataUrl + '" alt="关系图"></div>' +
      '<div class="hint rs-note">' + note + '</div>' +
      '<div class="modal-btns rs-btns">' +
        '<button class="btn" data-cmd="m-close">关闭</button>' +
        '<button class="btn" data-cmd="new-canvas">建立新画布</button>' +
        '<button class="btn primary" data-cmd="publish">发布小红书</button>' +
        saveBtn +
      '</div>', true);
    modalCloseCb = null;
  }

  // =============== 右侧悬浮工具组拖拽 ===============
  // 拖动超过 8px 视为移动（吸附到最近竖边）；未移动的松手保持按钮点击，移动后的同源 click 在捕获阶段吞掉
  function bindFloatDrag() {
    const box = $("floatTools");
    if (!box) return;
    let sx = 0, sy = 0, ox = 0, oy = 0, active = false, moved = false, suppress = false;
    box.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      active = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      const r = box.getBoundingClientRect();
      ox = r.left; oy = r.top;
    });
    window.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (moved) {
        box.classList.add("dragging");
        box.style.left = Math.max(0, ox + dx) + "px";
        box.style.top = Math.max(0, oy + dy) + "px";
        box.style.right = "auto";
      }
    });
    function stopDrag() {
      if (!active) return;
      active = false;
      if (moved) { snapFloat(box); suppress = true; }
      box.classList.remove("dragging");
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    box.addEventListener("click", (e) => {
      if (suppress) { suppress = false; e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }
  function snapFloat(box) {
    const stage = box.parentElement;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    if (sRect.width < 10) return; // 布局未就绪
    const bRect = box.getBoundingClientRect();
    const GAP = 6;
    const stickRight = (bRect.left + bRect.width / 2) > (sRect.left + sRect.width / 2);
    const left = stickRight ? sRect.width - bRect.width - GAP : GAP;
    let top = bRect.top - sRect.top;
    top = Math.max(48, Math.min(top, Math.max(48, sRect.height - bRect.height - 16)));
    box.style.left = left + "px";
    box.style.top = top + "px";
    box.style.right = "auto";
  }

  // 通知回调
  function refreshAll() {
    App.render();
    renderPanel();
    App.setTitleText();
    const zl = $("zoomLabel");
    if (zl) zl.textContent = Math.round(App.view.s * 100) + "%";
    const rUndo = document.querySelector('#radialMenu [data-act="undo"]');
    const rRedo = document.querySelector('#radialMenu [data-act="redo"]');
    if (rUndo) rUndo.disabled = !App.canUndo();
    if (rRedo) rRedo.disabled = !App.canRedo();
    if (App.activeTab === "layout") updateNodeOps();
    // 自动保存草稿
    if (App.scheduleSave) App.scheduleSave();
  }

  App.notifyChangedFn = refreshAll;
  App.renderPanel = renderPanel;

  // 欢迎（开局引导）
  App.welcome = function (force) {
    const raw = localStorage.getItem(App.DRAFT_KEY);
    let hasDraft = false;
    try { const d = JSON.parse(raw); hasDraft = !!(d && d.chars && d.chars.length); } catch (e) {}
    if (hasDraft && !force) return; // 已有草稿直接继续
    const preset = App.PRESET_TEXT;
    App.openModal(modalHead(I18N.t("welcome_title")) +
      '<div class="hint">' + I18N.t("welcome_guide") + '</div>' +
      '<div style="font-size:12px;color:var(--sub);margin:8px 0 4px">' + I18N.t("welcome_lbl_title") + '</div>' +
      '<input type="text" id="welTitle" class="inp" style="width:100%" maxlength="18" placeholder="' + I18N.t("welcome_ph_title") + '">' +
      '<div style="font-size:12px;color:var(--sub);margin:12px 0 4px">' + I18N.t("welcome_lbl_filler") + '</div>' +
      '<input type="text" id="welFiller" class="inp" style="width:100%" maxlength="12" placeholder="' + I18N.t("welcome_ph_filler") + '">' +
      '<div style="font-size:12px;color:var(--sub);margin:12px 0 4px;display:flex;justify-content:space-between;align-items:center">' +
        '<span>' + I18N.t("welcome_lbl_list") + '</span>' +
        '<button class="mini" data-cmd="wel-load" title="' + I18N.t("welcome_btn_load_title") + '">' + I18N.t("welcome_btn_load") + '</button>' +
      '</div>' +
      '<textarea class="export-txt" id="welTxt" style="min-height:120px" placeholder="' + I18N.t("welcome_ph_list") + '"></textarea>' +
      '<div class="modal-btns">' +
      '<button class="btn" data-cmd="m-close">' + I18N.t("welcome_btn_skip") + '</button>' +
      '<button class="btn primary" data-cmd="wel-ok">' + I18N.t("welcome_btn_start") + '</button>' +
      '</div>');
    modalCloseCb = null;
    const box = $("modalBox");
    const loadBtn = box.querySelector('[data-cmd="wel-load"]');
    const okBtn = box.querySelector('[data-cmd="wel-ok"]');
    if (loadBtn) loadBtn.addEventListener("click", () => {
      const ta = $("welTxt"); if (ta) ta.value = App.PRESET_TEXT;
      App.toast(I18N.t("welcome_toast_load"));
    });
    if (okBtn) okBtn.addEventListener("click", () => {
      const t1 = ($("welTitle") || {}).value || "";
      const f1 = ($("welFiller") || {}).value || "";
      const txt = ($("welTxt") || {}).value || "";
      App.closeModal();
      App.act(() => {
        // 图名/填表人：18/12 字截断，与改名弹窗共用规则
        App.state.title = (t1 || "").trim().slice(0, 18) || "未命名关系图";
        App.state.meta.filler = (f1 || "").trim().slice(0, 12);
        App.setTitleText();
      });
      try { if (txt.trim()) App.importNameList(txt); } catch (err) { App.toast(err.message || "导入失败", true); }
      if (App.onChanged) App.onChanged();
      App.switchTab("link");
    });
  };

  // 初始化
  App.uiInit = function () {
    bindEvents();
    bindRingSel();
    bindSlotSel();
    App.setPanelMode(App.panelMode); // 同步把手 data-state 与 body class
    App.onChanged = refreshAll;    // 初始 tab
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tab") === App.activeTab);
    });
  };
})();
