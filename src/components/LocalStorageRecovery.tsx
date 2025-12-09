import { useState } from 'react';
import { Wallet } from 'xrpl';

// Encrypted vault structure (same as SecureKeyManager)
interface EncryptedVault {
  version: number;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // hex
  checksum: string; // hex - SHA-256 of decrypted data for integrity
}

// Convert string to Uint8Array
const stringToBytes = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

// Convert Uint8Array to string
const bytesToString = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};

// Convert hex string to Uint8Array
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
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

// PBKDF2 key derivation with 600,000 iterations (same as SecureKeyManager)
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

  return derivedKey;
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

export const LocalStorageRecovery: React.FC = () => {
  const [foundWallets, setFoundWallets] = useState<Array<{ key: string; data: any }>>([]);
  const [password, setPassword] = useState('');
  const [decryptedWallet, setDecryptedWallet] = useState<{ address: string; seed?: string; mnemonic?: string } | null>(null);
  const [error, setError] = useState('');
  const [selectedWalletKey, setSelectedWalletKey] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const scanLocalStorage = () => {
    setFoundWallets([]);
    setError('');

    const wallets: Array<{ key: string; data: any }> = [];

    // Scan all localStorage keys for wallet data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('wallet') ||
        key.includes('bear') ||
        key.includes('encrypted') ||
        key.includes('seed') ||
        key.includes('mnemonic')
      )) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            // Try to parse as JSON
            try {
              const parsed = JSON.parse(value);
              wallets.push({ key, data: parsed });
            } catch {
              // Not JSON, store as string
              wallets.push({ key, data: value });
            }
          }
        } catch (e) {
          console.error(`Error reading ${key}:`, e);
        }
      }
    }

    if (wallets.length === 0) {
      setError('No wallet data found in localStorage. The wallet may have been cleared, or you may be using a different browser/computer than when you created the wallet.');
    } else {
      setFoundWallets(wallets);
    }
  };

  const attemptDecryption = async (walletKey: string) => {
    setError('');
    setDecryptedWallet(null);
    setIsDecrypting(true);

    if (!password) {
      setError('Please enter your password');
      setIsDecrypting(false);
      return;
    }

    const wallet = foundWallets.find(w => w.key === walletKey);
    if (!wallet) {
      setError('Wallet data not found');
      setIsDecrypting(false);
      return;
    }

    try {
      // Check if data matches EncryptedVault structure
      if (
        wallet.data &&
        typeof wallet.data === 'object' &&
        wallet.data.version !== undefined &&
        wallet.data.salt &&
        wallet.data.iv &&
        wallet.data.ciphertext &&
        wallet.data.checksum
      ) {
        const vault: EncryptedVault = wallet.data;

        // Convert hex strings to Uint8Arrays
        const salt = hexToBytes(vault.salt);
        const iv = hexToBytes(vault.iv);
        const ciphertext = hexToBytes(vault.ciphertext);
        const storedChecksum = hexToBytes(vault.checksum);

        // Derive key from password
        const derivedKey = await deriveKey(password, salt);

        // Decrypt
        const decryptedBytes = await decrypt(ciphertext, iv, derivedKey);

        // Verify checksum
        const computedChecksum = new Uint8Array(
          await crypto.subtle.digest('SHA-256', decryptedBytes.buffer as ArrayBuffer)
        );

        if (!timingSafeEqual(computedChecksum, storedChecksum)) {
          setError('Incorrect password or corrupted vault');
          setIsDecrypting(false);
          return;
        }

        // Decrypt successful - parse the secret
        const secret = bytesToString(decryptedBytes);

        // Try to determine what type of secret this is
        let walletAddress = '';
        let walletSeed: string | undefined;
        let walletMnemonic: string | undefined;

        // Check if it's a mnemonic (12 or 24 words)
        const words = secret.trim().split(/\s+/);
        if (words.length === 12 || words.length === 24) {
          try {
            const xrplWallet = Wallet.fromMnemonic(secret);
            walletAddress = xrplWallet.classicAddress;
            walletSeed = xrplWallet.seed;
            walletMnemonic = secret;
          } catch (e) {
            console.error('Not a valid mnemonic');
          }
        }

        // Check if it's a seed (starts with 's')
        if (!walletAddress && secret.startsWith('s')) {
          try {
            const xrplWallet = Wallet.fromSeed(secret);
            walletAddress = xrplWallet.classicAddress;
            walletSeed = secret;
          } catch (e) {
            console.error('Not a valid seed');
          }
        }

        if (walletAddress) {
          setDecryptedWallet({
            address: walletAddress,
            seed: walletSeed,
            mnemonic: walletMnemonic
          });
        } else {
          setError('Decrypted data but could not create wallet. Secret format not recognized.');
        }
      } else {
        setError('Data is not in the expected EncryptedVault format');
      }
    } catch (e: any) {
      console.error('Decryption error:', e);
      if (e.message && e.message.includes('OperationError')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(`Decryption failed: ${e.message}`);
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-bear-dark-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-bear-dark-800 rounded-xl p-6 border-2 border-bear-gold-500 mb-6">
          <h1 className="text-3xl font-bold text-bear-gold-500 mb-3">
            🔐 LocalStorage Wallet Recovery
          </h1>
          <p className="text-gray-300 mb-4">
            This tool scans your browser's localStorage for any encrypted wallet data and helps you recover it.
          </p>

          <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-4">
            <h3 className="text-orange-400 font-bold mb-2">⚠️ IMPORTANT</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• This must be run in the SAME browser where you created the wallet</li>
              <li>• Must be the SAME computer (localStorage is browser-specific)</li>
              <li>• You'll need the password you used when creating the wallet</li>
              <li>• If you cleared browser data, the wallet may be lost</li>
            </ul>
          </div>
        </div>

        {/* Scan Button */}
        <div className="bg-bear-dark-800 rounded-xl p-6 border border-bear-dark-700 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 1: Scan LocalStorage</h2>
          <button
            onClick={scanLocalStorage}
            className="w-full bg-bear-purple-500 hover:bg-bear-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            🔍 Scan for Wallet Data
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Found Wallets */}
        {foundWallets.length > 0 && (
          <div className="bg-bear-dark-800 rounded-xl p-6 border border-bear-dark-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Step 2: Found {foundWallets.length} Potential Wallet{foundWallets.length > 1 ? 's' : ''}
            </h2>
            <div className="space-y-3">
              {foundWallets.map((wallet, index) => (
                <div
                  key={index}
                  className={`bg-bear-dark-700 rounded-lg p-4 border ${
                    selectedWalletKey === wallet.key
                      ? 'border-bear-purple-500'
                      : 'border-bear-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">
                      localStorage Key: <span className="text-white font-mono">{wallet.key}</span>
                    </p>
                    <button
                      onClick={() => setSelectedWalletKey(wallet.key)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        selectedWalletKey === wallet.key
                          ? 'bg-bear-purple-600 text-white'
                          : 'bg-bear-purple-500 hover:bg-bear-purple-600 text-white'
                      }`}
                    >
                      {selectedWalletKey === wallet.key ? 'Selected' : 'Select'}
                    </button>
                  </div>
                  <pre className="text-xs text-gray-500 bg-bear-dark-900 p-2 rounded overflow-x-auto max-h-32">
                    {typeof wallet.data === 'object'
                      ? JSON.stringify(wallet.data, null, 2)
                      : wallet.data.substring(0, 200) + (wallet.data.length > 200 ? '...' : '')
                    }
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decrypt */}
        {selectedWalletKey && (
          <div className="bg-bear-dark-800 rounded-xl p-6 border border-bear-dark-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 3: Decrypt Wallet</h2>
            <p className="text-sm text-gray-400 mb-4">
              Selected: <span className="text-white font-mono">{selectedWalletKey}</span>
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDecrypting) {
                  attemptDecryption(selectedWalletKey);
                }
              }}
              placeholder="Enter your wallet password"
              className="w-full bg-bear-dark-700 text-white px-4 py-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-bear-purple-500"
              disabled={isDecrypting}
            />
            <button
              onClick={() => attemptDecryption(selectedWalletKey)}
              disabled={isDecrypting}
              className="w-full bg-bear-gold-500 hover:bg-bear-gold-600 text-bear-dark-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDecrypting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-bear-dark-900 border-t-transparent rounded-full animate-spin" />
                  Decrypting...
                </span>
              ) : (
                '🔓 Decrypt Wallet'
              )}
            </button>
          </div>
        )}

        {/* Decrypted Wallet */}
        {decryptedWallet && (
          <div className="bg-bear-green-500/20 border border-bear-green-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-bear-green-400 mb-4">
              ✅ Wallet Recovered!
            </h2>

            <div className="space-y-4">
              {/* Address */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Wallet Address:</p>
                <div className="bg-bear-dark-900 p-3 rounded-lg flex items-center justify-between">
                  <code className="text-white font-mono text-sm">{decryptedWallet.address}</code>
                  <button
                    onClick={() => copyToClipboard(decryptedWallet.address)}
                    className="text-bear-gold-400 hover:text-bear-gold-300 transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Mnemonic */}
              {decryptedWallet.mnemonic && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Recovery Phrase (Mnemonic):</p>
                  <div className="bg-bear-dark-900 p-4 rounded-lg">
                    <code className="text-white font-mono text-sm block mb-3 break-all">{decryptedWallet.mnemonic}</code>
                    <button
                      onClick={() => copyToClipboard(decryptedWallet.mnemonic!)}
                      className="w-full bg-bear-gold-500 hover:bg-bear-gold-600 text-bear-dark-900 font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      📋 Copy Mnemonic
                    </button>
                  </div>
                </div>
              )}

              {/* Seed */}
              {decryptedWallet.seed && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Family Seed:</p>
                  <div className="bg-bear-dark-900 p-3 rounded-lg flex items-center justify-between">
                    <code className="text-white font-mono text-sm">{decryptedWallet.seed}</code>
                    <button
                      onClick={() => copyToClipboard(decryptedWallet.seed!)}
                      className="text-bear-gold-400 hover:text-bear-gold-300 transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Critical Warning */}
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mt-6">
                <h4 className="text-red-400 font-bold mb-2">⚠️ CRITICAL - WRITE THIS DOWN NOW</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Write down the recovery information above IMMEDIATELY</li>
                  <li>• Store it in a SAFE PLACE - not on your computer</li>
                  <li>• This is the ONLY way to recover your wallet if you lose access</li>
                  <li>• Never share this with anyone</li>
                </ul>
              </div>

              {/* Check if this is the right wallet */}
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4">
                <h4 className="text-blue-400 font-bold mb-2">📝 Verify This Is Your Wallet</h4>
                <p className="text-sm text-gray-300 mb-2">
                  Check this address on XRPScan to verify it contains your funds:
                </p>
                <a
                  href={`https://xrpscan.com/account/${decryptedWallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-bear-purple-400 hover:text-bear-purple-300 transition-colors"
                >
                  View on XRPScan
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
