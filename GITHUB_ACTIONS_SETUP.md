# GitHub Actions Setup Guide

## Overview

This guide will help you set up GitHub Actions to automatically run daily dataset updates in the cloud, even when your PC is shut down.

## What GitHub Actions Does

- ✅ Runs daily at 2:00 AM (Iraq time)
- ✅ Scrapes up to 500 new car listings
- ✅ Updates the dataset automatically
- ✅ Commits and pushes to GitHub
- ✅ Sends email notifications
- ✅ Works 24/7 in the cloud (no PC needed!)

## Setup Steps

### Step 1: Add GitHub Secrets

You need to add your email configuration as GitHub Secrets:

1. Go to your repository on GitHub: `https://github.com/DyarAbdulla/car-price-predictor`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these secrets:

#### Required Secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `EMAIL_ENABLED` | `true` or `false` | `true` |
| `SMTP_SERVER` | Gmail SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SENDER_EMAIL` | Your Gmail address | `dyarabdula15@gmail.com` |
| `SENDER_PASSWORD` | Your Gmail app password | `fyjkawfmpkmsvljf` (16 chars, no spaces) |
| `RECIPIENT_EMAIL` | Email to receive notifications | `dyarabdula15@gmail.com` |

### Step 2: Verify Workflow File

The workflow file is already created at:
```
.github/workflows/daily_update.yml
```

### Step 3: Test the Workflow

1. Go to **Actions** tab in your GitHub repository
2. Click **Daily Dataset Update** workflow
3. Click **Run workflow** → **Run workflow** (to test manually)

### Step 4: Monitor Updates

- Check the **Actions** tab to see workflow runs
- Check your email for update notifications
- Check the repository for new commits

## Schedule

The workflow runs:
- **Daily at 2:00 AM Iraq time** (11:00 PM UTC previous day)
- You can also trigger it manually from the Actions tab

## Timezone Adjustment

If you want to change the update time, edit `.github/workflows/daily_update.yml`:

```yaml
- cron: '0 23 * * *'  # Current: 11 PM UTC = 2 AM Iraq time
```

Cron format: `minute hour day month weekday`
- For 3 AM Iraq time: `'0 0 * * *'` (midnight UTC)
- For 1 AM Iraq time: `'0 22 * * *'` (10 PM UTC previous day)

## Troubleshooting

### Workflow Not Running
- Check if secrets are set correctly
- Check Actions tab for error messages
- Verify the workflow file is in `.github/workflows/`

### Email Not Sending
- Verify all email secrets are set
- Check that `SENDER_PASSWORD` is the 16-character app password (no spaces)
- Check Actions logs for email errors

### No Changes Committed
- This is normal if no new listings were scraped
- Check the workflow logs to see what happened
- Rate limiting may prevent scraping

### Authentication Errors
- Make sure `GITHUB_TOKEN` has write permissions (it should by default)
- Check git config in workflow logs

## Manual Trigger

You can manually trigger the workflow:
1. Go to **Actions** tab
2. Select **Daily Dataset Update**
3. Click **Run workflow**
4. Click the green **Run workflow** button

## Benefits

✅ **No PC Required**: Runs in GitHub's cloud  
✅ **Automatic**: Runs daily without intervention  
✅ **Reliable**: GitHub's infrastructure is always available  
✅ **Free**: GitHub Actions provides 2,000 minutes/month free  
✅ **Monitored**: See all runs in the Actions tab  
✅ **Email Notifications**: Get notified of updates  

## Cost

GitHub Actions is **FREE** for:
- Public repositories: Unlimited minutes
- Private repositories: 2,000 minutes/month free

Your daily update uses ~30-60 minutes, so you have plenty of free minutes!

## Next Steps

1. Add the GitHub secrets (Step 1 above)
2. Push the workflow file to GitHub
3. Test it manually from the Actions tab
4. Monitor the first few runs
5. Enjoy automatic daily updates! 🎉

