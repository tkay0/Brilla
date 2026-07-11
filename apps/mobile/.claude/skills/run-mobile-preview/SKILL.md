---
name: run-mobile-preview
description: Launch apps/mobile (Expo) in a browser and screenshot it with Playwright. Use whenever asked to run, preview, or show a screen from the Brilla mobile app - this is the verified path, cold-started once already.
---

# Running apps/mobile and screenshotting it

This app has no Android/iOS emulator configured on this machine. "Show me
the screen" means: launch the Expo web preview, drive it with Playwright,
screenshot it, and actually look at the screenshot before reporting
anything.

`chromium-cli` is not available in this environment (confirmed: not on
PATH, not published to the npm registry under that name - don't spend
time re-checking). Use Playwright directly instead.

## 1. Make sure port 8081 is actually free

The most common failure mode here isn't a code bug - it's a **stale dev
server from a previous session still holding the port**, which makes a
plain `pkill -f "expo start"` unreliable on Windows (background node
processes spawned this way often aren't matched by that pattern). If you
skip this check, `expo start` silently falls back to a different port and
prompts interactively to confirm - which hangs forever in a non-interactive
shell, and you'll end up screenshotting the *previous* session's stale
server without realizing it (everything "works" but reflects old code).

```bash
netstat -ano | grep ":8081" | grep LISTENING
# if a PID shows up:
taskkill //F //PID <that-pid>
```

## 2. Launch the dev server

```bash
cd apps/mobile
(npx expo start --web --port 8081 > "$TEMP/expo-web.log" 2>&1 &)
timeout 45 bash -c 'until curl -sf http://localhost:8081 >/dev/null 2>&1; do sleep 2; done' && echo "SERVER UP"
```

Then check the log actually shows a *fresh* "Starting Metro Bundler" (not
just that curl succeeded) - curl succeeding only proves *something* is
listening on the port, not that it's this run's server.

If you see `web support but don't have the required dependencies`, run
`npx expo install react-dom react-native-web` once (already installed as
of this skill being written - kept intentionally for dev-time preview,
not shipped in the native build) and relaunch.

## 3. Playwright setup (one-time per machine/container)

`npx playwright ...` fails with a "install your dependencies first" error
unless playwright is a real local dependency of *some* package.json in the
CWD - a bare `npx playwright install` from a directory with no
package.json won't work. Fastest fix: use (or create) a scratch npm
project.

```bash
cd <scratchpad dir>
npm init -y && npm install playwright
npx playwright install chromium
```

## 4. Drive it and screenshot

Write a small script (not a one-liner - you want console error capture):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  // React Native Web's ScrollView content does NOT report its height to
  // the document, so Playwright's `fullPage: true` screenshot only
  // captures the viewport, not the true scrollable content - size the
  // viewport tall enough up front instead of relying on fullPage.
  const page = await browser.newPage({ viewport: { width: 420, height: 1500 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=<something only present once real content has rendered>', { timeout: 30000 });
  await page.waitForTimeout(1000); // let custom fonts finish swapping in
  await page.screenshot({ path: 'out.png' });

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
```

Read the resulting PNG with the Read tool and actually look at it - a
blank or default-font frame is a failure to launch, not success. Check
`errors` is empty before declaring anything works: RN Web can render a
shell while a native-only API throws in the console.

## 5. Clean up afterward

```bash
netstat -ano | grep ":8081" | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //F //PID {}
```

Do this before ending the turn - an orphaned dev server is exactly what
causes step 1's stale-server trap for the *next* session.
