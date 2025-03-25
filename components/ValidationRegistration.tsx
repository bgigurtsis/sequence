'use client';

import { useEffect } from 'react';
import { registerGlobalValidationFunctions } from '@/lib/sessionUtils';

export default function ValidationRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      registerGlobalValidationFunctions();
    }
  }, []);

  // This component doesn't render anything
  return null;
} 