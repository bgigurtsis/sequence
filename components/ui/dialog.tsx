import React, { ReactNode, createContext, useContext, useState, HTMLAttributes } from 'react';

// Create a context to manage dialog state
const DialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

interface DialogProps {
  children: ReactNode;
}

export function Dialog({ children }: DialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { setOpen } = useContext(DialogContext);
  
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        // Safely access props.onClick if it exists
        if (typeof children.props.onClick === 'function') {
          children.props.onClick(e);
        }
        setOpen(true);
      },
    });
  }
  
  return (
    <button onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className = '', ...props }: DialogContentProps) {
  const { open, setOpen } = useContext(DialogContext);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div 
        className={`bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[85vh] overflow-auto ${className}`}
        {...props}
      >
        <div className="flex justify-end">
          <button 
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-semibold">{children}</h2>;
}

export function Button({ 
  children, 
  variant = 'default', 
  size = 'default',
  onClick,
  disabled
}: { 
  children: ReactNode;
  variant?: 'default' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 text-gray-800 hover:bg-gray-50',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  
  const sizeClasses = {
    default: 'px-4 py-2',
    sm: 'px-3 py-1 text-sm',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantClasses[variant]} 
        ${sizeClasses[size]} 
        rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
} 