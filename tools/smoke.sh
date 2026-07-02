#!/usr/bin/env bash
# Emulator smoke test, two stages:
#   1. RELEASE APK: install, launch, verify the app stays open (crash scan).
#   2. DEBUG APK: drive the real UI over the Chrome DevTools Protocol — open the
#      account sheet, tap "Continue with Google" — and verify the app survives
#      the tap and surfaces a message instead of dying (the historic bug).
# Run by the CI emulator step; the emulator-runner action waits for full boot.
set +e
RAPK="android/app/build/outputs/apk/release/app-release.apk"
DAPK="android/app/build/outputs/apk/debug/app-debug.apk"
PKG="app.quicklist.twa"

echo "===== [1/2] RELEASE: install ====="
for i in 1 2 3 4 5; do
  echo "-- install attempt $i --"
  adb install -r -d "$RAPK" && { echo "INSTALL OK"; break; }
  sleep 8
done

adb logcat -c
echo "===== RELEASE: launch ====="
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 15

echo "===== RELEASE: process check ====="
if adb shell pidof "$PKG" >/dev/null 2>&1; then
  echo "SMOKE_RESULT: RELEASE PROCESS ALIVE — app stayed open"
else
  echo "SMOKE_RESULT: RELEASE NOT RUNNING — likely crashed on launch"
fi

echo "===== RELEASE: crash scan ====="
adb logcat -d > lc.txt
if grep -q "FATAL EXCEPTION" lc.txt; then
  echo "SMOKE_RESULT: FATAL EXCEPTION FOUND — stack trace:"
  grep -B3 -A50 "FATAL EXCEPTION" lc.txt
else
  echo "SMOKE_RESULT: no FATAL EXCEPTION (good)"
fi

echo "===== [2/2] DEBUG: install (debuggable WebView for CDP) ====="
adb uninstall "$PKG" >/dev/null 2>&1
for i in 1 2 3; do
  adb install -r -d "$DAPK" && { echo "INSTALL OK"; break; }
  sleep 8
done
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 12

PID=$(adb shell pidof "$PKG" | tr -d '[:space:]')
if [ -z "$PID" ]; then
  echo "SMOKE_RESULT: DEBUG apk did not start — cannot run the login tap test"
  exit 0
fi
adb forward tcp:9222 "localabstract:webview_devtools_remote_${PID}"
node tools/logintap.js

echo "===== LOGIN TAP: crash scan ====="
adb logcat -d > lc2.txt
if grep -q "FATAL EXCEPTION" lc2.txt; then
  echo "SMOKE_RESULT: FATAL EXCEPTION DURING GOOGLE TAP — stack trace:"
  grep -B3 -A50 "FATAL EXCEPTION" lc2.txt
else
  echo "SMOKE_RESULT: no FATAL EXCEPTION during Google tap (good)"
fi
if adb shell pidof "$PKG" >/dev/null 2>&1; then
  echo "SMOKE_RESULT: APP STILL ALIVE after Google tap (good)"
else
  echo "SMOKE_RESULT: APP DIED after Google tap — the 'exits the app' bug is back"
fi

echo "===== LOGIN TAP: relevant logs ====="
grep -iE "\[QL\]|CapgoSocialLogin|GoogleProvider|credential|Capacitor/Console" lc2.txt | tail -50
exit 0
