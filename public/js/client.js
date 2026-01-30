/**
 * Copy button for code blocks.
 */
(function () {
  var btns = document.querySelectorAll('.copy-btn');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.closest('.code-block').querySelector('code');
      if (!code) return;
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });
})();

/**
 * Auto-prepend https:// to URL input fields.
 */
(function () {
  var inputs = document.querySelectorAll('input.url-input');

  inputs.forEach(function (input) {
    function prependScheme() {
      var val = input.value.trim();
      if (val && !/^https?:\/\//i.test(val)) {
        input.value = 'https://' + val;
      }
    }

    input.addEventListener('blur', prependScheme);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        prependScheme();
      }
    });
  });
})();

/**
 * Window controls, floating windows, desktop icons, dock, trash system.
 */
(function () {
  // ===== DOM References =====

  var page = document.querySelector('.page');
  var redDot = document.querySelector('.dot-red');
  var yellowDot = document.querySelector('.dot-yellow');
  var greenDot = document.querySelector('.dot-green');
  var desktopIcons = document.querySelector('.desktop-icons');
  var macDockItem = document.querySelector('.mac-dock-restore');
  var win = page ? page.querySelector('.window') : null;
  var infoBtn = document.getElementById('dock-info-btn');
  var infoWin = document.getElementById('info-window');
  var infoClose = infoWin ? infoWin.querySelector('.info-close') : null;
  var confirmWin = document.getElementById('confirm-leave');
  var confirmCancel = confirmWin ? confirmWin.querySelector('.confirm-cancel') : null;
  var confirmContinue = confirmWin ? confirmWin.querySelector('.confirm-continue') : null;
  var confirmClose = confirmWin ? confirmWin.querySelector('.confirm-close') : null;
  var contextMenu = document.getElementById('context-menu');
  var contextAction = document.getElementById('context-menu-action');
  var trashDesktopIcon = document.getElementById('trash-icon');
  var dockTrashBtn = document.getElementById('dock-trash-btn');
  var trashWin = document.getElementById('trash-window');
  var trashWinBody = document.getElementById('trash-window-body');
  var trashWinClose = trashWin ? trashWin.querySelector('.trash-window-close') : null;

  var pendingUrl = null;
  var trashedKeys = [];
  var itemMap = {};
  var topZ = 10002;

  if (!page) return;

  // ===== Utilities =====

  function pointInRect(x, y, r) {
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function isOverAnyTrash(x, y) {
    if (trashDesktopIcon && trashDesktopIcon.offsetParent !== null) {
      var trashBtn = trashDesktopIcon.querySelector('.desktop-icon');
      if (trashBtn && pointInRect(x, y, trashBtn.getBoundingClientRect())) return true;
    }
    if (dockTrashBtn && dockTrashBtn.offsetParent !== null) {
      if (pointInRect(x, y, dockTrashBtn.getBoundingClientRect())) return true;
    }
    return false;
  }

  function highlightTrash(x, y) {
    if (trashDesktopIcon && trashDesktopIcon.offsetParent !== null) {
      var trashBtn = trashDesktopIcon.querySelector('.desktop-icon');
      if (trashBtn) {
        trashDesktopIcon.classList.toggle('drag-over',
          pointInRect(x, y, trashBtn.getBoundingClientRect()));
      }
    }
    if (dockTrashBtn && dockTrashBtn.offsetParent !== null) {
      dockTrashBtn.classList.toggle('drag-over',
        pointInRect(x, y, dockTrashBtn.getBoundingClientRect()));
    }
  }

  function clearTrashHighlight() {
    if (trashDesktopIcon) trashDesktopIcon.classList.remove('drag-over');
    if (dockTrashBtn) dockTrashBtn.classList.remove('drag-over');
  }

  function bringToFront(el) {
    if (!el) return;
    topZ++;
    el.style.zIndex = topZ;
  }

  function getOriginFrom(el) {
    if (!el) return 'top left';
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var third = 1 / 3;
    var x = cx < vw * third ? 'left' : cx > vw * (1 - third) ? 'right' : 'center';
    var y = cy < vh * third ? 'top' : cy > vh * (1 - third) ? 'bottom' : 'center';
    if (x === 'center' && y === 'center') return 'center';
    return y + ' ' + x;
  }

  // ===== Context Menu =====

  function showContextMenu(x, y, label, callback) {
    contextAction.textContent = label;
    contextAction.onclick = function () {
      hideContextMenu();
      callback();
    };
    contextMenu.classList.add('open');
    var w = contextMenu.offsetWidth;
    var h = contextMenu.offsetHeight;
    if (x + w > window.innerWidth) x = window.innerWidth - w - 4;
    if (y + h > window.innerHeight) y = window.innerHeight - h - 4;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
  }

  function hideContextMenu() {
    contextMenu.classList.remove('open');
  }

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', hideContextMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideContextMenu();
  });

  // ===== Item Registry =====

  function buildItemMap() {
    if (desktopIcons) {
      var dIcons = desktopIcons.querySelectorAll('.desktop-icon');
      for (var i = 0; i < dIcons.length; i++) {
        var key = dIcons[i].getAttribute('href') || dIcons[i].getAttribute('data-action');
        if (!key || key === 'trash') continue;
        if (!itemMap[key]) itemMap[key] = { key: key };
        itemMap[key].desktopEl = dIcons[i];
        itemMap[key].label = dIcons[i].querySelector('.desktop-label').textContent;
        itemMap[key].iconHtml = dIcons[i].querySelector('.desktop-icon-img').outerHTML;
      }
    }
    var allDock = document.querySelectorAll('.mac-dock-item');
    for (var j = 0; j < allDock.length; j++) {
      var dock = allDock[j];
      var dKey;
      if (dock.classList.contains('mac-dock-restore')) dKey = 'restore';
      else if (dock.id === 'dock-info-btn') dKey = 'about';
      else if (dock.id === 'dock-trash-btn') continue;
      else dKey = dock.getAttribute('href');
      if (!dKey) continue;
      if (!itemMap[dKey]) itemMap[dKey] = { key: dKey };
      itemMap[dKey].dockEl = dock;
      if (!itemMap[dKey].label) itemMap[dKey].label = dock.getAttribute('title') || '';
      if (!itemMap[dKey].iconHtml) {
        var ic = dock.querySelector('.mac-dock-icon, .mac-dock-icon-img');
        if (ic) itemMap[dKey].iconHtml = ic.outerHTML;
      }
    }
  }

  buildItemMap();

  // ===== Trash Operations =====

  function hideItemElements(key) {
    var entry = itemMap[key];
    if (!entry) return;
    if (entry.desktopEl) {
      var el = entry.desktopEl;
      if (el._placeholder) { el._placeholder.remove(); el._placeholder = null; }
      el.style.display = 'none';
      el.classList.remove('poofing', 'dragging');
      el.style.left = '';
      el.style.top = '';
    }
    if (entry.dockEl) {
      entry.dockEl.style.display = 'none';
      entry.dockEl.classList.remove('poofing');
      cleanupDockSeparators();
    }
  }

  function trashItem(key, sourceEl) {
    if (!itemMap[key]) return;
    if (trashedKeys.indexOf(key) !== -1) return;
    trashedKeys.push(key);

    if (key === 'about' && infoWin && infoWin.classList.contains('open')) {
      infoWin.classList.remove('open');
    }

    var hidden = false;
    function doHide() {
      if (hidden) return;
      hidden = true;
      if (sourceEl) sourceEl.classList.remove('poofing');
      hideItemElements(key);
    }

    if (sourceEl) {
      sourceEl.classList.add('poofing');
      sourceEl.addEventListener('animationend', function handler() {
        sourceEl.removeEventListener('animationend', handler);
        doHide();
      });
      setTimeout(doHide, 400);
    } else {
      doHide();
    }

    updateTrashState();
  }

  function restoreItem(key) {
    var idx = trashedKeys.indexOf(key);
    if (idx === -1) return;
    trashedKeys.splice(idx, 1);

    var entry = itemMap[key];
    if (!entry) return;

    if (entry.desktopEl) {
      entry.desktopEl.style.display = '';
      entry.desktopEl.classList.remove('dragging', 'poofing');
      entry.desktopEl.style.left = '';
      entry.desktopEl.style.top = '';
      entry.desktopEl.style.transition = '';
    }
    if (entry.dockEl) {
      entry.dockEl.style.display = '';
      entry.dockEl.classList.remove('poofing');
      cleanupDockSeparators();
    }

    updateTrashState();
  }

  function updateTrashState() {
    var hasItems = trashedKeys.length > 0;
    if (trashDesktopIcon) trashDesktopIcon.classList.toggle('has-items', hasItems);
    if (dockTrashBtn) dockTrashBtn.classList.toggle('has-items', hasItems);
    if (trashWin && trashWin.classList.contains('open')) renderTrashWindow();
  }

  function cleanupDockSeparators() {
    var items = document.querySelectorAll('.mac-dock-items > *');
    var prevWasSep = true;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.classList.contains('mac-dock-separator')) {
        el.style.display = prevWasSep ? 'none' : '';
        prevWasSep = true;
      } else if (el.style.display === 'none') {
        continue;
      } else {
        prevWasSep = false;
      }
    }
    for (var j = items.length - 1; j >= 0; j--) {
      var last = items[j];
      if (last.style.display === 'none') continue;
      if (last.classList.contains('mac-dock-separator')) last.style.display = 'none';
      break;
    }
  }

  // ===== Trash Window =====

  function renderTrashWindow() {
    if (!trashWinBody) return;
    if (trashedKeys.length === 0) {
      trashWinBody.innerHTML = '<p class="trash-empty-message">Trash is empty</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < trashedKeys.length; i++) {
      var entry = itemMap[trashedKeys[i]];
      if (!entry) continue;
      html += '<div class="trash-window-icon" data-trash-key="' + entry.key + '">';
      html += entry.iconHtml;
      html += '<span class="desktop-label">' + entry.label + '</span>';
      html += '</div>';
    }
    trashWinBody.innerHTML = html;

    var nodes = trashWinBody.querySelectorAll('.trash-window-icon');
    for (var j = 0; j < nodes.length; j++) {
      (function (el) {
        var k = el.getAttribute('data-trash-key');
        el.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          e.stopPropagation();
          showContextMenu(e.clientX, e.clientY, 'Put Back', function () {
            restoreItem(k);
          });
        });
        el.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          startCloneDrag('trash', el, k, e.clientX, e.clientY);
          e.preventDefault();
        });
        el.addEventListener('touchstart', function (e) {
          var t = e.touches[0];
          startCloneDrag('trash', el, k, t.clientX, t.clientY);
        }, { passive: true });
      })(nodes[j]);
    }
  }

  function toggleTrashWindow(sourceEl) {
    if (!trashWin) return;
    if (trashWin.classList.contains('open')) {
      trashWin.classList.remove('open');
    } else {
      trashWin.style.left = '50%';
      trashWin.style.top = '50%';
      trashWin.style.transform = 'translate(-50%, -50%)';
      trashWin.style.transformOrigin = getOriginFrom(sourceEl);
      trashWin.classList.remove('dragging');
      trashWin.classList.add('open');
      bringToFront(trashWin);
      renderTrashWindow();
    }
  }

  // ===== Clone Drag System (dock items + trash items) =====

  var cloneDrag = {
    active: false, source: null, key: null, item: null, clone: null,
    startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false
  };

  function startCloneDrag(source, el, key, clientX, clientY) {
    cloneDrag.active = true;
    cloneDrag.source = source;
    cloneDrag.key = key;
    cloneDrag.item = el;
    cloneDrag.moved = false;
    cloneDrag.startX = clientX;
    cloneDrag.startY = clientY;
    var rect = el.getBoundingClientRect();
    cloneDrag.offsetX = clientX - rect.left;
    cloneDrag.offsetY = clientY - rect.top;
    var clone = el.cloneNode(true);
    clone.style.cssText = 'position:fixed;z-index:20001;pointer-events:none;opacity:0.8;transform:none;';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);
    cloneDrag.clone = clone;
  }

  function moveCloneDrag(clientX, clientY) {
    if (!cloneDrag.active) return;
    var dx = clientX - cloneDrag.startX;
    var dy = clientY - cloneDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) cloneDrag.moved = true;
    if (!cloneDrag.moved) return;
    if (cloneDrag.clone) {
      cloneDrag.clone.style.left = (clientX - cloneDrag.offsetX) + 'px';
      cloneDrag.clone.style.top = (clientY - cloneDrag.offsetY) + 'px';
    }
    if (cloneDrag.source === 'dock') highlightTrash(clientX, clientY);
  }

  function endCloneDrag(clientX, clientY) {
    if (!cloneDrag.active) return;
    cloneDrag.active = false;
    var source = cloneDrag.source;
    var key = cloneDrag.key;
    var moved = cloneDrag.moved;
    var item = cloneDrag.item;
    if (cloneDrag.clone) { cloneDrag.clone.remove(); cloneDrag.clone = null; }
    clearTrashHighlight();

    if (moved && item) item._wasDragged = true;
    if (!moved) return;

    if (source === 'dock' && isOverAnyTrash(clientX, clientY)) {
      trashItem(key, item);
    } else if (source === 'trash' && trashWin) {
      if (!pointInRect(clientX, clientY, trashWin.getBoundingClientRect())) {
        restoreItem(key);
      }
    }
  }

  document.addEventListener('mousemove', function (e) { moveCloneDrag(e.clientX, e.clientY); });
  document.addEventListener('mouseup', function (e) { endCloneDrag(e.clientX, e.clientY); });
  document.addEventListener('touchmove', function (e) {
    if (!cloneDrag.active) return;
    var t = e.touches[0];
    moveCloneDrag(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!cloneDrag.active) return;
    var t = e.changedTouches[0];
    endCloneDrag(t.clientX, t.clientY);
  });

  // ===== Desktop Icon Drag (position-based) =====

  function makeDraggable(el, onClick) {
    var dragging = false;
    var dragMoved = false;
    var dragStartX, dragStartY, elStartX, elStartY;

    function clamp(x, y) {
      var w = el.offsetWidth || 80;
      var h = el.offsetHeight || 100;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      return { x: x, y: y };
    }

    function startDrag(clientX, clientY) {
      dragging = true;
      dragMoved = false;
      dragStartX = clientX;
      dragStartY = clientY;
      var rect = el.getBoundingClientRect();
      elStartX = rect.left;
      elStartY = rect.top;
      el.style.transition = 'none';
    }

    function moveDrag(clientX, clientY) {
      if (!dragging) return;
      var dx = clientX - dragStartX;
      var dy = clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      if (!dragMoved) return;
      if (!el.classList.contains('dragging')) {
        var placeholder = document.createElement('div');
        placeholder.className = 'desktop-icon-placeholder';
        placeholder.style.width = el.offsetWidth + 'px';
        placeholder.style.height = el.offsetHeight + 'px';
        el.parentNode.insertBefore(placeholder, el);
        el._placeholder = placeholder;
        el.classList.add('dragging');
        el.style.left = elStartX + 'px';
        el.style.top = elStartY + 'px';
      }
      var pos = clamp(elStartX + dx, elStartY + dy);
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      var c = el.getBoundingClientRect();
      var cx = c.left + c.width / 2;
      var cy = c.top + c.height / 2;
      highlightTrash(cx, cy);
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      clearTrashHighlight();

      if (dragMoved) {
        var c = el.getBoundingClientRect();
        var cx = c.left + c.width / 2;
        var cy = c.top + c.height / 2;
        if (isOverAnyTrash(cx, cy)) {
          var key = el.getAttribute('href') || el.getAttribute('data-action');
          if (key) { trashItem(key, el); return; }
        }
      }

      if (el._placeholder) { el._placeholder.remove(); el._placeholder = null; }
    }

    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { if (dragging) moveDrag(e.clientX, e.clientY); });
    document.addEventListener('mouseup', function () { endDrag(); });
    el.addEventListener('touchstart', function (e) { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchmove', function (e) { if (dragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchend', function () { endDrag(); });

    el.addEventListener('click', function (e) {
      if (dragMoved) { e.preventDefault(); return; }
      if (onClick) { e.preventDefault(); onClick(); }
    });

    el._dragClamp = clamp;
  }

  // ===== Window Dragging =====

  function makeWindowDraggable(winEl, barEl) {
    if (!winEl || !barEl) return;
    var dragging = false;
    var dragStartX, dragStartY, winStartX, winStartY;

    function start(clientX, clientY) {
      dragging = true;
      dragStartX = clientX;
      dragStartY = clientY;
      var rect = winEl.getBoundingClientRect();
      winStartX = rect.left;
      winStartY = rect.top;
      winEl.style.left = rect.left + 'px';
      winEl.style.top = rect.top + 'px';
      winEl.style.transform = 'none';
      winEl.classList.add('dragging');
    }

    function move(clientX, clientY) {
      if (!dragging) return;
      var x = winStartX + clientX - dragStartX;
      var y = winStartY + clientY - dragStartY;
      var w = winEl.offsetWidth;
      var h = winEl.offsetHeight;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      winEl.style.left = x + 'px';
      winEl.style.top = y + 'px';
    }

    function end() {
      if (!dragging) return;
      dragging = false;
    }

    barEl.addEventListener('mousedown', function (e) {
      if (e.target.closest('.dot')) return;
      start(e.clientX, e.clientY);
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    document.addEventListener('mouseup', end);

    barEl.addEventListener('touchstart', function (e) {
      if (e.target.closest('.dot')) return;
      var t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      move(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', end);
  }

  // ===== Window Management =====

  var dotdIcon = desktopIcons ? desktopIcons.querySelector('[data-action="restore"]') : null;

  function restoreWindow() {
    if (win) win.style.transformOrigin = getOriginFrom(dotdIcon);
    page.classList.remove('closed');
    page.classList.remove('maximized');
    page.classList.add('restoring');
    if (win) {
      win.addEventListener('animationend', function handler() {
        page.classList.remove('restoring');
        win.style.transformOrigin = '';
        win.removeEventListener('animationend', handler);
      });
    }
  }

  function restoreFromMinimized() {
    document.body.classList.remove('window-minimized');
    page.classList.remove('minimized');
    page.classList.add('expanding');
    if (win) {
      win.addEventListener('animationend', function handler() {
        page.classList.remove('expanding');
        win.removeEventListener('animationend', handler);
      });
    }
  }

  function resetDesktopIcons() {
    if (!desktopIcons) return;
    var icons = desktopIcons.querySelectorAll('.desktop-icon');
    for (var i = 0; i < icons.length; i++) {
      icons[i].classList.remove('dragging');
      icons[i].style.left = '';
      icons[i].style.top = '';
      icons[i].style.transition = '';
    }
    clearTrashHighlight();
  }

  function toggleInfoWindow(sourceEl) {
    if (!infoWin) return;
    if (infoWin.classList.contains('open')) {
      infoWin.classList.remove('open');
    } else {
      infoWin.style.left = '50%';
      infoWin.style.top = '50%';
      infoWin.style.transform = 'translate(-50%, -50%)';
      infoWin.style.transformOrigin = getOriginFrom(sourceEl);
      infoWin.classList.remove('dragging');
      infoWin.classList.add('open');
      bringToFront(infoWin);
    }
  }

  function openConfirm(url, sourceEl) {
    pendingUrl = url;
    confirmWin.classList.remove('closing', 'dragging');
    confirmWin.style.left = '50%';
    confirmWin.style.top = '50%';
    confirmWin.style.transform = 'translate(-50%, -50%)';
    confirmWin.style.transformOrigin = getOriginFrom(sourceEl);
    confirmWin.classList.add('open');
    bringToFront(confirmWin);
  }

  function showConfirmLeave(url, sourceEl) {
    if (!confirmWin) { window.open(url, '_blank'); return; }
    if (confirmWin.classList.contains('open')) {
      if (confirmWin.classList.contains('dragging')) {
        confirmWin.classList.remove('dragging');
        confirmWin.style.left = '50%';
        confirmWin.style.top = '50%';
        confirmWin.style.transform = 'translate(-50%, -50%)';
      }
      confirmWin.classList.remove('open');
      confirmWin.classList.add('closing');
      confirmWin.addEventListener('animationend', function handler() {
        confirmWin.removeEventListener('animationend', handler);
        confirmWin.classList.remove('closing');
        openConfirm(url, sourceEl);
      });
      return;
    }
    openConfirm(url, sourceEl);
  }

  function closeConfirmLeave() {
    if (!confirmWin) return;
    confirmWin.classList.remove('open', 'closing', 'dragging');
    pendingUrl = null;
  }

  // ===== Wiring: Confirm Window =====

  if (confirmCancel) confirmCancel.addEventListener('click', closeConfirmLeave);
  if (confirmClose) confirmClose.addEventListener('click', closeConfirmLeave);
  if (confirmContinue) {
    confirmContinue.addEventListener('click', function () {
      if (pendingUrl) window.open(pendingUrl, '_blank');
      closeConfirmLeave();
    });
  }

  // ===== Wiring: Info Window =====

  if (infoClose) {
    infoClose.addEventListener('click', function () {
      infoWin.classList.remove('open');
    });
  }

  // ===== Wiring: Desktop Icons =====

  if (desktopIcons) {
    var icons = desktopIcons.querySelectorAll('.desktop-icon');
    for (var i = 0; i < icons.length; i++) {
      (function (icon) {
        var action = icon.getAttribute('data-action');
        var href = icon.getAttribute('href');

        if (action === 'restore') {
          makeDraggable(icon, function () { resetDesktopIcons(); restoreWindow(); });
        } else if (action === 'link' && href) {
          makeDraggable(icon, function () { showConfirmLeave(href, icon); });
        } else if (action === 'about') {
          makeDraggable(icon, function () { toggleInfoWindow(icon); });
        }

        if (action !== 'trash') {
          icon.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var key = href || action;
            showContextMenu(e.clientX, e.clientY, 'Move to Trash', function () {
              trashItem(key, icon);
            });
          });
        }
      })(icons[i]);
    }

    window.addEventListener('resize', function () {
      if (!page.classList.contains('closed')) return;
      var allIcons = desktopIcons.querySelectorAll('.desktop-icon.dragging');
      for (var j = 0; j < allIcons.length; j++) {
        var ic = allIcons[j];
        if (ic._dragClamp) {
          var rect = ic.getBoundingClientRect();
          var pos = ic._dragClamp(rect.left, rect.top);
          ic.style.left = pos.x + 'px';
          ic.style.top = pos.y + 'px';
        }
      }
    });
  }

  // ===== Wiring: Window Dots =====

  if (redDot) {
    redDot.addEventListener('click', function () {
      document.body.classList.remove('window-minimized');
      page.classList.remove('minimized');
      page.classList.remove('maximized');
      resetDesktopIcons();
      if (win) win.style.transformOrigin = getOriginFrom(dotdIcon);
      page.classList.add('closed');
    });
  }

  if (yellowDot) {
    yellowDot.addEventListener('click', function () {
      if (page.classList.contains('minimized')) return;
      page.classList.remove('maximized');
      page.classList.add('minimizing');
      if (win) {
        win.addEventListener('animationend', function handler() {
          page.classList.remove('minimizing');
          page.classList.add('minimized');
          document.body.classList.add('window-minimized');
          win.removeEventListener('animationend', handler);
        });
      }
    });
  }

  if (greenDot) {
    greenDot.addEventListener('click', function () {
      if (page.classList.contains('minimized')) {
        restoreFromMinimized();
      } else {
        page.classList.toggle('maximized');
      }
    });
  }

  // ===== Wiring: Dock =====

  if (macDockItem) {
    macDockItem.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startCloneDrag('dock', macDockItem, 'restore', e.clientX, e.clientY);
      e.preventDefault();
    });
    macDockItem.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      startCloneDrag('dock', macDockItem, 'restore', t.clientX, t.clientY);
    }, { passive: true });
    macDockItem.addEventListener('click', function () {
      if (macDockItem._wasDragged) { macDockItem._wasDragged = false; return; }
      macDockItem.classList.add('bouncing');
      macDockItem.addEventListener('animationend', function handler() {
        macDockItem.classList.remove('bouncing');
        macDockItem.removeEventListener('animationend', handler);
      });
      restoreFromMinimized();
    });
    macDockItem.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, 'Remove from Dock', function () {
        trashItem('restore', macDockItem);
      });
    });
  }

  var dockLinks = document.querySelectorAll('a.mac-dock-item[href]');
  for (var d = 0; d < dockLinks.length; d++) {
    (function (link) {
      var key = link.getAttribute('href');
      link.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        startCloneDrag('dock', link, key, e.clientX, e.clientY);
        e.preventDefault();
      });
      link.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        startCloneDrag('dock', link, key, t.clientX, t.clientY);
      }, { passive: true });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (link._wasDragged) { link._wasDragged = false; return; }
        showConfirmLeave(key, link);
      });
      link.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, 'Remove from Dock', function () {
          trashItem(key, link);
        });
      });
    })(dockLinks[d]);
  }

  if (infoBtn) {
    infoBtn.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startCloneDrag('dock', infoBtn, 'about', e.clientX, e.clientY);
      e.preventDefault();
    });
    infoBtn.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      startCloneDrag('dock', infoBtn, 'about', t.clientX, t.clientY);
    }, { passive: true });
    infoBtn.addEventListener('click', function () {
      if (infoBtn._wasDragged) { infoBtn._wasDragged = false; return; }
      toggleInfoWindow(infoBtn);
    });
    infoBtn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, 'Remove from Dock', function () {
        trashItem('about', infoBtn);
      });
    });
  }

  // ===== Wiring: Trash Icon & Window =====

  if (trashDesktopIcon) {
    var trashBtn = trashDesktopIcon.querySelector('.desktop-icon');
    if (trashBtn) {
      trashBtn.addEventListener('click', function () {
        toggleTrashWindow(trashDesktopIcon);
      });
    }
  }

  if (dockTrashBtn) {
    dockTrashBtn.addEventListener('click', function () {
      if (dockTrashBtn._wasDragged) { dockTrashBtn._wasDragged = false; return; }
      toggleTrashWindow(dockTrashBtn);
    });
  }

  if (trashWinClose) {
    trashWinClose.addEventListener('click', function () {
      trashWin.classList.remove('open');
    });
  }

  // ===== Wiring: Window Dragging & Focus =====

  makeWindowDraggable(infoWin, infoWin ? infoWin.querySelector('.info-window-bar') : null);
  makeWindowDraggable(confirmWin, confirmWin ? confirmWin.querySelector('.confirm-window-bar') : null);
  makeWindowDraggable(trashWin, trashWin ? trashWin.querySelector('.trash-window-bar') : null);

  [infoWin, confirmWin, trashWin].forEach(function (w) {
    if (!w) return;
    w.addEventListener('mousedown', function () { bringToFront(w); });
    w.addEventListener('touchstart', function () { bringToFront(w); }, { passive: true });
  });
})();
