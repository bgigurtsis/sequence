import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DropdownPortalProps {
  children: ReactNode;
  targetRect?: DOMRect | null;
}

export default function DropdownPortal({ children, targetRect }: DropdownPortalProps) {
  // Only render in the browser, not during SSR
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Create a portal to render the dropdown at the root level
  return createPortal(
    <div 
      style={{
        position: 'absolute',
        top: targetRect ? targetRect.bottom + window.scrollY : 0,
        left: targetRect ? targetRect.left + window.scrollX : 0,
        zIndex: 50,
      }}
    >
      {children}
    </div>,
    document.body
  );
} 