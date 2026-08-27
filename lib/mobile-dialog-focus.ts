export const MOBILE_DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getDialogFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(MOBILE_DIALOG_FOCUSABLE_SELECTOR)
  ).filter((element) => !element.hasAttribute('hidden'));
}

export function trapDialogTabKey(
  event: KeyboardEvent,
  container: HTMLElement | null
) {
  if (event.key !== 'Tab' || !container) return false;

  const focusable = getDialogFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
