---
name: run-mobile-preview
description: Launch and verify apps/mobile (Expo). Android emulator is the real verification target - use it before calling any screen or phase done. Web preview (Playwright) is fine only for a quick mid-task glance, never as the final check, since it has already missed at least one native-only bug. Use whenever asked to run, show, or verify a screen from the Brilla mobile app.
---

# Running and verifying apps/mobile

**Android emulator is the real check.** Web preview renders through
react-native-web, a different implementation from what ships - it has
already missed at least one native-only bug. Use web only for a fast
glance mid-task; before calling any screen or phase done, confirm it
actually renders correctly in the Android build.

## Android emulator (the real check)

### 0. One-time environment setup

The Android SDK is installed but not on PATH/env vars by default in this
shell. Export these in every command block that touches `adb`/`emulator`/
gradle (each Bash call is a fresh shell - nothing persists):

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"   # bundled JDK 21 - required for the Gradle build, the JDK 8 on PATH is too old
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:$PATH"
```

### 1. Confirm/boot the emulator

An AVD named `Pixel_4` already exists. Check first - an instance is
often already running:

```bash
adb devices
# looking for a line like "emulator-5554	device" (not "offline")
```

If nothing is listed, boot it (headless is fine, and avoids popping a
window):

```bash
(emulator -avd Pixel_4 -no-window -no-audio > "$TEMP/emulator.log" 2>&1 &)
adb wait-for-device
timeout 90 bash -c 'until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" = "1" ]; do sleep 3; done' && echo "BOOTED"
```

### 2. Build and install

```bash
cd apps/mobile
npx expo run:android > "$TEMP/expo-run-android.log" 2>&1
```

This does an implicit prebuild (generates `android/`, already gitignored -
don't hand-edit anything under it, it's regenerated) then a full Gradle
build and install. **First build is slow (several minutes)** - run this
`run_in_background: true` and wait for the notification rather than
polling. `metro` stays attached afterward serving JS to the installed app;
leave it running while you interact with the device.

If the log shows a Java version error, `JAVA_HOME` didn't take - re-check
step 0 was exported in *this* command's shell, not a previous one.

### 3. Drive it and screenshot

No Playwright needed here - `adb` talks to the real app directly.

```bash
# Screenshot: exec-out avoids the CRLF corruption that `adb shell screencap` + `pull`
# produces on Windows (the file comes back with mangled bytes otherwise).
adb exec-out screencap -p > out.png

# Tap by coordinates (get them from the screenshot - screen is 1080x2340 on this AVD)
adb shell input tap <x> <y>

# Or by text isn't native to adb - for tab/button taps, read approximate coordinates off
# the screenshot you just took rather than trying to query the view hierarchy.
```

Read the resulting PNG with the Read tool and look at it. Take a
before/after pair around any interaction (tab switch, button press) the
same way the web-preview flow does.

### 4. Clean up

Leave the emulator running between turns if you expect to verify again
soon (rebooting it is the slowest part of this whole loop). Only kill it
if told to, or if switching away from Android work for a while:

```bash
adb -s emulator-5554 emu kill
```

Do **not** kill the Metro process between screenshots within the same
verification pass - the installed app is still connected to it for JS
updates (Fast Refresh), and killing it forces a full rebuild next time.

## Web preview (quick glance only, not the final check)

Still useful for a fast visual sanity check mid-task, before spending the
minutes on a full Android build. Same caveats as before: `chromium-cli`
isn't available in this environment (confirmed, don't re-check) - use
Playwright directly.

### Port check

Stale dev servers from a previous session are the most common failure
mode, not a code bug - `pkill -f "expo start"` is unreliable on Windows
for background-spawned node processes.

```bash
netstat -ano | grep ":8081" | grep LISTENING
# if a PID shows up:
taskkill //F //PID <that-pid>
```

### Launch

```bash
cd apps/mobile
(npx expo start --web --port 8081 > "$TEMP/expo-web.log" 2>&1 &)
timeout 45 bash -c 'until curl -sf http://localhost:8081 >/dev/null 2>&1; do sleep 2; done' && echo "SERVER UP"
```

Confirm the log shows a *fresh* "Starting Metro Bundler", not just that
curl succeeded (curl only proves something is listening, possibly a
stale server).

### Playwright setup (one-time per machine/container)

Needs a real local `package.json` dependency to install into - a bare
`npx playwright install` from a directory with none fails.

```bash
cd <scratchpad dir>
npm init -y && npm install playwright
npx playwright install chromium
```

### Screenshot script

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  // RN Web's ScrollView content doesn't report height to the document, so
  // `fullPage: true` only captures the viewport - size it tall up front instead.
  const page = await browser.newPage({ viewport: { width: 420, height: 1500 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=<something only present once real content has rendered>', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'out.png' });

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
```

### Clean up

```bash
netstat -ano | grep ":8081" | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //F //PID {}
```
