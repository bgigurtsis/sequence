import React, { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}

export function Alert({ children, variant = 'default', className = '' }: AlertProps) {
  const variantStyles = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800',
  };
  
  return (
    <div className={`p-4 border rounded-md ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}

export function AlertTitle({ children }: { children: ReactNode }) {
  return <h5 className="font-medium mb-1">{children}</h5>;
}

export function AlertDescription({ children }: { children: ReactNode }) {
  return <div className="text-sm">{children}</div>;
} 