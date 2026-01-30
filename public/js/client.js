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
 * Window controls, floating windows, desktop icons.
 */
(function () {
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
  var pendingUrl = null;
  var trashedItems = [];
  var contextMenu = document.getElementById('context-menu');
  var contextAction = document.getElementById('context-menu-action');
  var trashDesktopIcon = document.getElementById('trash-icon');
  var dockTrashBtn = document.getElementById('dock-trash-btn');
  var trashWin = document.getElementById('trash-window');
  var trashWinBody = document.getElementById('trash-window-body');
  var trashWinClose = trashWin ? trashWin.querySelector('.trash-window-close') : null;
  var contextTarget = null;
  if (!page) return;

  // Shared z-index counter for floating windows
  var topZ = 10002;
  function bringToFront(el) {
    if (!el) return;
    topZ++;
    el.style.zIndex = topZ;
  }

  if (infoWin) {
    infoWin.addEventListener('mousedown', function () { bringToFront(infoWin); });
    infoWin.addEventListener('touchstart', function () { bringToFront(infoWin); }, { passive: true });
  }
  if (confirmWin) {
    confirmWin.addEventListener('mousedown', function () { bringToFront(confirmWin); });
    confirmWin.addEventListener('touchstart', function () { bringToFront(confirmWin); }, { passive: true });
  }

  // Context menu
  function showContextMenu(x, y, label, callback) {
    contextAction.textContent = label;
    contextAction.onclick = function() {
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
    contextTarget = null;
  }

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', function() {
    hideContextMenu();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideContextMenu();
  });

  // Trash operations
  function updateTrashState() {
    var hasItems = trashedItems.length > 0;
    if (trashDesktopIcon) trashDesktopIcon.classList.toggle('has-items', hasItems);
    if (dockTrashBtn) dockTrashBtn.classList.toggle('has-items', hasItems);
    renderTrashWindow();
  }

  function trashDesktopIconEl(icon) {
    var item = {
      type: 'desktop',
      label: icon.querySelector('.desktop-label').textContent,
      action: icon.getAttribute('data-action'),
      href: icon.getAttribute('href') || '',
      iconHtml: icon.querySelector('.desktop-icon-img').outerHTML,
      element: icon,
    };

    if (item.action === 'about' && infoWin && infoWin.classList.contains('open')) {
      infoWin.classList.remove('open');
    }

    icon.classList.add('poofing');
    icon.addEventListener('animationend', function handler() {
      icon.removeEventListener('animationend', handler);
      if (icon._placeholder) { icon._placeholder.remove(); icon._placeholder = null; }
      icon.style.display = 'none';
      icon.classList.remove('poofing', 'dragging');
      icon.style.left = '';
      icon.style.top = '';
    });

    trashedItems.push(item);
    updateTrashState();
  }

  function trashDockItem(dockItem) {
    var item = {
      type: 'dock',
      label: dockItem.getAttribute('title') || 'Dock Item',
      href: dockItem.getAttribute('href') || '',
      iconHtml: dockItem.querySelector('.mac-dock-icon, .mac-dock-icon-img').outerHTML,
      element: dockItem,
    };

    dockItem.classList.add('poofing');
    dockItem.addEventListener('animationend', function handler() {
      dockItem.removeEventListener('animationend', handler);
      dockItem.style.display = 'none';
      dockItem.classList.remove('poofing');
      cleanupDockSeparators();
    });

    trashedItems.push(item);
    updateTrashState();
  }

  function restoreFromTrash(index) {
    var item = trashedItems.splice(index, 1)[0];
    if (!item) return;

    if (item.type === 'desktop') {
      item.element.style.display = '';
      item.element.classList.remove('dragging');
      item.element.style.left = '';
      item.element.style.top = '';
    } else if (item.type === 'dock') {
      item.element.style.display = '';
      cleanupDockSeparators();
    }

    updateTrashState();
  }

  function cleanupDockSeparators() {
    var items = document.querySelectorAll('.mac-dock-items > *');
    var prevWasSep = true;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.classList.contains('mac-dock-separator')) {
        if (prevWasSep) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
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
      if (last.classList.contains('mac-dock-separator')) {
        last.style.display = 'none';
      }
      break;
    }
  }

  // Trash window rendering
  function renderTrashWindow() {
    if (!trashWinBody) return;
    if (trashedItems.length === 0) {
      trashWinBody.innerHTML = '<p class="trash-empty-message">Trash is empty</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < trashedItems.length; i++) {
      var item = trashedItems[i];
      html += '<div class="trash-item" data-trash-index="' + i + '">';
      html += '<span class="trash-item-icon">' + item.iconHtml + '</span>';
      html += '<span class="trash-item-label">' + item.label + '</span>';
      html += '<span class="trash-item-source">' + item.type + '</span>';
      html += '</div>';
    }
    trashWinBody.innerHTML = html;

    var trashItems = trashWinBody.querySelectorAll('.trash-item');
    for (var j = 0; j < trashItems.length; j++) {
      (function(el) {
        var idx = parseInt(el.getAttribute('data-trash-index'), 10);
        el.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          showContextMenu(e.clientX, e.clientY, 'Put Back', function() {
            restoreFromTrash(idx);
          });
        });
      })(trashItems[j]);
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

  /**
   * Make an element draggable with click vs drag distinction.
   * onClick is called only when the user clicks without dragging.
   */
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

      // Create placeholder to hold the icon's spot in flex layout
      var placeholder = document.createElement('div');
      placeholder.className = 'desktop-icon-placeholder';
      placeholder.style.width = el.offsetWidth + 'px';
      placeholder.style.height = el.offsetHeight + 'px';
      el.parentNode.insertBefore(placeholder, el);
      el._placeholder = placeholder;
    }

    function moveDrag(clientX, clientY) {
      if (!dragging) return;
      var dx = clientX - dragStartX;
      var dy = clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      if (!dragMoved) return;
      // Switch to fixed positioning on first real drag
      if (!el.classList.contains('dragging')) {
        el.classList.add('dragging');
        el.style.left = elStartX + 'px';
        el.style.top = elStartY + 'px';
      }
      var pos = clamp(elStartX + dx, elStartY + dy);
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';

      // Drag-over highlighting for trash icon
      if (trashDesktopIcon && el.getAttribute('data-action') !== 'trash') {
        var trashRect = trashDesktopIcon.getBoundingClientRect();
        var elRect = el.getBoundingClientRect();
        var elCX = elRect.left + elRect.width / 2;
        var elCY = elRect.top + elRect.height / 2;
        var over = elCX >= trashRect.left && elCX <= trashRect.right &&
                   elCY >= trashRect.top && elCY <= trashRect.bottom;
        trashDesktopIcon.classList.toggle('drag-over', over);
      }
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';

      if (trashDesktopIcon) trashDesktopIcon.classList.remove('drag-over');

      // Check if dropped on trash icon (desktop)
      if (dragMoved && trashDesktopIcon && el.getAttribute('data-action') !== 'trash') {
        var trashRect = trashDesktopIcon.getBoundingClientRect();
        var elRect = el.getBoundingClientRect();
        var elCX = elRect.left + elRect.width / 2;
        var elCY = elRect.top + elRect.height / 2;
        if (elCX >= trashRect.left && elCX <= trashRect.right &&
            elCY >= trashRect.top && elCY <= trashRect.bottom) {
          trashDesktopIconEl(el);
          return;
        }
      }

      // Normal end: remove placeholder
      if (el._placeholder) {
        el._placeholder.remove();
        el._placeholder = null;
      }
    }

    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', function () {
      endDrag();
    });

    el.addEventListener('touchstart', function (e) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      endDrag();
    });

    el.addEventListener('click', function (e) {
      if (dragMoved) {
        e.preventDefault();
        return;
      }
      if (onClick) {
        e.preventDefault();
        onClick();
      }
    });

    // Reclaim helper for resize clamping
    el._dragClamp = clamp;
  }

  /**
   * Make a floating window draggable by its title bar.
   */
  function makeWindowDraggable(winEl, barEl) {
    if (!winEl || !barEl) return;
    var dragging = false;
    var dragStartX, dragStartY, winStartX, winStartY;

    barEl.addEventListener('mousedown', function (e) {
      if (e.target.closest('.dot')) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      var rect = winEl.getBoundingClientRect();
      winStartX = rect.left;
      winStartY = rect.top;
      winEl.style.left = rect.left + 'px';
      winEl.style.top = rect.top + 'px';
      winEl.style.transform = 'none';
      winEl.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      var x = winStartX + dx;
      var y = winStartY + dy;
      var w = winEl.offsetWidth;
      var h = winEl.offsetHeight;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      winEl.style.left = x + 'px';
      winEl.style.top = y + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
    });

    barEl.addEventListener('touchstart', function (e) {
      if (e.target.closest('.dot')) return;
      var t = e.touches[0];
      dragging = true;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      var rect = winEl.getBoundingClientRect();
      winStartX = rect.left;
      winStartY = rect.top;
      winEl.style.left = rect.left + 'px';
      winEl.style.top = rect.top + 'px';
      winEl.style.transform = 'none';
      winEl.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      var dx = t.clientX - dragStartX;
      var dy = t.clientY - dragStartY;
      var x = winStartX + dx;
      var y = winStartY + dy;
      var w = winEl.offsetWidth;
      var h = winEl.offsetHeight;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      winEl.style.left = x + 'px';
      winEl.style.top = y + 'px';
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
    });
  }

  var dotdIcon = desktopIcons ? desktopIcons.querySelector('[data-action="restore"]') : null;

  function getOriginFrom(el) {
    if (!el) return 'top left';
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var third = 1 / 3;

    var x, y;
    if (cx < vw * third) x = 'left';
    else if (cx > vw * (1 - third)) x = 'right';
    else x = 'center';

    if (cy < vh * third) y = 'top';
    else if (cy > vh * (1 - third)) y = 'bottom';
    else y = 'center';

    if (x === 'center' && y === 'center') return 'center';
    return y + ' ' + x;
  }

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
    if (trashDesktopIcon) trashDesktopIcon.classList.remove('drag-over');
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
      // Already open — close first, then reopen with new source
      if (confirmWin.classList.contains('dragging')) {
        // Reset from dragged position back to centered for the close animation
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

  // Wire: confirm cancel/continue/close buttons
  if (confirmCancel) confirmCancel.addEventListener('click', closeConfirmLeave);
  if (confirmClose) confirmClose.addEventListener('click', closeConfirmLeave);
  if (confirmContinue) {
    confirmContinue.addEventListener('click', function () {
      if (pendingUrl) window.open(pendingUrl, '_blank');
      closeConfirmLeave();
    });
  }

  // Wire: info close button
  if (infoClose) {
    infoClose.addEventListener('click', function () {
      infoWin.classList.remove('open');
    });
  }

  // Wire: desktop icons
  if (desktopIcons) {
    var icons = desktopIcons.querySelectorAll('.desktop-icon');
    for (var i = 0; i < icons.length; i++) {
      (function (icon) {
        var action = icon.getAttribute('data-action');
        var href = icon.getAttribute('href');

        if (action === 'restore') {
          makeDraggable(icon, function () {
            resetDesktopIcons();
            restoreWindow();
          });
        } else if (action === 'link' && href) {
          makeDraggable(icon, function () {
            showConfirmLeave(href, icon);
          });
        } else if (action === 'about') {
          makeDraggable(icon, function () {
            toggleInfoWindow(icon);
          });
        }

        // Context menu: Move to Trash
        if (icon.getAttribute('data-action') !== 'trash') {
          icon.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, 'Move to Trash', function() {
              trashDesktopIconEl(icon);
            });
          });
        }
      })(icons[i]);
    }

    // Clamp all dragged icons on resize
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

  // Wire: red/yellow/green dots
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

  // Wire: dock restore
  if (macDockItem) {
    macDockItem.addEventListener('click', function () {
      macDockItem.classList.add('bouncing');
      macDockItem.addEventListener('animationend', function handler() {
        macDockItem.classList.remove('bouncing');
        macDockItem.removeEventListener('animationend', handler);
      });
      restoreFromMinimized();
    });
  }

  // Wire: dock links
  var dockLinks = document.querySelectorAll('a.mac-dock-item[href]');
  for (var d = 0; d < dockLinks.length; d++) {
    (function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        showConfirmLeave(link.getAttribute('href'), link);
      });
      link.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, 'Remove from Dock', function() {
          trashDockItem(link);
        });
      });
    })(dockLinks[d]);
  }

  // Wire: dock info button
  if (infoBtn) {
    infoBtn.addEventListener('click', function () {
      toggleInfoWindow(infoBtn);
    });
  }

  // Apply: makeWindowDraggable to info + confirm + trash windows
  makeWindowDraggable(infoWin, infoWin ? infoWin.querySelector('.info-window-bar') : null);
  makeWindowDraggable(confirmWin, confirmWin ? confirmWin.querySelector('.confirm-window-bar') : null);
  makeWindowDraggable(trashWin, trashWin ? trashWin.querySelector('.trash-window-bar') : null);

  if (trashWin) {
    trashWin.addEventListener('mousedown', function() { bringToFront(trashWin); });
    trashWin.addEventListener('touchstart', function() { bringToFront(trashWin); }, { passive: true });
  }

  // Wire: trash desktop icon click
  if (trashDesktopIcon) {
    var trashBtn = trashDesktopIcon.querySelector('.desktop-icon');
    if (trashBtn) {
      trashBtn.addEventListener('click', function() {
        toggleTrashWindow(trashDesktopIcon);
      });
    }
  }

  // Wire: dock trash button click
  if (dockTrashBtn) {
    dockTrashBtn.addEventListener('click', function() {
      toggleTrashWindow(dockTrashBtn);
    });
  }

  // Wire: trash window close
  if (trashWinClose) {
    trashWinClose.addEventListener('click', function() {
      trashWin.classList.remove('open');
    });
  }
})();
