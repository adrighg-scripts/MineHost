# MineHost Dashboard

This directory contains the dashboard, API routes and database schema. GitHub Pages serves the MineHost landing page from `docs/`. The dashboard runs as a Cloudflare Worker because logins, phone pairing, file transfers and server actions need a backend.

## Build and test

Use Node.js 24.

```sh
npm ci
npm run build
npm test
```

The tests use local disposable D1 and R2 instances. They cover account and device isolation, login, pairing, permissions, file transfers and rendered UI. `npm start` runs the built Worker locally.

## Deploy through GitHub Actions

Create a Cloudflare D1 database and R2 bucket for this Worker. In GitHub, create an environment named `dashboard-production`.

| GitHub setting | Value |
| --- | --- |
| Variable `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variables `MINEHOST_D1_ID`, `MINEHOST_D1_NAME` | D1 database UUID and name |
| Variable `MINEHOST_R2_BUCKET` | R2 bucket name |
| Secret `CLOUDFLARE_API_TOKEN` | Account-scoped token authorized to deploy the Worker and apply D1 migrations |
| Secret `AUTH_PEPPER` | Stable, random authentication secret. Keep the original value when migrating existing accounts. |
| Optional secrets `DEVICE_TOKEN_SHA256`, `CURSEFORGE_API_KEY` | Legacy enrollment token hash and CurseForge integration key, if in use |

In **Actions → Dashboard**, select **Run workflow** from `main` and enable `deploy`. The workflow tests the build, applies pending D1 migrations and deploys the Worker. The build logs contain the resulting URL. Pull requests and pushes run validation only.

## Moving an existing MineHost installation

Before changing the production URL, migrate the existing D1 data and any R2 objects that must remain available. Keep the original `AUTH_PEPPER` so existing accounts can sign in. Test authentication, device pairing, status updates and a file transfer against the destination. Once the destination is ready, point the Android app and the dashboard links in `docs/index.html` at it and publish an APK update. Existing browser sessions are scoped to the old hostname.

The GitHub workflow provisions a deployment from source. It does not copy production account data or reconnect installed phones automatically.
