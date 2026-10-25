# Publishing Study OS as a website (GitHub + Vercel)

This guide takes you from the project folder to a normal web address like
`https://study-os-yourname.vercel.app` that works on your PC and your Android phone, without Claude.
It takes about 20 minutes. You don't need to type any commands unless you want to.

---

## 1. What you need

| What | Needed? | Cost | What it does |
|---|---|---|---|
| **GitHub account** (github.com) | yes | free | Stores the code and keeps track of versions. |
| **Vercel account** (vercel.com, "Hobby" plan) | yes | free for personal use | Builds the code and hosts the website. It updates the site on its own every time the code on GitHub changes. |
| **Anthropic API key** (console.anthropic.com) | only for the AI tutor | pay per use (prepaid credit) | Lets the server talk to Claude. A Claude Pro subscription does **not** include API use. |
| Supabase (project „Study OAS“) | only for Google sign-in + sync | free tier is enough | Google sign-in and syncing between PC and phone. See section 8. |

Everything except the AI works without an API key: quizzes, flashcards, adaptive learning,
exam plans, math mode, PDF import, text recognition (OCR) and backups.

### Which files are part of the website?

| File / folder | Purpose |
|---|---|
| `src/`, `index.html`, `public/` | The app that runs in your browser |
| `api/index.ts` | The **Vercel Function**: the AI proxy, reachable at `/api/...` |
| `server/app.ts`, `server/providers.ts` | AI proxy logic, shared by Vercel and `npm start` |
| `vercel.json` | Tells Vercel how to build the site, how to route `/api`, and which headers to send |
| `public/manifest.webmanifest`, `public/icon-*.png`, `public/apple-touch-icon.png`, `sw/sw.js` | Lets you install the app on a phone and open it offline |
| `.env.example` | List of all settings. The real values go into Vercel, **never** into the code |
| `scripts/check-no-secrets.mjs` | Stops the build if an API key ever lands in the public files |

`.gitignore` makes sure `node_modules`, the build folders and any `.env` file are never uploaded.

---

## 2. Create a GitHub account and an empty repository

1. Go to **github.com** → **Sign up** and create an account. Confirm your email.
2. Click **+** (top right) → **New repository**.
3. Repository name: `study-os`. Choose **Private** (recommended).
4. Do **not** tick "Add a README", ".gitignore" or "license". The repository must be empty.
5. Click **Create repository**.

## 3. Upload the code to GitHub

The project folder already contains a prepared git commit. Choose **one** of these ways:

**Option A: Claude pushes it for you (easiest).**
Tell Claude the repository name, for example `yourname/study-os`. Claude can push the code if you
allow access to the repository when asked.

**Option B: GitHub Desktop (no commands).**
1. Install **GitHub Desktop** (desktop.github.com) and sign in with your GitHub account.
2. Unzip `study-os.zip`. Then choose **File → Add local repository** and select the `study-os` folder.
   It is already a git repository.
3. Click **Publish repository**. Untick "Keep this code private" only if you want the code to be public.

**Option C: command line.** In the `study-os` folder:
```bash
git remote add origin https://github.com/YOURNAME/study-os.git
git push -u origin main
```

> Uploading through the GitHub website ("Add file → Upload files") accepts at most 100 files per
> upload, and this project has about 130. Use A, B or C instead.

When it worked, your repository page on github.com lists folders such as `api`, `src` and `server`,
plus `vercel.json`.

## 4. Create the Vercel project

1. Go to **vercel.com** → **Sign Up** → **Hobby** → **Continue with GitHub**, and allow access.
2. On the dashboard, click **Add New… → Project**.
3. Find `study-os` under "Import Git Repository" and click **Import**. If it is missing, click
   **Adjust GitHub App Permissions** and allow the repository.
4. On the configuration screen:
   - **Framework Preset:** Vite (detected automatically). Leave the build settings unchanged;
     `vercel.json` already sets them.
   - **Root Directory:** leave it as `./`.
   - **Environment Variables:** open this section and add the values from step 5. You can also skip
     this for now and add them later.
5. Click **Deploy**. The first build takes 1–3 minutes.
6. When you see "Congratulations", click **Continue to Dashboard**. Under **Domains** you will find
   your address, for example `study-os-abc123.vercel.app`. **That is your website.**

You can change the address under **Settings → Domains**, for example to `my-study-os.vercel.app`
if that name is still free.

## 5. Turn on the AI tutor (optional)

