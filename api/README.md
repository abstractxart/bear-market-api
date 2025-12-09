# BEAR SWAP Backend API

Backend server for managing token metadata, social links, and Kick streams.

## Features

- 🔐 **CTO Wallet Support** - Community Take Over wallets can manage tokens
- 🎮 **Kick Stream Integration** - Token creators can add live streams
- 🔗 **Social Links** - Discord, Twitter, Telegram, and up to 3 custom websites
- ✅ **Authorization** - Only issuers and CTO wallets can edit

## Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Setup PostgreSQL

Create a database and update your `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bear_swap
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 3. Initialize Database

```bash
npm run db:init
```

This will create the `token_metadata` table and insert the default $BEAR CTO wallet.

### 4. Start Server

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## API Endpoints

### Get Token Metadata
```
GET /api/token/:currency/:issuer/metadata
```

Returns token metadata including social links and Kick stream URL.

### Update Token Metadata
```
POST /api/token/:currency/:issuer/metadata
```

Body:
```json
{
  "wallet_address": "rKkkYMCvC63HEgxjQHmayKADaxYqnsMUkT",
  "kick_stream_url": "https://kick.com/bearswap",
  "discord_url": "https://discord.gg/bearswap",
  "twitter_url": "https://x.com/bearswap",
  "telegram_url": "https://t.me/bearswap",
  "website1_url": "https://bearswap.com",
  "website2_url": "https://docs.bearswap.com",
  "website3_url": "https://blog.bearswap.com"
}
```

**Authorization:** Wallet must be the token issuer OR the CTO wallet.

### Set CTO Wallet
```
POST /api/token/:currency/:issuer/cto
```

Body:
```json
{
  "wallet_address": "rBEARgPjE6Fe3cMxD3kHRqYJrPY87abr8P",
  "cto_wallet": "rKkkYMCvC63HEgxjQHmayKADaxYqnsMUkT"
}
```

**Authorization:** ONLY the token issuer can set the CTO wallet.

## CTO Wallet Configuration

The $BEAR token CTO wallet is hardcoded in both:
- **Frontend:** `src/pages/TokenTerminal.tsx` (CTO_WALLETS mapping)
- **Database:** `api/schema.sql` (initial INSERT)

### $BEAR CTO Wallet
- **Issuer:** `rBEARgPjE6Fe3cMxD3kHRqYJrPY87abr8P`
- **CTO Wallet:** `rKkkYMCvC63HEgxjQHmayKADaxYqnsMUkT`

## Database Schema

```sql
CREATE TABLE token_metadata (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(40) NOT NULL,
  issuer VARCHAR(35) NOT NULL,
  cto_wallet VARCHAR(35),
  kick_stream_url TEXT,
  discord_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  website1_url TEXT,
  website2_url TEXT,
  website3_url TEXT,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(35) NOT NULL,
  UNIQUE(currency, issuer)
);
```

## Deployment

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database
3. Deploy the API:
   ```bash
   railway up
   ```
4. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway)
   - `FRONTEND_URL` (your frontend URL)
5. Initialize database:
   ```bash
   railway run npm run db:init
   ```

### Vercel (Serverless)

For serverless deployment, convert to Next.js API routes or use Vercel Postgres.

## Security

- ✅ CORS enabled for frontend origin only
- ✅ URL validation on all links
- ✅ XRPL address validation
- ✅ Authorization checks on all write operations
- ✅ Audit trail (updated_by field)

## Support

For issues or questions, open an issue on GitHub.
