# Vercel Deployment Guide - Indian Money Code

## Prerequisites
- GitHub account with your repo pushed
- Vercel account (free tier works, Pro recommended for AI features)
- Your `GEMINI_API_KEY` from Google AI Studio

---

## Step 1: Push Latest Code to GitHub

Open terminal in your project folder and run:

```bash
git add .
git commit -m "Add Vercel serverless functions for AI chatbot"
git push origin main
```

Make sure the `api/` folder and `vercel.json` are included in the push.

---

## Step 2: Create Vercel Account

1. Go to https://vercel.com
2. Click **Sign Up**
3. Choose **Continue with GitHub** (this links your GitHub automatically)
4. Authorize Vercel to access your GitHub repos

---

## Step 3: Import Your Repository

1. After login, click **"Add New..."** > **"Project"**
2. You'll see a list of your GitHub repos
3. Find **indian-money-code** and click **"Import"**

---

## Step 4: Configure Project Settings

On the configuration screen, set these values:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Other` (NOT Vite, NOT Next.js) |
| **Build Command** | `vite build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (default is fine) |
| **Node.js Version** | `20.x` (select from dropdown) |

> **IMPORTANT:** Do NOT select "Vite" as framework. Choose "Other" so Vercel respects your `vercel.json` config and picks up the `api/` serverless functions.

---

## Step 5: Add Environment Variable (CRITICAL)

This is the most important step. Without this, the AI chatbot will not work.

1. On the same project setup page, scroll down to **"Environment Variables"**
2. Add the following:

| Name | Value | Environments |
|------|-------|--------------|
| `GEMINI_API_KEY` | `your-actual-gemini-api-key` | Check all: Production, Preview, Development |

### How to get your Gemini API Key:
1. Go to https://aistudio.google.com/apikey
2. Click **"Create API Key"**
3. Select or create a Google Cloud project
4. Copy the generated key
5. Paste it in Vercel's environment variable field

---

## Step 6: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes for the build to complete
3. You'll see a success screen with your deployment URL (e.g., `your-project.vercel.app`)

---

## Step 7: Verify the AI Chatbot Works

1. Open your deployment URL in a browser
2. Log in to the app
3. Click the **chat bubble** (bottom-right corner)
4. Type any financial question like: "How should I invest 50000 rupees?"
5. You should get a response from Money Buddy AI within a few seconds

### If it doesn't work, check:
- Open browser DevTools (F12) > Console tab > look for errors
- Open browser DevTools > Network tab > look for `/api/gemini` request and check if it returns 500 or 404
- Go to Vercel Dashboard > your project > **"Logs"** tab to see server-side errors

---

## Step 8: Configure Auto-Deployments

By default, Vercel auto-deploys every time you push to `main`. To verify:

1. Go to Vercel Dashboard > your project > **Settings** > **Git**
2. Confirm "Production Branch" is set to `main`
3. Every `git push origin main` will now trigger a new deployment

---

## Troubleshooting

### Problem: Chatbot says "AI is offline" or gives no response
**Cause:** `GEMINI_API_KEY` is missing or wrong.
**Fix:** Go to Settings > Environment Variables > verify the key is correct and saved for Production.

### Problem: API returns 404
**Cause:** Vercel didn't detect the `api/` folder as serverless functions.
**Fix:** Make sure Framework Preset is "Other" (not Vite). Redeploy.

### Problem: API returns 504 (timeout)
**Cause:** Free Hobby plan has 10-second function timeout. AI calls sometimes take longer.
**Fix:** Upgrade to Vercel Pro ($20/month) which gives 60-second timeout. Or the AI will retry on next user message.

### Problem: Build fails with TypeScript errors
**Cause:** Type issues in API folder.
**Fix:** Go to Vercel > Deployments > click failed deployment > read the build log. Share the error for debugging.

### Problem: "FUNCTION_INVOCATION_FAILED" in logs
**Cause:** Usually a missing dependency or runtime error.
**Fix:** Check Vercel Logs tab. Common fix: make sure `@google/genai` is in `dependencies` (not devDependencies) in package.json.

---

## Plan Comparison (Free vs Pro)

| Feature | Free (Hobby) | Pro ($20/month) |
|---------|-------------|-----------------|
| Function Timeout | 10 seconds | 60 seconds |
| Deployments | Unlimited | Unlimited |
| Bandwidth | 100 GB | 1 TB |
| AI Chatbot | Works (may timeout on complex queries) | Works fully |
| Video Generation | Will timeout | Works |
| Portfolio Analysis | Works | Works |

**Recommendation:** Start with Free plan. If the chatbot times out frequently, upgrade to Pro.

---

## Folder Structure After Setup

```
indian-money-code/
├── api/                    <-- Vercel Serverless Functions
│   ├── gemini.ts           <-- Main AI endpoint (chatbot, portfolio, budget)
│   ├── generate-video.ts   <-- Video generation
│   ├── video-status.ts     <-- Video polling
│   └── video-download.ts   <-- Video download
├── components/             <-- React components
│   ├── AIChatBot.tsx       <-- Chat UI (calls /api/gemini)
│   └── ...
├── services/
│   ├── geminiService.ts    <-- Frontend service (proxies to /api/gemini)
│   └── ...
├── dist/                   <-- Built by "vite build" (served as static)
├── vercel.json             <-- Vercel routing config
├── package.json            <-- Build scripts & dependencies
└── ...
```

---

## Re-deploying After Changes

After any code change:

```bash
git add .
git commit -m "your change description"
git push origin main
```

Vercel picks it up automatically within 30-60 seconds.
