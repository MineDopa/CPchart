/* input.js —— 手势与画布交互（Pointer 事件统一鼠标/触屏） */
(function () {
  const App = (window.App = window.App || {});
  const svg = null;
  const ptrs = new Map();
  let gesture = null; // pan|pinch|nodeDrag|rhDrag|linkDrag
  let gData = null;
  let didMove = false;

  const DRAG_TH = 8; // px

  function getSvg() { return App.byId("svg"); }
  function getVP() { return App.byId("vp"); }

  function nodeAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const n = el.closest(".node");
    return n ? n.getAttribute("data-node") : null;
  }
  function lineAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const h = el.closest(".ln-hit");
    return h ? h.getAttribute("data-link") : null;
  }

  function updateZoomLabel() {
    const zl = App.byId("zoomLabel");
    if (zl) zl.textContent = Math.round(App.view.s * 100) + "%";
    const zr = App.byId("zoomRange");
    if (zr) zr.value = Math.round(App.view.s * 100);
    const zv = App.byId("zoomVal");
    if (zv) zv.textContent = Math.round(App.view.s * 100) + "%";
  }
  function hint(msg) {
    const h = App.byId("viewHint");
    if (h) h.textContent = msg || "双指缩放 · 拖动空白平移";
  }

  // ---- ghost 线（独立层，render 不清除）----
  let ghostEl = null;
  function ensureGhost() {
    if (ghostEl && ghostEl.parentNode) return ghostEl;
    const ns = "http://www.w3.org/2000/svg";
    ghostEl = document.createElementNS(ns, "line");
    ghostEl.setAttribute("stroke", "#ff9500");
    ghostEl.setAttribute("stroke-width", "2.5");
    ghostEl.setAttribute("stroke-dasharray", "7 6");
    ghostEl.setAttribute("opacity", "0.85");
    const g = App.byId("ghostG");
    if (g) g.appendChild(ghostEl);
    return ghostEl;
  }
  function moveGhost(x1, y1, x2, y2) {
    const el = ensureGhost();
    el.setAttribute("x1", x1); el.setAttribute("y1", y1);
    el.setAttribute("x2", x2); el.setAttribute("y2", y2);
    el.style.display = "";
  }
  function hideGhost() {
    if (ghostEl) { ghostEl.style.display = "none"; ghostEl.removeAttribute("x1"); }
  }

  // =============== pointer 事件 ===============
  function onPointerDown(e) {
    // 落在图例角标（HTML 浮层）上的按下不进入画布 pan/drag
    if (e.target && e.target.closest && e.target.closest("#legendChip")) return;
    const svgEl = getSvg();
    const rect = svgEl.getBoundingClientRect();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch" && e.cancelable) e.preventDefault();

    if (ptrs.size === 2) {
      beginPinch(e);
      return;
    }
    if (ptrs.size > 2) return;
    const p = { x: e.clientX, y: e.clientY };
    const tab = App.activeTab;
    const inStage = e.target.closest("#svg");

    // ①-b 布局 + 槽位模式：点空槽 = 把当前选中角色放入该槽
    if (tab === "layout" && App.state.ui && App.state.ui.slotMode) {
      const slotEl = e.target.closest && e.target.closest("[data-slot]");
      if (slotEl) {
        if (!App.selCharId) { App.toast("先点选一个角色，再点空槽放入", true); return; }
        const ringNo = parseInt(slotEl.getAttribute("data-ring"), 10);
        const slotIdx = parseInt(slotEl.getAttribute("data-slot"), 10);
        const c = App.state.chars.find((x) => x.id === App.selCharId);
        if (c) {
          const sl = Math.max(1, App.state.rings[ringNo - 1].slots || 1);
          App.act(() => {
            c.ring = ringNo; c.slot = slotIdx;
            c.angle = -Math.PI / 2 + (slotIdx * 2 * Math.PI) / sl;
          });
        }
        gesture = null;
        return;
      }
    }

    // ① 布局：圈半径拖拽点
    const rh = e.target.closest && e.target.closest("[data-ring]");
    if (tab === "layout" && rh) {
      const ring = parseInt(rh.getAttribute("data-ring"), 10);
      App.commitHist();
      gesture = "rhDrag";
      gData = { ring, startY: p.y, startRad: App.state.rings[ring - 1].rad, moved: false };
      try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }

    // ② 连线删线模式（两段式）：第一次点线 = 选中高亮待删，再点同一条 = 确认删除；点人物 = 筛选其相关连线
    if (tab === "link" && App.paintMode === "erase") {
      const linkId = lineAt(p.x, p.y);
      if (linkId) {
        if (App.pendingLinkDel === linkId) {
          App.pendingLinkDel = null;
          App.act(() => App.removeLink(linkId));
          gesture = null;
          return;
        }
        App.pendingLinkDel = linkId;
        const k = App.state.links.find((x) => x.id === linkId);
        const nm = (id) => { const c = App.state.chars.find((x) => x.id === id); return c ? c.name : "?"; };
        App.render();
        if (k) App.toast(`已选中 ${nm(k.src)} ↔ ${nm(k.dst)}，再点一次删除`);
        return;
      }
      const nid = nodeAt(p.x, p.y);
      if (nid) {
        App.pendingLinkDel = null;
        App.selCharId = nid;
        App.render();
        if (App.renderPanel) App.renderPanel();
        return;
      }
    }

    // ③ 角色模式：点/划角色圆 → 批量赋当前喜好度（粗线画笔）；与画线互斥
    if (tab === "link" && App.paintMode === "char") {
      const cn = nodeAt(p.x, p.y);
      if (cn) {
        App.commitHist();
        const c = App.state.chars.find((x) => x.id === cn);
        const key = App.brush.bottom || null;
        if (c) c.like = key;
        App.selCharId = cn;
        gesture = "charPaint";
        gData = { lastId: cn };
        try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
        App.render();
        if (App.renderPanel) App.renderPanel();
        return;
      }
      // 点空白处：移动画布（与连线/布局模式空白拖动一致，不赋色）
      beginPan(e);
      return;
    }

    // ④ 连线画线：点起点
    const nid = nodeAt(p.x, p.y);
    if (tab === "link" && App.paintMode === "link") {
      if (nid) {
        if (App.linkSource === nid) {
          // 再点一次取消
          App.linkSource = null; App.selCharId = null; hideGhost();
          App.render();
          return;
        }
        App.linkSource = nid;
        App.selCharId = nid;
        App.render();
        gesture = "linkDrag";
        gData = { moved: false, sx: p.x, sy: p.y };
        try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      } else {
        // 点空白：清起点
        if (App.linkSource) { App.linkSource = null; App.selCharId = null; hideGhost(); App.render(); }
      }
    }

    // ④ 布局：拖角色
    if (tab === "layout" && nid) {
      const c = App.state.chars.find((x) => x.id === nid);
      if (c) {
        App.commitHist();
        gesture = "nodeDrag";
        gData = {
          id: nid, moved: false,
          startClient: p,
          // 落点按世界坐标跟随
          wx: c.x, wy: c.y,
        };
        try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
    }

    // ⑤ 人物模式：点选筛选
    if (tab === "person" && nid) {
      App.selCharId = nid;
      App.render();
      if (App.renderPanel) App.renderPanel();
      return;
    }

    // ⑥ 其余（含抓手、样式、空白）：平移
    if (tab !== "link" && tab !== "layout") { /* fallthrough */ }
    beginPan(e);
  }

  function beginPan(e) {
    gesture = "pan";
    didMove = false;
    gData = { startX: e.clientX, startY: e.clientY, tx: App.view.tx, ty: App.view.ty };
    try { getSvg().setPointerCapture(e.pointerId); } catch (err) {}
  }

  function beginPinch(e) {
    gesture = "pinch";
    gData = {
      startDist: dist2(),
      cx: centerX(), cy: centerY(),
      s0: App.view.s,
    };
    // 记录焦点世界坐标
    const rect = getSvg().getBoundingClientRect();
    const wx = (gData.cx - rect.left - App.view.tx) / App.view.s;
    const wy = (gData.cy - rect.top - App.view.ty) / App.view.s;
    gData.wx = wx; gData.wy = wy;
  }

  function dist2() {
    const arr = [...ptrs.values()];
    return Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
  }
  function centerX() {
    const arr = [...ptrs.values()];
    return (arr[0].x + arr[1].x) / 2;
  }
  function centerY() {
    const arr = [...ptrs.values()];
    return (arr[0].y + arr[1].y) / 2;
  }

  function onPointerMove(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
    const p = { x: e.clientX, y: e.clientY };
    const rect = getSvg().getBoundingClientRect();

    if (gesture === "pinch") {
      if (ptrs.size < 2) return;
      const d = dist2();
      const s = App.clamp((gData.s0 * d) / (gData.startDist || 1), 0.3, 3);
      const cx = centerX(), cy = centerY();
      // 保持初始焦点世界坐标不动
      App.view.s = s;
      App.view.tx = cx - gData.wx * s;
      App.view.ty = cy - gData.wy * s;
      App.refreshView();
      updateZoomLabel();
      return;
    }

    if (ptrs.size > 1) return; // 其余情况忽略多指

    if (gesture === "charPaint") {
      const cn = nodeAt(p.x, p.y);
      if (cn && cn !== gData.lastId) {
        const c = App.state.chars.find((x) => x.id === cn);
        if (c) c.like = App.brush.bottom || null;
        gData.lastId = cn;
        App.render();
        if (App.renderPanel) App.renderPanel();
      }
      return;
    }

    if (gesture === "pan") {
      App.view.tx = gData.tx + (p.x - gData.startX);
      App.view.ty = gData.ty + (p.y - gData.startY);
      App.refreshView();
      return;
    }

    if (gesture === "linkDrag") {
      const dx = p.x - gData.sx, dy = p.y - gData.sy;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_TH) {
        gData.moved = true;
        const w0 = App.worldOf(gData.sx, gData.sy);
        const w1 = App.worldOf(p.x, p.y);
        const src = App.state.chars.find((x) => x.id === App.linkSource);
        if (src) moveGhost(src.x, src.y, w1.x, w1.y);
      }
      return;
    }

    if (gesture === "nodeDrag") {
      const dx = (p.x - gData.startClient.x) / App.view.s;
      const dy = (p.y - gData.startClient.y) / App.view.s;
      if (!gData.moved && Math.abs(p.x - gData.startClient.x) + Math.abs(p.y - gData.startClient.y) > DRAG_TH) {
        gData.moved = true;
        // 抬起时该角色不再跟随均分
      }
      if (gData.moved) {
        const c = App.state.chars.find((x) => x.id === gData.id);
        if (c) {
          c.x = gData.wx + dx;
          c.y = gData.wy + dy;
          const el = getSvg().querySelector(`.node[data-node="${c.id}"]`);
          if (el) el.setAttribute("transform", `translate(${c.x},${c.y})`);
          hint("拖到目标圈后松手");
        }
      }
      return;
    }

    if (gesture === "rhDrag") {
      const dRad = (gData.startY - p.y) / App.view.s;
      const rad = Math.max(40, gData.startRad + dRad);
      App.state.rings[gData.ring - 1].rad = rad;
      // 直接更新轨道圆与手柄（手柄位于轨道外侧 3rem）
      const orb = getSvg().querySelector(`.orbit[data-orb="${gData.ring}"]`);
      if (orb) orb.setAttribute("r", rad);
      const hd = getSvg().querySelector(`[data-ring="${gData.ring}"]`);
      if (hd) hd.setAttribute("cy", -(rad + (App.RING_HANDLE_OFFSET || 30)));
      hint(`圈${gData.ring} 半径 ${Math.round(rad)}`);
      return;
    }
  }

  function onPointerUp(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    const p = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "touch" && e.cancelable) e.preventDefault();

    if (gesture === "pinch") {
      gesture = null; gData = null; updateZoomLabel();
      return;
    }
    if (ptrs.size > 0) return;

    const tab = App.activeTab;
    const g = gesture;
    gesture = null;

    if (g === "pan") { gData = null; return; }

    if (g === "rhDrag") {
      const rad = App.state.rings[gData.ring - 1].rad;
      App.notifyChanged();
      hint();
      App.toast(`圈${gData.ring} 半径 ${Math.round(rad)}`);
      gData = null;
      return;
    }

    if (g === "nodeDrag") {
      const c = App.state.chars.find((x) => x.id === gData.id);
      if (c && gData.moved) {
        // 提交到最近的圈
        App.snapChar(c.id, c.x, c.y);
        App.selCharId = c.id;
        App.notifyChanged();
        hint();
      } else if (c) {
        // tap：选中
        App.selCharId = App.selCharId === c.id ? null : c.id;
        App.notifyChanged();
      }
      gData = null;
      return;
    }

    if (g === "charPaint") {
      App.notifyChanged();
      hint();
      App.render();
      if (App.renderPanel) App.renderPanel();
      gData = null;
      return;
    }

    if (g === "linkDrag") {
      const target = nodeAt(p.x, p.y);
      const srcId = App.linkSource;
      const brush = App.brush;
      if (target && target !== srcId && srcId) {
        const hasBottom = !!brush.bottom;
        const hasTop = !!brush.top;
        if (!hasBottom && !hasTop) {
          App.toast("请先选择粗线/细线笔刷", true);
        } else {
          App.act(() => {
            if (hasBottom) App.addLink(srcId, target, "bottom", brush.bottom, brush.arrow);
            if (hasTop) App.addLink(srcId, target, "top", brush.top, brush.arrow);
          });
        }
      }
      App.linkSource = null;
      App.selCharId = null;
      hideGhost();
      App.render();
      if (App.renderPanel) App.renderPanel();
      gData = null;
      return;
    }

    gData = null;
  }

  function onPointerCancel(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      gesture = null; gData = null;
      hideGhost();
    }
  }

  // 鼠标滚轮（桌面预览用）
  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) {
      // 页面在画布内时当作缩放
    }
    const svgEl = getSvg();
    const rect = svgEl.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const wx = (sx - App.view.tx) / App.view.s;
    const wy = (sy - App.view.ty) / App.view.s;
    const f = e.deltaY < 0 ? 1.08 : 0.92;
    App.view.s = App.clamp(App.view.s * f, 0.3, 3);
    App.view.tx = sx - wx * App.view.s;
    App.view.ty = sy - wy * App.view.s;
    App.refreshView();
    updateZoomLabel();
  }

  // 双击空白：清除连线起点
  function onDbl(e) {
    if (App.linkSource) {
      App.linkSource = null;
      App.selCharId = null;
      hideGhost();
      App.render();
    }
  }

  function onCtx(e) { e.preventDefault(); }

  App.inputInit = function () {
    const svgEl = getSvg();
    svgEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    svgEl.addEventListener("wheel", onWheel, { passive: false });
    svgEl.addEventListener("dblclick", onDbl);
    svgEl.addEventListener("contextmenu", onCtx);
    // 阻止 ios 双击缩放、长按菜单（容器已禁长按，这里再兜底）
    svgEl.addEventListener("gesturestart", (e) => e.preventDefault());
    svgEl.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  };
})();
