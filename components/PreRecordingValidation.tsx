import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { validateAllTokensWithRetry } from '@/lib/sessionUtils';

interface PreRecordingValidationProps {
  onValidationComplete: (isValid: boolean) => void;
}

/**
 * Component that runs a session validation check before starting a recording
 * This helps prevent session-related errors during the recording process
 */
const PreRecordingValidation: React.FC<PreRecordingValidationProps> = ({ 
  onValidationComplete
}) => {
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Run validation on component mount
  useEffect(() => {
    const validateSession = async () => {
      setValidationStatus('checking');
      setError(null);
      
      try {
        // Use our global validation function with retries
        const isValid = await validateAllTokensWithRetry(3);
        
        if (isValid) {
          setValidationStatus('valid');
          onValidationComplete(true);
        } else {
          setValidationStatus('invalid');
          setError('Your session could not be validated. Please refresh the page and try again.');
          onValidationComplete(false);
        }
      } catch (error) {
        console.error('Error during pre-recording validation:', error);
        setValidationStatus('invalid');
        setError('An error occurred while validating your session. Please refresh the page and try again.');
        onValidationComplete(false);
      }
    };
    
    validateSession();
  }, [onValidationComplete]);
  
  // Manual retry function
  const handleRetry = async () => {
    setValidationStatus('checking');
    setError(null);
    
    try {
      // Use our global validation function with retries
      const isValid = await validateAllTokensWithRetry(3);
      
      if (isValid) {
        setValidationStatus('valid');
        onValidationComplete(true);
      } else {
        setValidationStatus('invalid');
        setError('Your session still could not be validated. Please try refreshing the page.');
        onValidationComplete(false);
      }
    } catch (error) {
      console.error('Error during validation retry:', error);
      setValidationStatus('invalid');
      setError('An error occurred during retry. Please refresh the page.');
      onValidationComplete(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg shadow-sm">
      {validationStatus === 'checking' && (
        <div className="flex flex-col items-center space-y-2 py-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-600">Validating your session...</p>
        </div>
      )}
      
      {validationStatus === 'valid' && (
        <div className="flex flex-col items-center space-y-2 py-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <p className="text-sm text-green-600">Session validated successfully!</p>
        </div>
      )}
      
      {validationStatus === 'invalid' && (
        <div className="flex flex-col items-center space-y-4 py-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <p className="text-sm text-red-600 text-center">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-md flex items-center space-x-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Validation</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PreRecordingValidation; 