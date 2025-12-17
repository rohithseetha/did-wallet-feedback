const ethers = require('ethers');

/**
 * Get gas settings for a transaction
 * Handles different networks and provides proper gas estimation
 */
async function getGasSettings(provider, network = null) {
  try {
    const networkName = network || process.env.NETWORK || 'localhost';
    
    // Get fee data from provider
    const feeData = await provider.getFeeData();
    
    // For Fuji and Avalanche, use explicit gas price from config if available
    if (networkName === 'fuji' || networkName === 'avalanche') {
      // For Fuji testnet, use 25 gwei (more reasonable than 225 gwei)
      // For Avalanche mainnet, use 30 gwei
      const baseGasPrice = networkName === 'fuji' 
        ? ethers.parseUnits('25', 'gwei')  // 25 gwei for Fuji testnet
        : ethers.parseUnits('30', 'gwei');  // 30 gwei for Avalanche mainnet
      
      const minGasPrice = ethers.parseUnits('1', 'gwei'); // Minimum 1 gwei
      
      // For EIP-1559 networks, use maxFeePerGas and maxPriorityFeePerGas
      // Use network suggested value if it's reasonable (>= 1 gwei), otherwise use baseGasPrice
      let maxFeePerGas = baseGasPrice;
      if (feeData.maxFeePerGas && feeData.maxFeePerGas >= minGasPrice && feeData.maxFeePerGas <= baseGasPrice * 2n) {
        // Use network value if it's reasonable (between 1 gwei and 2x base)
        maxFeePerGas = feeData.maxFeePerGas;
      }
      
      // Use 1 gwei for priority fee (or provider value if reasonable)
      let maxPriorityFeePerGas = ethers.parseUnits('1', 'gwei');
      if (feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas >= minGasPrice) {
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      }
      
      // IMPORTANT: Only return EIP-1559 fields, NEVER include gasPrice
      return {
        maxFeePerGas,
        maxPriorityFeePerGas
        // DO NOT include gasPrice - it conflicts with EIP-1559
      };
    }
    
    // For localhost/hardhat, use legacy gasPrice
    if (networkName === 'localhost' || networkName === 'hardhat') {
      return {
        gasPrice: feeData.gasPrice || ethers.parseUnits('20', 'gwei')
      };
    }
    
    // For other networks, use provider fee data (EIP-1559)
    if (feeData.maxFeePerGas) {
      return {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei')
      };
    }
    
    // Fallback to legacy gasPrice
    return {
      gasPrice: feeData.gasPrice || ethers.parseUnits('20', 'gwei')
    };
  } catch (error) {
    // Fallback to default gas price
    const defaultGasPrice = ethers.parseUnits('20', 'gwei');
    return {
      gasPrice: defaultGasPrice
    };
  }
}

/**
 * Estimate gas for a transaction with proper error handling
 */
async function estimateGasWithFallback(contract, method, params, gasLimit = null) {
  try {
    // Try to estimate gas
    const estimatedGas = await contract[method].estimateGas(...params);
    // Add 20% buffer
    return estimatedGas * 120n / 100n;
  } catch (error) {
    // If estimation fails, use provided gas limit or default
    if (gasLimit) {
      return BigInt(gasLimit);
    }
    
    // Default gas limits based on operation type
    const methodName = method.toLowerCase();
    if (methodName.includes('mint') || methodName.includes('batch')) {
      return 500000n; // Higher for batch operations
    }
    if (methodName.includes('transfer') || methodName.includes('approve')) {
      return 100000n;
    }
    return 200000n; // Default
  }
}

/**
 * Check if error is an AccessControl error
 */
function isAccessControlError(error) {
  if (!error) return false;
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code;
  const data = error.data || error.reason;
  
  // Check for AccessControl error signatures
  return (
    errorMessage.includes('AccessControl') ||
    errorMessage.includes('missing role') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('account is missing role') ||
    errorCode === '0xe2517d3f' || // AccessControl error selector
    (data && typeof data === 'string' && data.includes('0xe2517d3f'))
  );
}

/**
 * Get human-readable error message
 */
