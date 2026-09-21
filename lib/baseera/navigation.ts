// Full document navigation avoids the hosted RSC client-navigation failure.
// The workspace registers a durable save barrier before leaving the document.
let saveBeforeLeave: (() => Promise<void>) | null = null;
let navigating = false;
export function registerNavigationSave(save: () => Promise<void>) {
  saveBeforeLeave = save;
  return () => { if (saveBeforeLeave === save) saveBeforeLeave = null; };
}
export async function navigate(href: string, replace = false) {
  if (navigating) return;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) throw new Error('Only same-origin navigation is supported');
  navigating = true;
  try {
    await saveBeforeLeave?.();
    if (replace) window.location.replace(url.href);
    else window.location.assign(url.href);
  } finally { navigating = false; }
}
