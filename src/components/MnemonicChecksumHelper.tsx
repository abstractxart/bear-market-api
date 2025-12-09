import { useState } from 'react';
import * as bip39 from 'bip39';
import { Wallet } from 'xrpl';

interface ValidMnemonic {
  lastWord: string;
  fullMnemonic: string;
  address: string;
  index: number;
}

export const MnemonicChecksumHelper: React.FC = () => {
  const [first11Words, setFirst11Words] = useState<string[]>(Array(11).fill(''));
  const [validCombinations, setValidCombinations] = useState<ValidMnemonic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [foundMnemonic, setFoundMnemonic] = useState<ValidMnemonic | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...first11Words];
    newWords[index] = value.trim().toLowerCase();
    setFirst11Words(newWords);
  };

  const findValidLastWords = async () => {
    setIsSearching(true);
    setValidCombinations([]);
    setFoundMnemonic(null);
    setSearchComplete(false);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const results: ValidMnemonic[] = [];
        const wordlist = bip39.wordlists.english;

        console.log('[MnemonicChecksumHelper] Searching for valid last words...');
        console.log('[MnemonicChecksumHelper] First 11 words:', first11Words.join(' '));

        // Try all 2048 possible last words
        let validCount = 0;
        for (let i = 0; i < wordlist.length; i++) {
          const lastWord = wordlist[i];
          const fullMnemonic = [...first11Words, lastWord].join(' ');

          // Check if valid BIP39
          if (bip39.validateMnemonic(fullMnemonic)) {
            validCount++;
            try {
              // Try both algorithms
              const walletSecp256k1 = Wallet.fromMnemonic(fullMnemonic, { algorithm: 'ecdsa-secp256k1' });
              const walletEd25519 = Wallet.fromMnemonic(fullMnemonic, { algorithm: 'ed25519' });

              // Add both if they're different
              results.push({
                lastWord,
                fullMnemonic,
                address: walletSecp256k1.classicAddress,
                index: results.length
              });

              if (walletEd25519.classicAddress !== walletSecp256k1.classicAddress) {
                results.push({
                  lastWord: `${lastWord} (ed25519)`,
                  fullMnemonic,
                  address: walletEd25519.classicAddress,
                  index: results.length
                });
              }
            } catch (e) {
              console.error(`[MnemonicChecksumHelper] Failed to create wallet for: ${lastWord}`, e);
            }
          }
        }

        console.log(`[MnemonicChecksumHelper] Found ${validCount} valid checksums, ${results.length} unique addresses`);
        setValidCombinations(results);
        setSearchComplete(true);
      } catch (error) {
        console.error('[MnemonicChecksumHelper] Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 100);
  };

  const selectMnemonic = (mnemonic: ValidMnemonic) => {
    setFoundMnemonic(mnemonic);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-bear-dark-800 rounded-xl p-6 border-2 border-bear-gold-500">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-bear-gold-500 mb-2">
            Mnemonic Checksum Recovery Tool
          </h2>
          <p className="text-gray-400 text-sm">
            If you have the first 11 words of your mnemonic but the last word is wrong,
            this tool will help you find the correct last word by trying all valid checksums.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
          <h3 className="text-red-400 font-bold mb-2">⚠️ IMPORTANT</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• This tool will generate ~128 possible wallet addresses</li>
            <li>• You must identify YOUR wallet address from the list</li>
            <li>• Only use this if you're CERTAIN about the first 11 words</li>
            <li>• One wrong word in the first 11 means you won't find your wallet</li>
          </ul>
        </div>

        {/* Input: First 11 Words */}
        {!foundMnemonic && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Enter Your First 11 Words (in correct order)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {first11Words.map((word, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    placeholder={`Word ${index + 1}`}
                    className="flex-1 bg-bear-dark-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bear-purple-500"
                    disabled={isSearching}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Button */}
        {!foundMnemonic && (
          <button
            onClick={findValidLastWords}
            disabled={isSearching || first11Words.some(w => !w)}
            className="w-full bg-bear-purple-500 hover:bg-bear-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching for valid combinations...
              </span>
            ) : (
              'Find Valid Last Words'
            )}
          </button>
        )}

        {/* Results */}
        {searchComplete && validCombinations.length > 0 && !foundMnemonic && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Found {validCombinations.length} Valid Combinations
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Click on YOUR wallet address to reveal the correct mnemonic:
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {validCombinations.map((combo) => (
                <button
                  key={combo.index}
                  onClick={() => selectMnemonic(combo)}
                  className="w-full bg-bear-dark-700 hover:bg-bear-dark-600 text-left p-4 rounded-lg transition-colors border border-bear-dark-600 hover:border-bear-purple-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-mono text-sm mb-1">
                        {combo.address}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Last word: <span className="text-bear-gold-400">{combo.lastWord}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-bear-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {searchComplete && validCombinations.length === 0 && (
          <div className="mt-6 bg-red-500/20 border border-red-500 rounded-lg p-4">
            <h3 className="text-red-400 font-bold mb-2">No Valid Combinations Found</h3>
            <p className="text-sm text-gray-300">
              This means at least one of the first 11 words is incorrect.
              Please double-check your words and try again.
            </p>
          </div>
        )}

        {/* Found Mnemonic */}
        {foundMnemonic && (
          <div className="mt-6">
            <div className="bg-bear-green-500/20 border border-bear-green-500 rounded-lg p-6">
              <h3 className="text-bear-green-400 font-bold text-lg mb-4">
                ✅ Wallet Found!
              </h3>

              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Wallet Address:</p>
                <div className="bg-bear-dark-900 p-3 rounded-lg flex items-center justify-between">
                  <code className="text-white font-mono text-sm">{foundMnemonic.address}</code>
                  <button
                    onClick={() => copyToClipboard(foundMnemonic.address)}
                    className="text-bear-gold-400 hover:text-bear-gold-300 transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Correct Mnemonic Phrase:</p>
                <div className="bg-bear-dark-900 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {foundMnemonic.fullMnemonic.split(' ').map((word, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          index === 11 ? 'bg-bear-gold-500/20 border border-bear-gold-500' : 'bg-bear-dark-700'
                        }`}
                      >
                        <span className="text-gray-500 text-xs mr-2">{index + 1}.</span>
                        <span className={`font-mono text-sm ${index === 11 ? 'text-bear-gold-400 font-bold' : 'text-white'}`}>
                          {word}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => copyToClipboard(foundMnemonic.fullMnemonic)}
                    className="w-full bg-bear-gold-500 hover:bg-bear-gold-600 text-bear-dark-900 font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    📋 Copy Full Mnemonic
                  </button>
                </div>
              </div>

              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
                <h4 className="text-red-400 font-bold mb-2">⚠️ CRITICAL - WRITE THIS DOWN</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Write down ALL 12 words EXACTLY as shown above</li>
                  <li>• The last word (highlighted in gold) is the CORRECT checksum word</li>
                  <li>• Store this mnemonic in a SAFE PLACE - not on your computer</li>
                  <li>• Never share this mnemonic with anyone</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => {
                setFoundMnemonic(null);
                setValidCombinations([]);
                setSearchComplete(false);
              }}
              className="mt-4 w-full bg-bear-dark-700 hover:bg-bear-dark-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              ← Back to Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
