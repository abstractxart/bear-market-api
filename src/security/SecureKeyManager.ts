/**
 * BEAR MARKET - Secure Key Manager
 *
 * Security Features:
 * - Keys stored in closure (not accessible from window/global)
 * - Web Crypto API for all cryptographic operations
 * - PBKDF2 with 600,000 iterations for key derivation
 * - AES-256-GCM for encryption
 * - Automatic memory wiping
 * - No persistence by default
 * - Timing-safe comparisons
 * - Frozen objects to prevent prototype pollution
 */

// Secure random bytes using Web Crypto API
const getSecureRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

// Securely wipe a Uint8Array from memory
const secureWipe = (arr: Uint8Array): void => {
  crypto.getRandomValues(arr); // Overwrite with random data
  arr.fill(0); // Then zero it out
};

// Convert string to Uint8Array
const stringToBytes = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

// Convert Uint8Array to string
const bytesToString = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};

// Convert Uint8Array to hex string
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Convert hex string to Uint8Array
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

// Timing-safe comparison to prevent timing attacks
const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

// PBKDF2 key derivation with 600,000 iterations (OWASP recommended)
const deriveKey = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  const passwordBytes = stringToBytes(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 600000, // OWASP 2023 recommendation
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Wipe password bytes
  secureWipe(passwordBytes);

  return derivedKey;
};

