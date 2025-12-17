/**
 * Helper function to check if error is a decode error (expected when contracts aren't initialized)
 * These errors are normal and shouldn't be logged as errors
 */
function isDecodeError(error) {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code;
  const shortMessage = error.shortMessage;
  
  return (
    errorMessage.includes('could not decode result data') ||
    errorCode === 'BAD_DATA' ||
    shortMessage === 'could not decode result data' ||
    errorMessage.includes('BAD_DATA')
  );
}

/**
 * Log error only if it's not a decode error
 * Decode errors are expected when contracts aren't initialized
 */
function logErrorIfNotDecode(context, error) {
  if (!isDecodeError(error)) {
    console.error(`Error ${context}:`, error);
  }
  // Decode errors are silently handled - they're expected
}

module.exports = {
  isDecodeError,
  logErrorIfNotDecode
};

