import { env } from '../core/env.js';

const MAXIMIZE_SVG = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
const MINIMIZE_SVG = '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>';
const MOUSE_ON_SVG = '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/>';
const MOUSE_OFF_SVG = '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><line x1="2" y1="2" x2="22" y2="22"/>';
const SUN_SVG = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
const MOON_SVG = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';

export function initStageTools({
  getActiveEffect,
  toggleMirrorWebcam,
  fileInput,
  resetAllSettings,
}) {
  const canvas = document.getElementById('canvas');
  const stage = document.getElementById('stage');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fsIcon = document.getElementById('fsIcon');
  const cursorToggleBtn = document.getElementById('cursorToggleBtn');
  const cursorIcon = document.getElementById('cursorIcon');
  const themeBtn = document.getElementById('themeBtn');
  const themeIcon = document.getElementById('themeIcon');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
  const togglePanelBtn = document.getElementById('togglePanelBtn');
  const confirmModal = document.getElementById('confirmModal');
  const confirmResetBtn = document.getElementById('confirmResetBtn');
  const cancelResetBtn = document.getElementById('cancelResetBtn');

  // Left & Right Panels Toggle
  function setDrawerOpen(isOpen) {
    if (isOpen) {
      document.body.classList.remove('drawer-collapsed');
      if (toggleDrawerBtn) {
        toggleDrawerBtn.classList.add('active');
        toggleDrawerBtn.setAttribute('data-tooltip', 'Hide Catalog ([)');
      }
    } else {
      document.body.classList.add('drawer-collapsed');
      if (toggleDrawerBtn) {
        toggleDrawerBtn.classList.remove('active');
        toggleDrawerBtn.setAttribute('data-tooltip', 'Show Catalog ([)');
      }
    }
    try {
      localStorage.setItem('fffx-drawer-collapsed', String(!isOpen));
    } catch {}
    window.dispatchEvent(new Event('resize'));
  }

  function toggleDrawer() {
    const isCurrentlyCollapsed = document.body.classList.contains('drawer-collapsed');
    setDrawerOpen(isCurrentlyCollapsed);
  }

  function setPanelOpen(isOpen) {
    if (isOpen) {
      document.body.classList.remove('panel-collapsed');
      if (togglePanelBtn) {
        togglePanelBtn.classList.add('active');
        togglePanelBtn.setAttribute('data-tooltip', 'Hide Parameters (])');
      }
    } else {
      document.body.classList.add('panel-collapsed');
      if (togglePanelBtn) {
        togglePanelBtn.classList.remove('active');
        togglePanelBtn.setAttribute('data-tooltip', 'Show Parameters (])');
      }
    }
    try {
      localStorage.setItem('fffx-panel-collapsed', String(!isOpen));
    } catch {}
    window.dispatchEvent(new Event('resize'));
  }

  function togglePanel() {
    const isCurrentlyCollapsed = document.body.classList.contains('panel-collapsed');
    setPanelOpen(isCurrentlyCollapsed);
  }

  // Restore saved panel states
  try {
    if (localStorage.getItem('fffx-drawer-collapsed') === 'true') {
      setDrawerOpen(false);
    }
    if (localStorage.getItem('fffx-panel-collapsed') === 'true') {
      setPanelOpen(false);
    }
  } catch {}

  if (toggleDrawerBtn) toggleDrawerBtn.addEventListener('click', toggleDrawer);
  if (togglePanelBtn) togglePanelBtn.addEventListener('click', togglePanel);

  // Save current frame
  function saveCurrentFrame() {
    const activeEffect = getActiveEffect();
    const a = document.createElement('a');
    a.download = `${activeEffect ? activeEffect.id : 'fffx'}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  if (saveBtn) saveBtn.addEventListener('click', saveCurrentFrame);
  if (exportBtn) exportBtn.addEventListener('click', saveCurrentFrame);

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    if (fullscreenBtn) {
      fullscreenBtn.setAttribute(
        'data-tooltip',
        isFs ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'
      );
    }
    if (fsIcon) {
      fsIcon.innerHTML = isFs ? MINIMIZE_SVG : MAXIMIZE_SVG;
    }
  });

  // Cursor Toggle
  function toggleCursor(forceState) {
    env.cursorEnabled =
      forceState !== undefined ? forceState : !env.cursorEnabled;
    if (env.cursorEnabled) {
      if (cursorToggleBtn) {
        cursorToggleBtn.classList.add('active');
        cursorToggleBtn.setAttribute(
          'data-tooltip',
          'Cursor Action: ON (Press M)'
        );
      }
      if (cursorIcon) cursorIcon.innerHTML = MOUSE_ON_SVG;
      if (stage) stage.style.cursor = 'crosshair';
    } else {
      if (cursorToggleBtn) {
        cursorToggleBtn.classList.remove('active');
        cursorToggleBtn.setAttribute(
          'data-tooltip',
          'Cursor Action: OFF (Press M)'
        );
      }
      if (cursorIcon) cursorIcon.innerHTML = MOUSE_OFF_SVG;
      if (stage) stage.style.cursor = 'default';
      env.cursor.isDown = false;
    }
  }

  if (cursorToggleBtn) cursorToggleBtn.addEventListener('click', () => toggleCursor());
  toggleCursor(false);

  // Theme
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.innerHTML = SUN_SVG;
      if (themeBtn) themeBtn.setAttribute('data-tooltip', 'Switch to Light Theme');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIcon) themeIcon.innerHTML = MOON_SVG;
      if (themeBtn) themeBtn.setAttribute('data-tooltip', 'Switch to Dark Theme');
    }
    localStorage.setItem('fffx-theme', theme);
  }

  const savedTheme = localStorage.getItem('fffx-theme') || 'light';
  applyTheme(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  // Reset Confirmation Prompt
  function showResetPrompt() {
    if (!confirmModal) {
      if (typeof resetAllSettings === 'function') resetAllSettings();
      return;
    }
    confirmModal.classList.add('open');
    if (confirmResetBtn) confirmResetBtn.focus();
  }

  function hideResetPrompt() {
    if (confirmModal) {
      confirmModal.classList.remove('open');
    }
  }

  function handleConfirmReset() {
    hideResetPrompt();
    if (typeof resetAllSettings === 'function') {
      resetAllSettings();
    }
  }

  if (confirmResetBtn) confirmResetBtn.addEventListener('click', handleConfirmReset);
  if (cancelResetBtn) cancelResetBtn.addEventListener('click', hideResetPrompt);
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        hideResetPrompt();
      }
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // If confirmation prompt is open, trap keys for prompt actions
    const isPromptOpen = confirmModal && confirmModal.classList.contains('open');
    if (isPromptOpen) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        hideResetPrompt();
        return;
      }
      if (document.activeElement === cancelResetBtn && e.key === 'Enter') {
        e.preventDefault();
        hideResetPrompt();
        return;
      }
      if (
        (e.key === 'Enter' || e.key === 'c' || e.key === 'C') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        handleConfirmReset();
        return;
      }
      // Suppress studio shortcuts while confirmation prompt is open
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveCurrentFrame();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      if (fileInput) fileInput.click();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleCursor();
    } else if (e.key === 'h' || e.key === 'H' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      if (toggleMirrorWebcam) toggleMirrorWebcam();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleDrawer();
    } else if (e.key === ']' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      togglePanel();
    } else if (
      (e.key === 'c' || e.key === 'C') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      showResetPrompt();
    }
  });

  // Pointer Interaction
  function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (env.W / rect.width);
    const y = (clientY - rect.top) * (env.H / rect.height);
    return {
      x: Math.max(0, Math.min(env.W, x)),
      y: Math.max(0, Math.min(env.H, y)),
    };
  }

  function setCursor(clientX, clientY) {
    const pt = getCanvasCoords(clientX, clientY);
    env.cursor.targetX = pt.x;
    env.cursor.targetY = pt.y;
    env.cursor.lastMoveAt = performance.now();
    return pt;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!env.cursorEnabled) return;
    env.cursor.isDown = true;
    const pt = setCursor(e.clientX, e.clientY);
    env.cursor.x = pt.x;
    env.cursor.y = pt.y;
    const activeEffect = getActiveEffect();
    if (activeEffect && activeEffect.onPointerDown) {
      activeEffect.onPointerDown(pt.x, pt.y, e);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!env.cursorEnabled) return;
    if (env.cursor.isDown) {
      env.cursor.isDown = false;
      const activeEffect = getActiveEffect();
      if (activeEffect && activeEffect.onPointerUp) {
        const pt = getCanvasCoords(e.clientX, e.clientY);
        activeEffect.onPointerUp(pt.x, pt.y, e);
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!env.cursorEnabled) return;
    const pt = setCursor(e.clientX, e.clientY);
    const activeEffect = getActiveEffect();
    if (activeEffect && activeEffect.onPointerMove) {
      activeEffect.onPointerMove(pt.x, pt.y, env.cursor.isDown, e);
    }
  });

  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (!env.cursorEnabled) return;
      e.preventDefault();
      env.cursor.isDown = true;
      const touch = e.touches[0];
      const pt = setCursor(touch.clientX, touch.clientY);
      env.cursor.x = pt.x;
      env.cursor.y = pt.y;
      const activeEffect = getActiveEffect();
      if (activeEffect && activeEffect.onPointerDown) {
        activeEffect.onPointerDown(pt.x, pt.y, e);
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (!env.cursorEnabled) return;
      e.preventDefault();
      const touch = e.touches[0];
      const pt = setCursor(touch.clientX, touch.clientY);
      const activeEffect = getActiveEffect();
      if (activeEffect && activeEffect.onPointerMove) {
        activeEffect.onPointerMove(pt.x, pt.y, env.cursor.isDown, e);
      }
    },
    { passive: false }
  );

  window.addEventListener('touchend', (e) => {
    if (!env.cursorEnabled) return;
    if (env.cursor.isDown) {
      env.cursor.isDown = false;
      const activeEffect = getActiveEffect();
      if (activeEffect && activeEffect.onPointerUp) {
        activeEffect.onPointerUp(env.cursor.targetX, env.cursor.targetY, e);
      }
    }
  });

  return {
    saveCurrentFrame,
    toggleFullscreen,
    toggleCursor,
    applyTheme,
    showResetPrompt,
    hideResetPrompt,
  };
}