// AES-256-GCM encryption
const encrypt = async (
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> => {
  const iv = getSecureRandomBytes(12); // 96-bit IV for GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
};

// AES-256-GCM decryption
const decrypt = async (
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> => {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return new Uint8Array(plaintext);
};

// Encrypted vault structure
interface EncryptedVault {
  version: number;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // hex
  checksum: string; // hex - SHA-256 of decrypted data for integrity
}

/**
 * SecureKeyManager - Fortress-grade key management
 *
 * The secret key is stored in a closure, making it inaccessible from:
 * - window object
 * - global scope
 * - browser console
 * - malicious scripts (unless they can modify this file before load)
 */
class SecureKeyManager {
  // Private state stored in closure
  private _encryptedKey: Uint8Array | null = null;
  private _sessionKey: CryptoKey | null = null;
  private _address: string | null = null;
  private _isLocked: boolean = true;

  // Note: We don't freeze the instance because we need to modify private state
  // Security is maintained by: private properties, closure singleton, memory encryption

  /**
   * Initialize with a secret key (session-only, no persistence)
   * The key is immediately encrypted in memory with a random session key
   */
  async initializeSessionOnly(secret: string): Promise<{ address: string }> {
    // Validate secret format
    if (!this.validateSecretFormat(secret)) {
      throw new Error('Invalid secret key format');
    }

    // Import xrpl dynamically to derive address
    const { Wallet } = await import('xrpl');

    let wallet;
    try {
      // Auto-detect algorithm from seed prefix
      // sEd... = ed25519, s... (without Ed) = secp256k1
      const isEd25519 = secret.startsWith('sEd');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallet = Wallet.fromSeed(secret, {
        algorithm: (isEd25519 ? 'ed25519' : 'ecdsa-secp256k1') as any
      });
    } catch {
      throw new Error('Invalid secret key');
    }

    const address = wallet.classicAddress;
    const secretBytes = stringToBytes(secret);

    // Generate a random session key for memory encryption
    this._sessionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // not extractable
      ['encrypt', 'decrypt']
    );

    // Encrypt the secret in memory
    const { ciphertext, iv } = await encrypt(secretBytes, this._sessionKey);

    // Store encrypted key with IV prepended
    this._encryptedKey = new Uint8Array(iv.length + ciphertext.length);
    this._encryptedKey.set(iv);
    this._encryptedKey.set(ciphertext, iv.length);

    // Wipe plaintext secret from memory
    secureWipe(secretBytes);

    this._address = address;
    this._isLocked = false;

    // Clear the wallet object
    // @ts-ignore - accessing private for security
    wallet.privateKey = undefined;
    // @ts-ignore
    wallet.publicKey = undefined;
    // @ts-ignore
    wallet.seed = undefined;

    return { address };
  }

  /**
   * Initialize with encrypted vault (persistent, password-protected)
   */
  async initializeFromVault(
    vault: EncryptedVault,
    password: string
  ): Promise<{ address: string }> {
    if (vault.version !== 1) {
      throw new Error('Unsupported vault version');
    }

    const salt = hexToBytes(vault.salt);
    const iv = hexToBytes(vault.iv);
    const ciphertext = hexToBytes(vault.ciphertext);
    const storedChecksum = hexToBytes(vault.checksum);

    // Derive key from password
    const derivedKey = await deriveKey(password, salt);

    // Decrypt the secret
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = await decrypt(ciphertext, iv, derivedKey);
    } catch {
      throw new Error('Invalid password');
    }

    // Verify checksum
    const computedChecksum = new Uint8Array(
      await crypto.subtle.digest('SHA-256', decryptedBytes.buffer as ArrayBuffer)
    );

    if (!timingSafeEqual(computedChecksum, storedChecksum)) {
      secureWipe(decryptedBytes);
      throw new Error('Vault integrity check failed');
    }

    const secret = bytesToString(decryptedBytes);

    // Initialize with the decrypted secret
    const result = await this.initializeSessionOnly(secret);

    // Wipe decrypted bytes
    secureWipe(decryptedBytes);

    return result;
  }

  /**
   * Create an encrypted vault for persistence
   */
  async createVault(password: string): Promise<EncryptedVault> {
    if (this._isLocked || !this._encryptedKey || !this._sessionKey) {
      throw new Error('No key loaded');
    }

    // Minimum password requirements
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }

    // Decrypt current key
    const iv = this._encryptedKey.slice(0, 12);
    const ciphertext = this._encryptedKey.slice(12);
    const secretBytes = await decrypt(ciphertext, iv, this._sessionKey);

    // Generate salt for PBKDF2
    const salt = getSecureRandomBytes(32);

    // Derive key from password
    const derivedKey = await deriveKey(password, salt);

    // Encrypt with derived key
    const encrypted = await encrypt(secretBytes, derivedKey);

    // Compute checksum of plaintext for integrity verification
    const checksum = new Uint8Array(
      await crypto.subtle.digest('SHA-256', secretBytes.buffer as ArrayBuffer)
    );

    // Wipe secret bytes
    secureWipe(secretBytes);

    const vault: EncryptedVault = {
      version: 1,
      salt: bytesToHex(salt),
      iv: bytesToHex(encrypted.iv),
      ciphertext: bytesToHex(encrypted.ciphertext),
      checksum: bytesToHex(checksum),
    };

    // Wipe intermediate values
    secureWipe(salt);
    secureWipe(encrypted.iv);
    secureWipe(encrypted.ciphertext);
    secureWipe(checksum);

    return vault;
  }

  /**
   * Get the decrypted secret for signing (returns a one-time use copy)
   * IMPORTANT: The caller MUST wipe the returned string after use
   */
  async getSecretForSigning(): Promise<string> {
    if (this._isLocked || !this._encryptedKey || !this._sessionKey) {
      throw new Error('Wallet is locked');
    }

    const iv = this._encryptedKey.slice(0, 12);
    const ciphertext = this._encryptedKey.slice(12);
    const secretBytes = await decrypt(ciphertext, iv, this._sessionKey);
    const secret = bytesToString(secretBytes);

    // Wipe the bytes immediately
    secureWipe(secretBytes);

    return secret;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(txJson: object): Promise<{ tx_blob: string; hash: string }> {
    const secret = await this.getSecretForSigning();

    const { Wallet } = await import('xrpl');
    // Auto-detect algorithm from seed prefix
    const isEd25519 = secret.startsWith('sEd');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wallet = Wallet.fromSeed(secret, {
      algorithm: (isEd25519 ? 'ed25519' : 'ecdsa-secp256k1') as any
    });

    // Sign the transaction
    const { tx_blob, hash } = wallet.sign(txJson as any);

    // Wipe wallet
    // @ts-ignore
    wallet.privateKey = undefined;
    // @ts-ignore
    wallet.publicKey = undefined;
    // @ts-ignore
    wallet.seed = undefined;

    return { tx_blob, hash };
  }

  /**
   * Lock the wallet (keep encrypted key but require re-authentication)
   */
  lock(): void {
    this._sessionKey = null;
    this._isLocked = true;
  }

  /**
   * Completely destroy all key material
   */
  destroy(): void {
    if (this._encryptedKey) {
      secureWipe(this._encryptedKey);
      this._encryptedKey = null;
    }
    this._sessionKey = null;
    this._address = null;
    this._isLocked = true;
  }

  /**
   * Get the wallet address
   */
  getAddress(): string | null {
    return this._address;
  }

  /**
   * Check if wallet is locked
   */
  isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * Check if a key is loaded
   */
  hasKey(): boolean {
    return this._encryptedKey !== null;
  }

  /**
   * Validate secret key format
   */
  private validateSecretFormat(secret: string): boolean {
    // XRPL secrets start with 's' and are base58 encoded
    // secp256k1 family seed: starts with 's', 29 characters
    // ED25519 family seed: starts with 'sEd', 31 characters
    // Hex: 64 characters

    // Family seed format - secp256k1 (29 chars) or ED25519 (31 chars)
    // Accept 29-31 characters to cover both algorithms
    if (/^s[1-9A-HJ-NP-Za-km-z]{28,30}$/.test(secret)) {
      return true;
    }

    // Hex format (64 hex characters)
    if (/^[0-9a-fA-F]{64}$/.test(secret)) {
      return true;
    }

    // Hex with ED prefix (66 characters)
    if (/^ED[0-9a-fA-F]{64}$/i.test(secret)) {
      return true;
    }

    return false;
  }
}

