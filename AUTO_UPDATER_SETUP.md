# Operon Auto-Updater Setup Guide

This guide walks you through the one-time setup required to enable Operon's built-in auto-update system. Once configured, every tagged release on GitHub will automatically generate signed update bundles that the app checks for on launch.

## Prerequisites

- Node.js 18+ installed
- Access to the GitHub repo `swaruplab/operon` with admin permissions (to add secrets)
- Your local Operon repo at: `/Users/vivek-mbp/SwarupLab Dropbox/Vivek Swarup/SwarupLab/Codes/operon_crossplatform`

## Step 1: Generate the Signing Keypair

Tauri's updater requires every update bundle to be cryptographically signed. You generate a keypair once and use it for all future releases.

Open Terminal and run:

```bash
cd "/Users/vivek-mbp/SwarupLab Dropbox/Vivek Swarup/SwarupLab/Codes/operon_crossplatform"
npx tauri signer generate -w ~/.tauri/operon.key
```

You'll be prompted to enter a password. Choose a strong password and save it somewhere secure (you'll need it in Step 3).

This generates two things:

- **Private key file**: `~/.tauri/operon.key` — this signs your update bundles. Never commit this to git.
- **Public key**: printed to the terminal as a long base64 string starting with `dW50cnVzdGVk...`. Copy this entire string.

## Step 2: Add the Public Key to tauri.conf.json

Open the Tauri config file:

```
src-tauri/tauri.conf.json
```

Find the `plugins.updater` section (already added) and paste your public key:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/swaruplab/operon/releases/latest/download/latest.json"
    ],
    "pubkey": "PASTE_YOUR_PUBLIC_KEY_HERE"
  }
}
```

Replace `PASTE_YOUR_PUBLIC_KEY_HERE` with the full base64 public key string from Step 1.

Save the file and commit the change:

```bash
git add src-tauri/tauri.conf.json
git commit -m "Add updater public key for auto-updates"
```

## Step 3: Add GitHub Repository Secrets

Go to your GitHub repo settings:

```
https://github.com/swaruplab/operon/settings/secrets/actions
```

Click **"New repository secret"** and add these two secrets:

### Secret 1: TAURI_SIGNING_PRIVATE_KEY

- **Name**: `TAURI_SIGNING_PRIVATE_KEY`
- **Value**: The full contents of `~/.tauri/operon.key`

To copy the key contents:

```bash
cat ~/.tauri/operon.key | pbcopy
```

This copies the private key to your clipboard. Paste it as the secret value.

### Secret 2: TAURI_SIGNING_PRIVATE_KEY_PASSWORD

- **Name**: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Value**: The password you chose when generating the key in Step 1

## Step 4: Push and Create a Release

Push your changes to the `cross-platform` branch, then when you're ready to release:

```bash
# Make sure everything is committed and pushed
git push origin cross-platform

# When ready to release, tag with a version
git tag v0.5.0
git push origin v0.5.0
```

The `v*` tag push triggers the release workflow (`.github/workflows/release.yml`), which will:

1. Build Operon for all 4 platforms (macOS ARM, macOS Intel, Windows x64, Linux x64)
2. Sign each bundle with your private key
3. Generate `latest.json` — the update manifest the app checks
4. Upload everything to a GitHub Release as a draft

After the workflow completes, go to **GitHub → Releases**, review the draft, and click **"Publish release"**.

## How It Works After Setup

Once a release is published:

1. When a user opens Operon, the `UpdateChecker` component silently checks `https://github.com/swaruplab/operon/releases/latest/download/latest.json` after a 5-second delay
2. If a newer version exists, a notification appears in the top bar: **"v0.6.0 available"** with an **"Update"** button
3. Clicking "Update" downloads the signed bundle and shows a progress bar
4. When complete, a **"Restart"** button appears to apply the update
5. The app relaunches with the new version

## Verifying the Setup

After your first release, verify everything works:

1. Install the released version of Operon
2. Create a new tag with a bumped version (e.g., `v0.5.1`)
3. Push the tag and publish the release
4. Open the older installed version — you should see the update notification in the top bar

## Troubleshooting

**"pubkey is empty" error at build time**: You haven't pasted the public key into `tauri.conf.json` yet. Complete Step 2.

**Update check fails silently**: The `latest.json` file might not be in the release. Make sure `TAURI_SIGNING_PRIVATE_KEY` is set in GitHub secrets — `tauri-action` only generates the updater manifest when this secret is present.

**Signature verification failed**: The public key in `tauri.conf.json` doesn't match the private key used to sign. Regenerate the keypair and update both the config and the GitHub secret.

**No update notification appears**: The app only checks once on launch (after 5s). Restart the app to trigger another check. Also verify the release is published (not still a draft) — the endpoint URL uses `/latest/` which only resolves to published releases.

## File Reference

| File | Purpose |
|------|---------|
| `~/.tauri/operon.key` | Private signing key (local only, never commit) |
| `src-tauri/tauri.conf.json` | Contains public key + updater endpoint URL |
| `.github/workflows/release.yml` | Release workflow that builds, signs, and uploads |
| `src/components/layout/UpdateChecker.tsx` | Frontend component that checks for and applies updates |
| `src/components/layout/TopBar.tsx` | Where UpdateChecker is rendered |
| `src-tauri/Cargo.toml` | `tauri-plugin-updater` + `tauri-plugin-process` deps |
| `src-tauri/src/lib.rs` | Plugin registration |
