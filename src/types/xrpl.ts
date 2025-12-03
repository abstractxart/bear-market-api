// ============================================
// XRPL-specific Type Definitions
// ============================================

// XRPL Account NFTs response
export interface AccountNFT {
  Flags: number;
  Issuer: string;
  NFTokenID: string;
  NFTokenTaxon: number;
  URI?: string;
  nft_serial: number;
}

export interface AccountNFTsResponse {
  account: string;
  account_nfts: AccountNFT[];
  ledger_current_index?: number;
  validated?: boolean;
}

// XRPL Account Lines (token balances)
export interface TrustLine {
  account: string;
  balance: string;
  currency: string;
  limit: string;
  limit_peer: string;
  quality_in: number;
  quality_out: number;
}

export interface AccountLinesResponse {
  account: string;
  lines: TrustLine[];
  ledger_current_index?: number;
}

// XRPL AMM Info
export interface AMMAsset {
  currency: string;
  issuer?: string;
  value?: string;
}

export interface AMMInfo {
  amm: {
    account: string;
    amount: string | AMMAsset;
    amount2: string | AMMAsset;
    asset_frozen: boolean;
    asset2_frozen: boolean;
    auction_slot?: {
      account: string;
      discounted_fee: number;
      expiration: string;
      price: AMMAsset;
      time_interval: number;
    };
    lp_token: AMMAsset;
    trading_fee: number;
    vote_slots?: Array<{
      account: string;
      trading_fee: number;
      vote_weight: number;
    }>;
  };
  ledger_current_index?: number;
  validated?: boolean;
}

// Transaction types
export interface PaymentTransaction {
  TransactionType: 'Payment';
  Account: string;
  Destination: string;
  Amount: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  SendMax?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  DeliverMin?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  Paths?: Array<Array<{
    account?: string;
    currency?: string;
    issuer?: string;
    type?: number;
  }>>;
  Flags?: number;
  Fee?: string;
  Sequence?: number;
  LastLedgerSequence?: number;
  Memos?: Array<{
    Memo: {
      MemoType?: string;
      MemoData?: string;
    };
  }>;
}

// Path find response
export interface PathFindResponse {
  alternatives: Array<{
    paths_computed: Array<Array<{
      account?: string;
      currency?: string;
      issuer?: string;
      type: number;
      type_hex: string;
    }>>;
    source_amount: string | {
      currency: string;
      issuer: string;
      value: string;
    };
  }>;
  destination_account: string;
  destination_amount: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  source_account: string;
}

// Book offers for order book
export interface BookOffer {
  Account: string;
  BookDirectory: string;
  BookNode: string;
  Flags: number;
  LedgerEntryType: string;
  OwnerNode: string;
  PreviousTxnID: string;
  PreviousTxnLgrSeq: number;
  Sequence: number;
  TakerGets: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  TakerPays: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  index: string;
  owner_funds?: string;
  quality?: string;
}

// Known BEAR ecosystem addresses
export const BEAR_ECOSYSTEM = {
  // Pixel Bear NFT issuer - UPDATE WITH ACTUAL ADDRESS
  PIXEL_BEAR_ISSUER: 'rPixelBearIssuerAddressHere',

  // Ultra rare taxons - UPDATE WITH ACTUAL TAXONS
  ULTRA_RARE_TAXONS: [1, 2, 3, 4, 5] as number[],

  // BEAR token
  BEAR_TOKEN: {
    currency: 'BEAR',
    issuer: 'rBEARTokenIssuerAddressHere', // UPDATE
  },

  // Fee collection wallet (will LP deposit)
  FEE_WALLET: 'rFeeCollectionWalletHere', // UPDATE

  // BEAR/XRP AMM
  BEAR_AMM: {
    account: 'rBEARAMMAccountHere', // UPDATE
  },
} as const;
