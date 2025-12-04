# BEAR MARKET Referral API

Backend API for BEAR MARKET's referral system with automatic XRP payouts.

## Features

- **Referral Tracking**: Register and track referral relationships
- **Automatic Payouts**: 50% of trading fees paid instantly to referrers
- **Real-time Stats**: Track earnings, referral counts, and payout history
- **XRPL Integration**: Direct XRP payments using hot wallet
- **PostgreSQL Database**: Robust data storage and querying

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

Create a PostgreSQL database and run the schema:

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/bear_market"

# Initialize database
npm run db:init
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bear_market
HOT_WALLET_SEED=sXXXXXXXXXXXXXXXXXXXXXXXXXXX
XRPL_SERVER=wss://xrplcluster.com
PORT=3001
FRONTEND_URL=http://localhost:5173
FRONTEND_URL_PROD=https://your-production-url.vercel.app
```

**IMPORTANT**: You need to create and fund an XRPL wallet for automatic payouts.

### 4. Create Hot Wallet

```javascript
// Generate a new wallet
const { Wallet } = require('xrpl');
const wallet = Wallet.generate();
console.log('Address:', wallet.address);
console.log('Seed:', wallet.seed); // Save this as HOT_WALLET_SEED
```

Then fund the wallet with XRP on the XRPL network.

### 5. Run Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Referrals

- `POST /api/referrals/register` - Register a referral relationship
- `GET /api/referrals/:wallet` - Get referral data for a wallet
- `GET /api/referrals/:wallet/stats` - Get earnings statistics
- `GET /api/referrals/:wallet/payouts` - Get payout history

### Trades

- `POST /api/trades/record` - Record a trade and trigger payout

## Deployment

### Railway (Recommended)

1. Create Railway account
2. Create new project
3. Add PostgreSQL plugin
4. Deploy from GitHub
5. Set environment variables in Railway dashboard
6. Database will auto-initialize on first run

### Environment Variables

```
DATABASE_URL=<from Railway PostgreSQL plugin>
HOT_WALLET_SEED=<your hot wallet seed>
XRPL_SERVER=wss://xrplcluster.com
PORT=3001
NODE_ENV=production
FRONTEND_URL_PROD=https://your-app.vercel.app
```

## Commission Structure

- **Referrer**: 50% of trading fee
- **BEAR Ecosystem**: 50% of trading fee

Example: If a trade has a 1 XRP fee, the referrer receives 0.5 XRP automatically.

## Security Notes

- **HOT_WALLET_SEED**: Keep this secret! Never commit to git.
- **Database**: Use SSL in production
- **CORS**: Configure allowed origins properly
- **Rate Limiting**: Add rate limiting in production

## Monitoring

Check logs for payout activity:

```bash
# Railway
railway logs

# Local
Check console output
```

## Testing

Test the API locally:

```bash
# Register a referral
curl -X POST http://localhost:3001/api/referrals/register \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"rN7n7otQDd6FczFgLdlqtyMVrn3NnrcP4C","referrerCode":"RN7N7ORP4C"}'

# Get stats
curl http://localhost:3001/api/referrals/rN7n7otQDd6FczFgLdlqtyMVrn3NnrcP4C/stats
```

## Support

For issues or questions, create an issue on GitHub.
