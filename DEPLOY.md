# Vercel Deployment Guide

## Quick Deploy

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Supabase and Google Maps integration"
git push
```

### 2. Connect to Vercel
- Go to [vercel.com](https://vercel.com)
- Click **"New Project"** → Import your GitHub repo
- Select **"Escher-Travel-Manager"**

### 3. Add Environment Variables

In Vercel dashboard → **Settings → Environment Variables**, add:

| Name | Value | Description |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://ididcipzvtzdsqxhwljj.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_gXt5buGl8UAHTfUZbVi33w_oemTkaF7` | Supabase anon key |
| `GOOGLE_PLACES_API_KEY` | `AIzaSyDyfzuJ0rhAykjkKetws82o63_l6EDxmuc` | Google Places API |

> **Important:** Make sure to select **all environments** (Production, Preview, Development)

### 4. Deploy
Click **"Deploy"** and wait ~2 minutes.

---

## After Deployment

### Test Multi-Device Sync
1. Open the app on your phone
2. Open the app on your wife's phone
3. Add/edit an event on one device
4. Changes should appear instantly on the other! 🎉

### Install as PWA
On mobile Chrome:
1. Open your Vercel URL
2. Tap the **"Add to Home Screen"** prompt
3. The app will work offline too!

---

## Troubleshooting

**"API key not configured" error:**
- Double-check `GOOGLE_PLACES_API_KEY` is set in Vercel
- Redeploy after adding variables

**Data not syncing:**
- Verify Supabase env vars are correct
- Check browser console for errors

**Google Maps parser not working:**
- Ensure Places API is enabled in Google Cloud Console
- Check API key restrictions (should allow your Vercel domain)
