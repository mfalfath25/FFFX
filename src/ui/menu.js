/**
 * Left Drawer Menu Controller
 * Renders the effects catalog and sources list.
 */

export function initMenu({ menuEl, effectPill, onSelectEffect }) {
  return {
    render(effects, activeEffect) {
      if (!menuEl) return;
      menuEl.innerHTML = '';
      effects.forEach((effect) => {
        const btn = document.createElement('button');
        const isActive = effect.id === activeEffect.id;
        btn.className = 'drawer-item' + (isActive ? ' active' : '');
        btn.setAttribute('data-effect-id', effect.id);
        btn.innerHTML = `
          <span>${effect.label.toUpperCase()}</span>
          <span class="item-state">${isActive ? '[*]' : '[ ]'}</span>
        `;
        btn.addEventListener('click', () => {
          onSelectEffect(effect);
        });
        menuEl.appendChild(btn);
      });

      if (effectPill) {
        effectPill.textContent = activeEffect.label.toUpperCase();
      }
    },
  };
}

export function updateDrawerSources(activeSourceKey) {
  document.querySelectorAll('#drawerSources .drawer-item').forEach((btn) => {
    const src = btn.getAttribute('data-source');
    const isMatch = src === activeSourceKey;
    btn.classList.toggle('active', isMatch);
    const stateSpan = btn.querySelector('.item-state');
    if (stateSpan) {
      stateSpan.textContent = isMatch ? '[•]' : '[ ]';
    }
  });
}
