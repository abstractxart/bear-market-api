# Perfect Deployment Guide

## Option A: Railway (Recommended - Easiest)

### 1. Create GitHub Repo
```bash
# Go to https://github.com/new
# - Repo name: bear-market-api
# - Public
# - Don't initialize with README
# Then run:

cd C:\Users\Oz\Desktop\bear-market-api
git remote add origin https://github.com/YOUR_USERNAME/bear-market-api.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Railway
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select `bear-market-api`
4. Add PostgreSQL plugin (click "+ New" → "Database" → "PostgreSQL")
5. Click on your service → "Variables" → Add:
   ```
   HOT_WALLET_SEED=sEdVUt2qNf5rJZSea51ERe7fAYa7PRm
   XRPL_SERVER=wss://s.altnet.rippletest.net:51233
   FRONTEND_URL_PROD=https://bear-market-gjqg3nove-bear-xrpls-projects.vercel.app
   NODE_ENV=production
   ```
6. DATABASE_URL is auto-set by Railway
7. Wait for deployment (2-3 minutes)
8. Copy your API URL (e.g., `https://bear-market-api-production.up.railway.app`)

### 3. Initialize Database
Railway auto-runs the schema on first connection. Check logs to confirm.

---

## Option B: Local Testing First

### 1. Install PostgreSQL
```bash
# Download from https://www.postgresql.org/download/windows/
# Or use Docker:
docker run --name bear-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### 2. Create Database
```bash
psql -U postgres
CREATE DATABASE bear_market;
\q
```

### 3. Initialize Schema
```bash
cd C:\Users\Oz\Desktop\bear-market-api
npm run db:init
```

### 4. Start Server
```bash
npm run dev
```

### 5. Test API
```bash
# Health check
curl http://localhost:3001/health

# Register referral
curl -X POST http://localhost:3001/api/referrals/register \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\":\"rN7n7otQDd6FczFgLdlqtyMVrn3NnrcP4C\",\"referrerCode\":\"RH9RHCT77E\"}"

# Get stats
curl http://localhost:3001/api/referrals/rN7n7otQDd6FczFgLdlqtyMVrn3NnrcP4C/stats
```

---

## Next: Frontend Integration

After backend is deployed, update frontend:

```bash
cd C:\Users\Oz\Desktop\BEAR-MARKET

# Add API URL to .env.local
echo "VITE_API_URL=https://your-railway-app.up.railway.app" > .env.local
```

Then I'll integrate the API calls in the frontend code.

---

## Switch to Mainnet

When ready for production:

1. **Create NEW mainnet wallet** (don't reuse testnet)
   ```bash
   node scripts/generate-wallet.js
   ```

2. **Fund with real XRP** (at least 20 XRP)
   - Send from your main wallet
   - Or buy XRP and send to the address

3. **Update Railway environment variables:**
   ```
   HOT_WALLET_SEED=<new mainnet seed>
   XRPL_SERVER=wss://xrplcluster.com
   ```

4. **Redeploy** - Railway auto-deploys on env change

---

## Troubleshooting

**Database connection fails:**
- Check DATABASE_URL is set in Railway
- PostgreSQL plugin must be added

**Payouts not working:**
- Check hot wallet has sufficient XRP balance
- Check XRPL_SERVER is correct
- View Railway logs for errors

**CORS errors:**
- Verify FRONTEND_URL_PROD matches your Vercel URL
- Check Railway logs for blocked requests
