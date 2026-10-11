/**
 * Headless Control Component Descriptors
 * Pure models for UI controls without DOM assumptions.
 */

export const ControlType = {
  RANGE: 'range',
  SELECT: 'select',
  COLOR: 'color',
  CHECKBOX: 'checkbox',
  BUTTON: 'button',
};

/**
 * Creates a headless range (slider) control descriptor
 */
export function createRangeControl({
  key,
  label,
  min = 0,
  max = 100,
  step = 1,
  value = 0,
  unit = '',
  onChange = null,
}) {
  return {
    type: ControlType.RANGE,
    key,
    label,
    min,
    max,
    step,
    value,
    unit,
    onChange,
    format(val) {
      return `${val}${unit || ''}`;
    },
    clamp(val) {
      const num = Number(val);
      if (isNaN(num)) return min;
      return Math.min(max, Math.max(min, num));
    },
  };
}

/**
 * Creates a headless dropdown select control descriptor
 */
export function createSelectControl({
  key,
  label,
  options = [],
  value = null,
  onChange = null,
}) {
  const initial = value !== null ? value : options[0] || '';
  return {
    type: ControlType.SELECT,
    key,
    label,
    options,
    value: initial,
    onChange,
    isValid(val) {
      return options.includes(val);
    },
  };
}

/**
 * Creates a headless color picker control descriptor
 */
export function createColorControl({
  key,
  label,
  value = '#ffffff',
  onChange = null,
}) {
  return {
    type: ControlType.COLOR,
    key,
    label,
    value,
    onChange,
  };
}

/**
 * Creates a headless boolean checkbox control descriptor
 */
export function createCheckboxControl({
  key,
  label,
  value = false,
  onChange = null,
}) {
  return {
    type: ControlType.CHECKBOX,
    key,
    label,
    value: Boolean(value),
    onChange,
  };
}

/**
 * Creates a headless trigger button control descriptor
 */
export function createButtonControl({
  key,
  label,
  action,
  onClick = null,
}) {
  return {
    type: ControlType.BUTTON,
    key,
    label,
    action: action || onClick,
  };
}
