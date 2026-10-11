import { globalParameterStore } from '../headless/store.js';
import { globalGroupManager } from '../headless/group.js';

/**
 * Headless Studio Panel Renderer Adapter
 * Renders control groups and interactive controls for the active effect
 * into any DOM target while syncing seamlessly with the reactive store.
 */
export class PanelRenderer {
  constructor(panelEl) {
    this.panelEl = panelEl;
  }

  /**
   * Renders the parameter panel for an active effect
   * @param {Object} activeEffect 
   */
  render(activeEffect) {
    if (!this.panelEl || !activeEffect) return;
    this.panelEl.innerHTML = '';

    const effectId = activeEffect.id;
    const v = globalParameterStore.getEffectValues(effectId);
    const groups = activeEffect.getGroups ? activeEffect.getGroups(v) : activeEffect.groups || [];

    groups.forEach((group, groupIdx) => {
      const groupKey = `${effectId}-${groupIdx}`;
      const isCollapsed = globalGroupManager.isCollapsed(groupKey, false);

      const groupEl = document.createElement('section');
      groupEl.className = 'ascii-group' + (isCollapsed ? ' collapsed' : '');

      const header = document.createElement('button');
      header.className = 'ascii-group-header';
      header.type = 'button';
      header.innerHTML = `
        <span class="group-title">------ ${group.title.toUpperCase()} ------</span>
        <span class="group-toggle">${isCollapsed ? '[+]' : '[-]'}</span>
      `;
      header.addEventListener('click', () => {
        globalGroupManager.toggle(groupKey);
        this.render(activeEffect);
      });
      groupEl.appendChild(header);

      const body = document.createElement('div');
      body.className = 'ascii-group-body';

      group.controls.forEach((c) => {
        const wrap = document.createElement('div');
        wrap.className = 'ctl-row';
        const id = `ctl-${effectId}-${c.key}`;

        // Ensure default value in store
        if (v[c.key] === undefined && c.value !== undefined) {
          globalParameterStore.set(effectId, c.key, c.value, true);
        }

        if (c.type === 'range') {
          wrap.innerHTML = `
            <div class="ctl-header">
              <label class="ctl-label" for="${id}">${c.label.toUpperCase()}</label>
              <output class="ctl-val" id="${id}-out"></output>
            </div>
            <input id="${id}" type="range" class="mono-range" min="${c.min}" max="${c.max}" step="${c.step}">
          `;
          const input = wrap.querySelector('input');
          const out = wrap.querySelector('output');
          input.value = v[c.key];

          const update = (fromUser) => {
            const val = Number(input.value);
            v[c.key] = val;
            globalParameterStore.set(effectId, c.key, val, true);
            out.textContent = `${val}${c.unit || ''}`;
            if (fromUser && typeof c.onChange === 'function') {
              c.onChange(val);
              if (activeEffect.getGroups) this.render(activeEffect);
            }
          };

          input.addEventListener('input', () => update(true));
          update(false);
        } else if (c.type === 'select') {
          wrap.innerHTML = `
            <div class="ctl-header">
              <label class="ctl-label" for="${id}">${String(c.label || '').toUpperCase()}</label>
            </div>
            <select id="${id}" class="mono-select">
              ${(c.options || [])
                .map((opt) => {
                  const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
                  const optLabel = typeof opt === 'object' && opt !== null ? (opt.label ?? opt.name ?? opt.value) : opt;
                  const isSelected = String(optVal) === String(v[c.key]);
                  return `<option value="${optVal}" ${isSelected ? 'selected' : ''}>${String(optLabel).toUpperCase()}</option>`;
                })
                .join('')}
            </select>
          `;
          const sel = wrap.querySelector('select');
          sel.addEventListener('change', () => {
            let parsedVal = sel.value;
            if (
              typeof v[c.key] === 'number' ||
              (c.options &&
                c.options.length > 0 &&
                typeof (typeof c.options[0] === 'object' && c.options[0] !== null
                  ? c.options[0].value
                  : c.options[0]) === 'number')
            ) {
              const num = Number(sel.value);
              if (!isNaN(num)) parsedVal = num;
            }
            v[c.key] = parsedVal;
            globalParameterStore.set(effectId, c.key, parsedVal);
            if (typeof c.onChange === 'function') {
              c.onChange(parsedVal);
            }
            if (activeEffect.getGroups) {
              this.render(activeEffect);
            }
          });
        } else if (c.type === 'color') {
          wrap.innerHTML = `
            <div class="ctl-header">
              <label class="ctl-label" for="${id}">${c.label.toUpperCase()}</label>
              <span class="color-preview" id="${id}-prev" style="background:${v[c.key]}"></span>
            </div>
            <input id="${id}" type="color" class="mono-color" value="${v[c.key]}">
          `;
          const input = wrap.querySelector('input');
          const prev = wrap.querySelector('.color-preview');
          input.addEventListener('input', () => {
            v[c.key] = input.value;
            globalParameterStore.set(effectId, c.key, input.value);
            prev.style.background = input.value;
            if (typeof c.onChange === 'function') {
              c.onChange(input.value);
            }
          });
        } else if (c.type === 'checkbox') {
          wrap.innerHTML = `
            <label class="ctl-checkbox">
              <input id="${id}" type="checkbox" ${v[c.key] ? 'checked' : ''}>
              <span>${c.label.toUpperCase()}</span>
            </label>
          `;
          const cb = wrap.querySelector('input');
          cb.addEventListener('change', () => {
            v[c.key] = cb.checked;
            globalParameterStore.set(effectId, c.key, cb.checked);
            if (typeof c.onChange === 'function') {
              c.onChange(cb.checked);
            }
          });
        } else if (c.type === 'button') {
          wrap.innerHTML = `
            <button class="ctl-btn" id="${id}">${c.label.toUpperCase()}</button>
          `;
          const btn = wrap.querySelector('button');
          btn.addEventListener('click', () => {
            if (typeof c.action === 'function') {
              c.action(v);
            } else if (typeof c.onClick === 'function') {
              c.onClick(v);
            }
          });
        }

        body.appendChild(wrap);
      });

      groupEl.appendChild(body);
      this.panelEl.appendChild(groupEl);
    });
  }
}
