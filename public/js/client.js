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
 * Window controls: red dot closes to desktop icons, yellow dot minimizes.
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
  if (!page) return;

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
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
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

  function restoreWindow() {
    if (win) win.style.transformOrigin = 'top left';
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
  }

  function toggleInfoWindow() {
    if (!infoWin) return;
    if (infoWin.classList.contains('open')) {
      infoWin.classList.remove('open');
    } else {
      infoWin.style.left = '50%';
      infoWin.style.top = '50%';
      infoWin.style.transform = 'translate(-50%, -50%)';
      infoWin.classList.remove('dragging');
      infoWin.classList.add('open');
    }
  }

  // Wire up desktop icons
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
            window.open(href, '_blank');
          });
        } else if (action === 'about') {
          makeDraggable(icon, function () {
            toggleInfoWindow();
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

  // Red dot: close window, show desktop icons
  if (redDot) {
    redDot.addEventListener('click', function () {
      document.body.classList.remove('window-minimized');
      page.classList.remove('minimized');
      page.classList.remove('maximized');
      resetDesktopIcons();
      if (win) win.style.transformOrigin = 'top left';
      page.classList.add('closed');
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
        restoreFromMinimized();
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
      restoreFromMinimized();
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
