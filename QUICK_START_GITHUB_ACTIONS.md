# Quick Start: GitHub Actions Setup

## 🚀 3 Simple Steps to Enable Automatic Daily Updates

### Step 1: Add GitHub Secrets (5 minutes)

Go to: `https://github.com/DyarAbdulla/car-price-predictor/settings/secrets/actions`

Click **"New repository secret"** and add these 6 secrets:

1. **EMAIL_ENABLED** = `true`
2. **SMTP_SERVER** = `smtp.gmail.com`
3. **SMTP_PORT** = `587`
4. **SENDER_EMAIL** = `dyarabdula15@gmail.com`
5. **SENDER_PASSWORD** = `fyjkawfmpkmsvljf` (your 16-char app password, no spaces)
6. **RECIPIENT_EMAIL** = `dyarabdula15@gmail.com`

### Step 2: Push to GitHub

```bash
git add .github/workflows/daily_update.yml
git commit -m "Add GitHub Actions for automatic daily updates"
git push
```

### Step 3: Test It!

1. Go to: `https://github.com/DyarAbdulla/car-price-predictor/actions`
2. Click **"Daily Dataset Update"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch it run! 🎉

## ✅ That's It!

The workflow will now:
- ✅ Run **daily at 2:00 AM** (Iraq time)
- ✅ Scrape **500 new listings** per day
- ✅ Update dataset **automatically**
- ✅ Commit and push to **GitHub**
- ✅ Send **email notifications**
- ✅ Work **even when your PC is off!**

## 📊 Schedule

- **Frequency**: Once per day
- **Time**: 2:00 AM Iraq time (11:00 PM UTC)
- **Listings**: Up to 500 per day
- **Cost**: FREE (GitHub Actions is free for public repos)

## 🔍 Monitor Updates

- **Actions Tab**: See all workflow runs
- **Email**: Get notifications for each update
- **GitHub Commits**: See automatic commits

## ⚙️ Change Update Time

Edit `.github/workflows/daily_update.yml`:
```yaml
- cron: '0 23 * * *'  # Change this line
```

Cron format: `minute hour day month weekday`
- 2 AM Iraq = `'0 23 * * *'` (11 PM UTC)
- 3 AM Iraq = `'0 0 * * *'` (midnight UTC)
- 1 AM Iraq = `'0 22 * * *'` (10 PM UTC)

## 🆘 Need Help?

See full documentation: `GITHUB_ACTIONS_SETUP.md`

