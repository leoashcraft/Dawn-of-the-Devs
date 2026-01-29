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
 * Window controls: red dot closes to icon, yellow dot minimizes.
 */
(function () {
  var page = document.querySelector('.page');
  var redDot = document.querySelector('.dot-red');
  var yellowDot = document.querySelector('.dot-yellow');
  var greenDot = document.querySelector('.dot-green');
  var dockIcon = document.querySelector('.dock-icon');
  var macDockItem = document.querySelector('.mac-dock-restore');
  var win = page ? page.querySelector('.window') : null;
  if (!page) return;

  // Track icon position (default matches CSS: top 24px, left 24px)
  var iconPos = { x: 24, y: 24 };

  function getIconOrigin() {
    var cx = iconPos.x + 40;
    var cy = iconPos.y + 40;
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

  function restore() {
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

  // Red dot: close window, show dock icon in top-left
  if (redDot) {
    redDot.addEventListener('click', function () {
      document.body.classList.remove('window-minimized');
      page.classList.remove('minimized');
      page.classList.remove('maximized');
      if (win) win.style.transformOrigin = getIconOrigin();
      page.classList.add('closed');
    });
  }

  // Dock icon: drag to reposition, click to restore
  if (dockIcon) {
    var dragging = false;
    var dragMoved = false;
    var dragStartX, dragStartY, iconStartX, iconStartY;

    dockIcon.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      var rect = dockIcon.getBoundingClientRect();
      iconStartX = rect.left;
      iconStartY = rect.top;
      dockIcon.style.transition = 'none';
      e.preventDefault();
    });

    function clampPos(x, y) {
      var w = dockIcon.offsetWidth || 80;
      var h = dockIcon.offsetHeight || 100;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      return { x: x, y: y };
    }

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      if (!dragMoved) return;
      var pos = clampPos(iconStartX + dx, iconStartY + dy);
      dockIcon.style.left = pos.x + 'px';
      dockIcon.style.top = pos.y + 'px';
      dockIcon.style.right = 'auto';
      dockIcon.style.bottom = 'auto';
      iconPos.x = pos.x;
      iconPos.y = pos.y;
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      dockIcon.style.transition = '';
    });

    // Touch support
    dockIcon.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      dragging = true;
      dragMoved = false;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      var rect = dockIcon.getBoundingClientRect();
      iconStartX = rect.left;
      iconStartY = rect.top;
      dockIcon.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      var dx = t.clientX - dragStartX;
      var dy = t.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      if (!dragMoved) return;
      var pos = clampPos(iconStartX + dx, iconStartY + dy);
      dockIcon.style.left = pos.x + 'px';
      dockIcon.style.top = pos.y + 'px';
      dockIcon.style.right = 'auto';
      dockIcon.style.bottom = 'auto';
      iconPos.x = pos.x;
      iconPos.y = pos.y;
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      dockIcon.style.transition = '';
    });

    window.addEventListener('resize', function () {
      if (!page.classList.contains('closed')) return;
      var pos = clampPos(iconPos.x, iconPos.y);
      iconPos.x = pos.x;
      iconPos.y = pos.y;
      dockIcon.style.left = pos.x + 'px';
      dockIcon.style.top = pos.y + 'px';
      dockIcon.style.right = 'auto';
      dockIcon.style.bottom = 'auto';
    });

    dockIcon.addEventListener('click', function () {
      if (dragMoved) return;
      if (win) win.style.transformOrigin = getIconOrigin();
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
    });
  }

  // Yellow dot: minimize to dock at bottom center
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

  // Green dot: restore from minimized, or toggle maximized
  if (greenDot) {
    greenDot.addEventListener('click', function () {
      if (page.classList.contains('minimized')) {
        restore();
      } else {
        page.classList.toggle('maximized');
      }
    });
  }

  // Dock item click: bounce and restore
  if (macDockItem) {
    macDockItem.addEventListener('click', function () {
      macDockItem.classList.add('bouncing');
      macDockItem.addEventListener('animationend', function handler() {
        macDockItem.classList.remove('bouncing');
        macDockItem.removeEventListener('animationend', handler);
      });
      restore();
    });
  }
})();

/**
 * Info window: open from dock, draggable, editable text.
 */
(function () {
  var infoBtn = document.getElementById('dock-info-btn');
  var infoWin = document.getElementById('info-window');
  if (!infoBtn || !infoWin) return;

  var closeBtn = infoWin.querySelector('.info-close');
  var bar = infoWin.querySelector('.info-window-bar');
  var dragging = false;
  var dragStartX, dragStartY, winStartX, winStartY;

  // Open info window
  infoBtn.addEventListener('click', function () {
    if (infoWin.classList.contains('open')) {
      infoWin.classList.remove('open');
      return;
    }
    // Reset to centered position
    infoWin.style.left = '50%';
    infoWin.style.top = '50%';
    infoWin.style.transform = 'translate(-50%, -50%)';
    infoWin.classList.remove('dragging');
    infoWin.classList.add('open');
  });

  // Close info window
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      infoWin.classList.remove('open');
    });
  }

  // Drag to reposition
  if (bar) {
    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.dot')) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      var rect = infoWin.getBoundingClientRect();
      winStartX = rect.left;
      winStartY = rect.top;
      // Switch from centered transform to absolute positioning
      infoWin.style.left = rect.left + 'px';
      infoWin.style.top = rect.top + 'px';
      infoWin.style.transform = 'none';
      infoWin.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      var x = winStartX + dx;
      var y = winStartY + dy;
      // Clamp to viewport
      var w = infoWin.offsetWidth;
      var h = infoWin.offsetHeight;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      infoWin.style.left = x + 'px';
      infoWin.style.top = y + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
    });

    // Touch drag support
    bar.addEventListener('touchstart', function (e) {
      if (e.target.closest('.dot')) return;
      var t = e.touches[0];
      dragging = true;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      var rect = infoWin.getBoundingClientRect();
      winStartX = rect.left;
      winStartY = rect.top;
      infoWin.style.left = rect.left + 'px';
      infoWin.style.top = rect.top + 'px';
      infoWin.style.transform = 'none';
      infoWin.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      var dx = t.clientX - dragStartX;
      var dy = t.clientY - dragStartY;
      var x = winStartX + dx;
      var y = winStartY + dy;
      var w = infoWin.offsetWidth;
      var h = infoWin.offsetHeight;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      infoWin.style.left = x + 'px';
      infoWin.style.top = y + 'px';
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
    });
  }
})();