1. Go to **console.anthropic.com**, sign in, buy a small amount of credit under **Billing**, and set
   a **spend limit** (for example €5 per month).
2. Go to **API Keys → Create Key**. Copy the key, which starts with `sk-ant-`. It is only shown once.
3. Make up an **access code** of at least 16 random characters, for example
   `blau-Tiger-7319-Wolke-42`. It protects your credit: without the code, strangers who find your
   web address cannot use the tutor.
4. In Vercel, open your project → **Settings → Environment Variables** and add:

   | Key | Value | Required |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | your `sk-ant-…` key | yes |
   | `APP_ACCESS_TOKEN` | your access code | **yes**. Without it the AI stays locked on Vercel. |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` (default) or a cheaper one: `claude-sonnet-5-5` or `claude-haiku-5-5` | no |
   | `AI_RATE_LIMIT_PER_MIN` | for example `20` | no |

   Leave "Environments" set to All (Production, Preview, Development).
   **Never** add a `VITE_` prefix to these names. `VITE_` variables are copied into the public
   website, and the build refuses names that look like secrets.
5. Environment variables only take effect after a new deployment. Go to **Deployments**, click
   **⋯** next to the newest entry, then **Redeploy**.
6. Open your website → **Einstellungen → KI-Anbieter** → enter the access code in **Zugangscode**.
   The status should change to **"Verfügbar: Anthropic Claude (…)"**. Enter the code once on every
   device and browser you use.

To use OpenAI instead, set `OPENAI_API_KEY` and `OPENAI_MODEL` (the exact model name). For photo
transcription, also set `OPENAI_SUPPORTS_IMAGES=true`. Ollama only works with `npm start` on your
own computer, not on Vercel.

## 6. Test the website

### On the PC (Chrome, Edge or Firefox)
- [ ] Open your `https://…vercel.app` address. The welcome screen ("Lernen mit Plan") appears.
- [ ] Complete the onboarding. The dashboard "Was soll ich heute lernen?" appears.
- [ ] Create a flashcard, start a quiz and answer a question.
- [ ] Reload the page (F5). Everything is still there.
- [ ] Bibliothek → Import: import a PDF and check the extracted text.
- [ ] Open `https://…vercel.app/api/health`. It should show `{"ok":true}`.
- [ ] With AI: Einstellungen → KI-Anbieter → **Server-Verbindung testen** shows "Funktioniert". Then
      ask the tutor a question.
- [ ] Einstellungen → **Sicherung herunterladen (JSON)**. A backup file is downloaded.

### On the Android phone (Chrome)
- [ ] Open the same address in Chrome.
- [ ] Tap the **⋮ menu → "App installieren"** (on some phones: **"Zum Startbildschirm hinzufügen"**).
      A Study OS icon appears on your home screen.
- [ ] Open Study OS from the icon. It opens without the browser bar.
- [ ] Turn on airplane mode and open the app again. It still starts, and your cards are still there.
      Only the tutor needs internet.
- [ ] With AI: enter the access code under Einstellungen → KI-Anbieter.

### Important: data stays on each device
Study OS is **local-first**. Your learning data is stored only in the browser on each device
(IndexedDB), not on Vercel. PC and phone therefore start with **separate** data. To move your data
to another device:
**PC: Einstellungen → Sicherung herunterladen** → send the file to your phone →
**Phone: Einstellungen → Sicherung wiederherstellen**.

Always use the same address, your main `…vercel.app` domain. Vercel also creates extra "preview"
addresses for each deployment. Each address is a different website to the browser, so it has its
own empty storage.

## 7. Updating the website later

Every time new code reaches the `main` branch on GitHub, Vercel builds and publishes it
automatically within about two minutes. If a build fails, the previous version stays online. The
installed app on your phone loads the new version the next time you open it with internet.

## 8. Google sign-in and sync (Supabase project „Study OAS“)

Without sign-in Study OS works exactly as before (data only in this browser). For sign-in and sync between
PC and phone, these settings are needed once. Replace `https://YOUR-SITE.vercel.app` with the address
from Vercel → your project → **Domains**.

**Already done in code / database:** sign-in button, sessions, sync, first-login choice, RLS policies.
The table `public.sync_records` comes from `supabase/migrations/20261025120000_sync_records.sql`
(apply it once – see A).

