// ============================================
// XRPL Currency Code Utilities
// ============================================

/**
 * Convert a hex-encoded currency code to human-readable string
 * XRPL uses 40-character hex for currencies longer than 3 characters
 */
export function hexToString(hex: string): string {
  if (!hex || hex.length !== 40) return hex;

  // Convert hex to bytes, then to string, removing null padding
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    if (charCode === 0) break; // Stop at null terminator
    str += String.fromCharCode(charCode);
  }
  return str;
}

/**
 * Convert a human-readable currency code to hex format
 * Used for currencies longer than 3 characters on XRPL
 */
export function stringToHex(str: string): string {
  if (!str || str.length <= 3) return str;

  // Convert to hex and pad to 40 characters
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.toUpperCase().padEnd(40, '0');
}

/**
 * Check if a currency code is in hex format (40 hex characters)
 */
export function isHexCurrency(currency: string): boolean {
  return currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency);
}

/**
 * Normalize a currency code to human-readable format
 */
export function normalizeCurrency(currency: string): string {
  if (isHexCurrency(currency)) {
    return hexToString(currency);
  }
  return currency;
}

/**
 * Compare two currency codes, handling both hex and human-readable formats
 * Returns true if they represent the same currency
 */
export function currencyEquals(a: string, b: string): boolean {
  if (a === b) return true;

  // Normalize both to human-readable and compare
  const normalizedA = normalizeCurrency(a);
  const normalizedB = normalizeCurrency(b);

  return normalizedA === normalizedB;
}

/**
 * Find a token balance that matches the given currency and issuer
 * Handles currency code format differences (hex vs human-readable)
 */
export function findTokenBalance(
  tokens: Array<{ token: { currency: string; issuer?: string }; balance: string }>,
  currency: string,
  issuer?: string
): { token: { currency: string; issuer?: string }; balance: string } | undefined {
  return tokens.find(t => {
    // Compare currencies (handling hex encoding)
    if (!currencyEquals(t.token.currency, currency)) {
      return false;
    }

    // Compare issuers (must match exactly, or both be undefined for XRP)
    if (issuer === undefined && t.token.issuer === undefined) return true;
    return t.token.issuer === issuer;
  });
}
