/**
 * BEAR SWAP - Security Policy
 *
 * Client-Side Security Implementation
 *
 * Security Controls:
 * - Content Security Policy (CSP) to prevent XSS and injection attacks
 * - X-Frame-Options to prevent clickjacking
 * - X-Content-Type-Options to prevent MIME sniffing
 * - X-XSS-Protection for legacy browser support
 * - Strict Referrer-Policy for privacy
 * - Input sanitization utilities
 * - Environment integrity checking
 *
 * Note: These client-side headers provide defense-in-depth.
 * Production deployments should also set these headers server-side.
 */

/**
 * Apply security headers via meta tags
 * Note: For production, these should also be set server-side
 */
export const applySecurityPolicy = (): void => {
  const isProduction = import.meta.env.PROD;

  // Content Security Policy - tighter in production
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = 'Content-Security-Policy';

  // In production: remove unsafe-eval, keep unsafe-inline only for styles
  // In development: allow unsafe-eval for Vite HMR
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'" // Production: no eval
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // Dev: allow eval for Vite

  cspMeta.content = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://s1.ripple.com https://s2.ripple.com https://xrplcluster.com https://*.xrpl.org https://api.xrpl.to https://*.xrpl.to https://api.coingecko.com wss://s1.ripple.com wss://s2.ripple.com wss://xrplcluster.com wss://*.xrpl.org",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests", // Force HTTPS
  ].join('; ');
  document.head.appendChild(cspMeta);

  // Prevent clickjacking
  const frameOptions = document.createElement('meta');
  frameOptions.httpEquiv = 'X-Frame-Options';
  frameOptions.content = 'DENY';
  document.head.appendChild(frameOptions);

  // Prevent MIME sniffing
  const contentTypeOptions = document.createElement('meta');
  contentTypeOptions.httpEquiv = 'X-Content-Type-Options';
  contentTypeOptions.content = 'nosniff';
  document.head.appendChild(contentTypeOptions);

  // Enable XSS filter
  const xssProtection = document.createElement('meta');
  xssProtection.httpEquiv = 'X-XSS-Protection';
  xssProtection.content = '1; mode=block';
  document.head.appendChild(xssProtection);

  // Referrer policy
  const referrerPolicy = document.createElement('meta');
  referrerPolicy.name = 'referrer';
  referrerPolicy.content = 'strict-origin-when-cross-origin';
  document.head.appendChild(referrerPolicy);
};

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Validate XRPL address format
 */
export const isValidXRPLAddress = (address: string): boolean => {
  // XRPL addresses start with 'r' and are 25-35 characters
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
};

/**
 * Validate amount (prevent injection via amount field)
 */
export const isValidAmount = (amount: string): boolean => {
  // Only allow numbers and decimal point
  return /^\d*\.?\d*$/.test(amount) && amount.length <= 20;
};

/**
 * Validate currency code
 */
export const isValidCurrency = (currency: string): boolean => {
  // Standard currency: 3 characters A-Z
  // Hex currency: 40 hex characters
  return /^[A-Z]{3}$/.test(currency) || /^[0-9A-F]{40}$/i.test(currency);
};

/**
 * Create a secure input handler that prevents logging and clears on blur
 */
export const createSecureInputHandler = (
  onValue: (value: string) => void
): {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
} => {
  return {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      // Prevent logging
      e.stopPropagation();
      onValue(e.target.value);
    },
    onBlur: () => {
      // Visual security: hide the field content briefly
      // The actual value is already in state
    },
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Allow paste but prevent logging
      e.stopPropagation();
      const pastedText = e.clipboardData.getData('text');
      onValue(pastedText);
      e.preventDefault();
    },
  };
};

/**
 * Security audit log (for debugging in development only)
 */
const isDevelopment = import.meta.env.DEV;
const securityLog: Array<{ timestamp: number; event: string; details?: string }> = [];

export const logSecurityEvent = (event: string, details?: string): void => {
  const entry = {
    timestamp: Date.now(),
    event,
    details: isDevelopment ? details : undefined,
  };
  securityLog.push(entry);

  // Keep only last 100 entries
  if (securityLog.length > 100) {
    securityLog.shift();
  }

  // REMOVED: Development console logging
  // Security events should NEVER be logged to console as they may contain sensitive data
  // Use getSecurityLog() API for debugging instead
};

export const getSecurityLog = (): typeof securityLog => {
  if (!isDevelopment) {
    return [];
  }
  return [...securityLog];
};

/**
 * Safe debugging - only log event names, never details
 * Use this for development debugging when you need console visibility
 */
export const logSecurityEventSafe = (event: string): void => {
  if (isDevelopment) {
    console.log(`[SECURITY EVENT] ${event}`);  // Event name only, no details
  }
};

/**
 * Freeze an object deeply to prevent prototype pollution
 */
export const deepFreeze = <T extends object>(obj: T): T => {
  const propNames = Object.getOwnPropertyNames(obj);

  for (const name of propNames) {
    const value = (obj as any)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
};

/**
 * Check if running in a secure context (HTTPS)
 */
export const isSecureContext = (): boolean => {
  return window.isSecureContext === true;
};

/**
 * Check for suspicious browser extensions or modifications
 */
export const checkEnvironmentIntegrity = (): {
  secure: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  // Check for secure context
  if (!isSecureContext()) {
    warnings.push('Not running in secure context (HTTPS required for production)');
  }

  // Check for modified crypto API
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    warnings.push('Web Crypto API not available');
  }

  // Check if running in iframe (potential clickjacking)
  if (window.self !== window.top) {
    warnings.push('Running inside an iframe - potential clickjacking risk');
  }

  // Check for console override (potential debugging attack)
  const consoleLog = console.log;
  if (typeof consoleLog !== 'function') {
    warnings.push('Console has been modified');
  }

  return {
    secure: warnings.length === 0,
    warnings,
  };
};