### A. Database table (once)
Supabase Dashboard → project **Study OAS** → **SQL Editor** → New query → paste the content of
`supabase/migrations/20261025120000_sync_records.sql` → **Run**. Running it twice is harmless.
Check: **Table Editor** shows `sync_records` with the label "RLS enabled".

### B. Google Cloud Console (OAuth client)
1. https://console.cloud.google.com → select or create a project (e.g. "Study OS").
2. **Google Auth Platform → Branding**: app name "Study OS", your e-mail as support and developer contact.
3. **Audience**: User type **External**. While the status is "Testing", add your own Google address under
   **Test users** (or click **Publish app** – the basic scopes need no review).
4. **Data Access (Scopes)**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
5. **Clients → Create client → Web application**, name "Study OS":
   - **Authorized JavaScript origins**: `https://YOUR-SITE.vercel.app` (for local testing also `http://localhost:5173`)
   - **Authorized redirect URIs**: `https://kqxxrnfoshqenewczguv.supabase.co/auth/v1/callback`
6. Create → copy **Client ID** and **Client secret** (the secret is only shown once).

### C. Supabase Dashboard (Auth)
1. **Authentication → Sign In / Providers → Google**: enable, paste Client ID and Client secret, Save.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://YOUR-SITE.vercel.app`
   - **Redirect URLs**: `https://YOUR-SITE.vercel.app/**` and, for local testing, `http://localhost:5173/**`
3. Make sure **Allow new users to sign up** is on (otherwise your first Google sign-in is rejected).

### D. Vercel environment variables
Vercel → project → **Settings → Environment Variables**. If the Supabase integration already created
`SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_…`), nothing is needed. Otherwise add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://kqxxrnfoshqenewczguv.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the **publishable** key from Supabase → Project Settings → API Keys (starts with `sb_publishable_`) |

Never add a `VITE_` prefix to secrets and never use the `service_role` / `sb_secret_` key – Study OS
does not need it, and the server refuses to hand it to the browser. Then **Redeploy**.

### E. Test
1. Open `https://YOUR-SITE.vercel.app/api/config` – it must show your project URL and the publishable key
   (`"supabase": {...}`), not `null`.
2. PC: Einstellungen → **Mit Google anmelden** → choose your account → back in Study OS: decide how to combine
   your data (upload/merge) → status "Synchronisiert …".
3. Phone: open the site → on the welcome screen **Mit Google anmelden** → your data appears.
4. Change something on the phone, wait a few seconds (or "Jetzt synchronisieren") → it appears on the PC.

Files (PDFs, photos) stay on the device where you imported them; their extracted text syncs.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Build fails on Vercel | Open the deployment → **Build Logs** and read the first red error line. Running `npm run build` locally shows the same error. |
| "APP_ACCESS_TOKEN fehlt" in the app | Add `APP_ACCESS_TOKEN` in Vercel, then **Redeploy**. |
| "Zugangscode fehlt oder ist falsch" | Enter exactly the same code as in Vercel. It is case-sensitive. |
| "Der Anthropic-API-Schlüssel ist ungültig" | The key was copied incompletely or deleted. Create a new one, update it in Vercel, then Redeploy. |
| "Zu viele Anfragen oder Guthaben aufgebraucht" | Add credit in the Anthropic console, or wait a minute. |
| Data is missing | You may be on a different address (a preview URL), in a different browser, or in a private window. Restore it from your backup file. |
| No "App installieren" in the menu | Use Chrome, open the site via `https://`, and wait a few seconds after it loads. "Zum Startbildschirm hinzufügen" always works. |
| "Die Anmeldung mit Google ist … noch nicht aktiviert" | Step 8 C1 (Google provider in Supabase). |
| After Google you land on an error page from Supabase / "redirect_uri_mismatch" | The redirect URI in Google (8 B5) must be exactly `https://kqxxrnfoshqenewczguv.supabase.co/auth/v1/callback`; the site address must be in Supabase Redirect URLs (8 C2). |
| "Die Cloud-Datenbank ist noch nicht eingerichtet" | Step 8 A (SQL migration). |
| "Synchronisierung nicht verfügbar" in the settings | Step 8 D (Vercel variables), then Redeploy. |
| Photo transcription says the images are too large | Choose fewer pages at once. The app shrinks photos automatically, but Vercel allows at most about 4.5 MB per request. |

## 10. Running it on your own computer instead (optional)

```bash
npm install
cp .env.example .env      # optional: put your API key here
npm run build
npm start                 # http://localhost:8787
```