function getErrorMessage(error) {
  if (!error) return 'Unknown error';
  
  if (isAccessControlError(error)) {
    return 'Access denied: Missing required role (MINTER_ROLE, ADMIN_ROLE, etc.)';
  }
  
  const errorMessage = error.message || error.toString() || '';
  
  // Check for common error patterns
  if (errorMessage.includes('insufficient funds')) {
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return `Insufficient funds: ${errorMessage}`;
    }
    return 'Insufficient funds for transaction (check AVAX balance)';
  }
  
  if (errorMessage.includes('insufficient balance')) {
    return 'Insufficient token balance';
  }
  
  if (errorMessage.includes('execution reverted') || errorMessage.includes('reverted')) {
    // Try to decode the revert reason from error data
    if (error.data) {
      try {
        // Common error signatures
        const commonErrors = [
          // ERC1155 errors
          { signature: '0x00fdd58e', name: 'ERC1155: insufficient balance' },
          { signature: '0xf23a6e61', name: 'ERC1155: transfer to non-ERC1155Receiver implementer' },
          { signature: '0x4e2312e1', name: 'ERC1155: insufficient balance for transfer' },
          // AccessControl errors
          { signature: '0xe2517d3f', name: 'AccessControl: account is missing role' },
          // Custom contract errors
          { signature: '0x', name: 'Custom error' }
        ];
        
        // Check if error data matches any known signature
        if (typeof error.data === 'string' && error.data.startsWith('0x')) {
          for (const err of commonErrors) {
            if (error.data.startsWith(err.signature)) {
              return `Transaction reverted: ${err.name}`;
            }
          }
        }
      } catch (e) {
        // Ignore decode errors
      }
    }
    
    // Try to extract revert reason from error message - handle various formats
    // Format 1: "execution reverted: reason"
    let revertMatch = errorMessage.match(/execution reverted:?\s*"?([^"()]+)"?/);
    if (!revertMatch) {
      // Format 2: "reverted (reason)"
      revertMatch = errorMessage.match(/reverted\s*\(([^)]+)\)/);
    }
    if (!revertMatch) {
      // Format 3: "reverted: reason"
      revertMatch = errorMessage.match(/reverted:?\s*"?([^"()]+)"?/);
    }
    if (!revertMatch) {
      // Format 4: Look for common revert reasons in the message
      const commonReasons = [
        'ERC1155: insufficient balance',
        'ERC1155: caller is not token owner or approved',
        'ERC1155: transfer to non-ERC1155Receiver implementer',
        'Insufficient CENT balance',
        'No active stake',
        'Cooldown period not started',
        'Cooldown period not completed',
        'Not following',
        'Max supply already set',
        'Contract is paused',
        'Cannot mint to zero address',
        'Amount must be greater than 0',
        'Exceeds max supply'
      ];
      for (const reason of commonReasons) {
        if (errorMessage.toLowerCase().includes(reason.toLowerCase())) {
          return `Transaction reverted: ${reason}`;
        }
      }
    }
    if (revertMatch && revertMatch[1]) {
      const reason = revertMatch[1].trim();
      // If reason is too short or looks incomplete, try to get more context
      if (reason.length < 5) {
        // Try to get more from the error object
        if (error.reason) return `Transaction reverted: ${error.reason}`;
        if (error.data) return `Transaction reverted: ${error.data}`;
      }
      return `Transaction reverted: ${reason}`;
    }
    // If we have error.reason or error.data, use that
    if (error.reason) return `Transaction reverted: ${error.reason}`;
    if (error.data && typeof error.data === 'string') {
      return `Transaction reverted: ${error.data.substring(0, 100)}`;
    }
    
    // Provide more helpful message based on context
    if (errorMessage.includes('action=')) {
      return 'Transaction reverted: Contract state condition not met (check balance, approvals, or roles)';
    }
    
    return 'Transaction reverted (check contract state and permissions)';
  }
  
  return errorMessage;
}

module.exports = {
  getGasSettings,
  estimateGasWithFallback,
  isAccessControlError,
  getErrorMessage
};

