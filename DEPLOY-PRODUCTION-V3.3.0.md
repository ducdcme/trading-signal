# Deploy Trading Signal v3.3.0 to production

Assumptions:
- repository working tree is already connected to GitHub;
- production directory and Nginx/PM2 configuration already exist from v3.2.0;
- `stocks-data-collector` is running locally on the VPS at `127.0.0.1:8790`;
- `metals-data-collector` remains at `127.0.0.1:8787`.

## 1. Push from development machine

```bash
git status
git add .
git commit -m "release: Trading Signal v3.3.0 VN stocks"
git push origin HEAD
```

## 2. Update production VPS

```bash
cd /path/to/trading-signal
git status
git pull --ff-only
npm install --omit=dev
```

Verify production `.env` contains:

```env
STOCKS_API_URL=http://127.0.0.1:8790/
METALS_API_URL=http://127.0.0.1:8787/
```

Do not overwrite the existing production authentication / Telegram values.

## 3. Restart

```bash
pm2 restart trading-signal --update-env
pm2 status
pm2 logs trading-signal --lines 100
```

## 4. Smoke tests on VPS

```bash
curl http://127.0.0.1:8790/health
curl http://127.0.0.1:3210/api/health
curl http://127.0.0.1:3210/api/stocks/symbols
```

Expected Trading Signal version: `3.3.0`.

## 5. Production UI checks
- Login.
- Open VN Stocks and load Watchlist.
- Open one D1 stock chart.
- Run Stock D1 manually once.
- Verify Telegram.
- Save Stock automation at the desired schedule (default 07:00).
- Confirm Crypto and Metals tabs still load normally.
