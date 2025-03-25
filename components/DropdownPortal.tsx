import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropdownPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchorRect?: DOMRect | null;
}

const DropdownPortal: React.FC<DropdownPortalProps> = ({ 
  isOpen, 
  onClose, 
  children,
  anchorRect
}) => {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Create portal container when component mounts
    const el = document.createElement('div');
    el.className = 'recording-options-portal';
    document.body.appendChild(el);
    setPortalElement(el);

    // Remove portal container when component unmounts
    return () => {
      if (el && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    };
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
      // Make sure e.target is not null and cast it to Element to use closest()
      const target = e.target as Element;
      if (isOpen && target && !target.closest('.recording-options-content')) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !portalElement) return null;

  // Position the dropdown near the anchor element if provided
  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = 'absolute';
    style.top = `${anchorRect.bottom + window.scrollY + 5}px`;
    style.left = `${anchorRect.left + window.scrollX}px`;
    style.zIndex = 9999;
  }

  return createPortal(
    <div 
      className="recording-options-content"
      style={style}
    >
      {children}
    </div>,
    portalElement
  );
};

export default DropdownPortal; 