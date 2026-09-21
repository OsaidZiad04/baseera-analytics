"use client";
import { forwardRef, type ComponentProps } from 'react';
import { navigate } from '@/lib/baseera/navigation';

// Keep a real href for accessibility, no-JS use, and intentional new-tab clicks.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<'a'>>(function AppLink({ onClick, ...props }, ref) {
  return <a {...props} ref={ref} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.download != null || (props.target && props.target !== '_self')) return;
    const url = new URL(event.currentTarget.href);
    if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)) return;
    event.preventDefault();
    event.stopPropagation();
    // The save barrier displays a workspace error and keeps the user on this page.
    void navigate(url.href).catch(() => {});
  }}/>;
});
export default AppLink;
