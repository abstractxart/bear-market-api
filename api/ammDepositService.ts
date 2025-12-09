/**
 * AMM Deposit Service
 * Handles single-sided XRP deposits into BEAR/XRP AMM pool
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';

// BEAR Token Details
const BEAR_TOKEN = {
  currency: '4245415200000000000000000000000000000000', // "BEAR" in hex format
  issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
};

// BEAR/XRP AMM Account
const BEAR_AMM_ACCOUNT = 'rwE86ARLXfyKYCVmFpk511ddYfs5Fh6Vcp';

// XRPL Client
let client: Client | null = null;

/**
 * Initialize XRPL client
 */
async function getClient(): Promise<Client> {
  if (!client || !client.isConnected()) {
    client = new Client('wss://xrplcluster.com');
    await client.connect();
    console.log('🔗 Connected to XRPL');
  }
  return client;
}

/**
 * Get AMM LP token currency code for BEAR/XRP pool
 */
async function getAMMLPTokenInfo(): Promise<{ currency: string; issuer: string }> {
  const xrplClient = await getClient();

  const ammInfo = await xrplClient.request({
    command: 'amm_info',
    asset: {
      currency: BEAR_TOKEN.currency,
      issuer: BEAR_TOKEN.issuer,
    },
    asset2: {
      currency: 'XRP',
    },
  });

  if (!ammInfo.result.amm?.lp_token) {
    throw new Error('AMM LP token not found');
  }

  return {
    currency: ammInfo.result.amm.lp_token.currency,
    issuer: ammInfo.result.amm.lp_token.issuer,
  };
}

/**
 * Deposit XRP into BEAR/XRP AMM (single-sided)
 * Returns the transaction hash and LP tokens received
 */
export async function depositXRPToAMM(
  walletSecret: string,
  xrpAmount: string
): Promise<{
  txHash: string;
  lpTokensReceived: string;
  lpTokenCurrency: string;
  lpTokenIssuer: string;
}> {
  const xrplClient = await getClient();

  // Initialize wallet from secret
  const wallet = Wallet.fromSeed(walletSecret);
  console.log(`💼 Depositing from wallet: ${wallet.address}`);

  // Get LP token info
  const lpToken = await getAMMLPTokenInfo();
  console.log(`🎫 LP Token: ${lpToken.currency} (${lpToken.issuer})`);

  // Create AMMDeposit transaction (single-sided XRP deposit)
  const ammDepositTx: any = {
    TransactionType: 'AMMDeposit',
    Account: wallet.address,
    Asset: {
      currency: BEAR_TOKEN.currency,
      issuer: BEAR_TOKEN.issuer,
    },
    Asset2: {
      currency: 'XRP',
    },
    Amount: xrpToDrops(xrpAmount), // Single-sided XRP deposit
    Flags: 0x00080000, // tfSingleAsset flag
  };

  console.log(`📝 Creating AMMDeposit for ${xrpAmount} XRP...`);

  // Autofill (adds Fee, Sequence, LastLedgerSequence)
  const prepared = await xrplClient.autofill(ammDepositTx);

  // Sign transaction
  const signed = wallet.sign(prepared);
  console.log(`✍️ Transaction signed: ${signed.hash}`);

  // Submit and wait for validation
  const result = await xrplClient.submitAndWait(signed.tx_blob);

  if (result.result.meta && typeof result.result.meta === 'object') {
    const meta = result.result.meta as any;

    // Check if transaction succeeded
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`AMMDeposit failed: ${meta.TransactionResult}`);
    }

    // Parse LP tokens received from metadata
    let lpTokensReceived = '0';

    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        const nodeData = node.ModifiedNode || node.CreatedNode;
        if (nodeData?.LedgerEntryType === 'RippleState') {
          const finalFields = nodeData.FinalFields || nodeData.NewFields;
          if (
            finalFields?.Balance?.currency === lpToken.currency &&
            (finalFields?.LowLimit?.issuer === wallet.address ||
             finalFields?.HighLimit?.issuer === wallet.address)
          ) {
            // LP token balance change
            const balance = finalFields.Balance.value;
            lpTokensReceived = Math.abs(parseFloat(balance)).toString();
            break;
          }
        }
      }
    }

    console.log(`✅ Deposit successful! Received ${lpTokensReceived} LP tokens`);
    console.log(`🔗 TX: https://xrpscan.com/tx/${signed.hash}`);

    return {
      txHash: signed.hash,
      lpTokensReceived,
      lpTokenCurrency: lpToken.currency,
      lpTokenIssuer: lpToken.issuer,
    };
  }

  throw new Error('Transaction metadata not found');
}

/**
 * Check XRP balance of a wallet
 */
export async function getXRPBalance(walletAddress: string): Promise<string> {
  const xrplClient = await getClient();

  const accountInfo = await xrplClient.request({
    command: 'account_info',
    account: walletAddress,
    ledger_index: 'validated',
  });

  const drops = accountInfo.result.account_data.Balance;
  const xrp = parseFloat(drops) / 1_000_000;

  return xrp.toFixed(6);
}

/**
 * Get LP token balance for BEAR/XRP AMM
 */
export async function getLPTokenBalance(walletAddress: string): Promise<{
  balance: string;
  currency: string;
  issuer: string;
} | null> {
  const xrplClient = await getClient();

  // Get LP token info first
  const lpToken = await getAMMLPTokenInfo();

  const accountLines = await xrplClient.request({
    command: 'account_lines',
    account: walletAddress,
    ledger_index: 'validated',
  });

  // Find the LP token trustline
  const lpLine = accountLines.result.lines.find(
    (line: any) =>
      line.currency === lpToken.currency &&
      line.account === lpToken.issuer
  );

  if (!lpLine) {
    return null;
  }

  return {
    balance: lpLine.balance,
    currency: lpToken.currency,
    issuer: lpToken.issuer,
  };
}

/**
 * Disconnect XRPL client
 */
export async function disconnect(): Promise<void> {
  if (client && client.isConnected()) {
    await client.disconnect();
    console.log('🔌 Disconnected from XRPL');
  }
}
