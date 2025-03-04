// hooks/usePerformances.ts
// Helper hook to access the PerformanceContext

import { useContext } from 'react';
import { PerformanceContext } from '../contexts/PerformanceContext';

export const usePerformances = () => useContext(PerformanceContext); 