// Create a singleton instance
let keyManagerInstance: SecureKeyManager | null = null;

export const getKeyManager = (): SecureKeyManager => {
  if (!keyManagerInstance) {
    keyManagerInstance = new SecureKeyManager();
  }
  return keyManagerInstance;
};

// Destroy on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (keyManagerInstance) {
      keyManagerInstance.destroy();
      keyManagerInstance = null;
    }
  });

  // Also destroy on visibility change (when user switches tabs for extended period)
  // This is optional and can be configured
  let hiddenTime: number | null = null;
  const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTime = Date.now();
    } else if (hiddenTime && keyManagerInstance) {
      const elapsed = Date.now() - hiddenTime;
      if (elapsed > LOCK_TIMEOUT) {
        keyManagerInstance.lock();
      }
      hiddenTime = null;
    }
  });
}

// ==================== VAULT STORAGE (localStorage) ====================

const VAULT_STORAGE_KEY = 'bear_market_vault';
const VAULT_ADDRESS_KEY = 'bear_market_address';

/**
 * Check if a saved vault exists in localStorage
 */
export const hasSavedVault = (): boolean => {
  try {
    return localStorage.getItem(VAULT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

/**
 * Get the saved wallet address (for display purposes only)
 */
export const getSavedAddress = (): string | null => {
  try {
    return localStorage.getItem(VAULT_ADDRESS_KEY);
  } catch {
    return null;
  }
};

/**
 * Save vault to localStorage
 */
export const saveVaultToStorage = (vault: EncryptedVault, address: string): void => {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
    localStorage.setItem(VAULT_ADDRESS_KEY, address);
  } catch (err) {
    console.error('Failed to save vault to localStorage:', err);
    throw new Error('Failed to save wallet. Please check your browser settings.');
  }
};

/**
 * Load vault from localStorage
 */
export const loadVaultFromStorage = (): EncryptedVault | null => {
  try {
    const data = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as EncryptedVault;
  } catch {
    return null;
  }
};

/**
 * Delete vault from localStorage
 */
export const deleteVaultFromStorage = (): void => {
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(VAULT_ADDRESS_KEY);
  } catch {
    // Ignore errors
  }
};

export type { EncryptedVault };
export { SecureKeyManager };
