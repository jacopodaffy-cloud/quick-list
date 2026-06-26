#!/usr/bin/env bash
# Emulator smoke test: install the release APK, launch it, and report whether it
# stays open (dumping the crash stack trace if not). Run by the CI emulator step.
# The android-emulator-runner action already waits for full boot before this runs.
set +e
APK="android/app/build/outputs/apk/release/app-release.apk"

echo "===== INSTALL ====="
for i in 1 2 3 4 5; do
  echo "-- install attempt $i --"
  adb install -r -d "$APK" && { echo "INSTALL OK"; break; }
  sleep 8
done

adb logcat -c
echo "===== LAUNCH ====="
adb shell monkey -p app.quicklist.twa -c android.intent.category.LAUNCHER 1
sleep 15

echo "===== PROCESS CHECK ====="
if adb shell pidof app.quicklist.twa >/dev/null 2>&1; then
  echo "SMOKE_RESULT: PROCESS ALIVE — app stayed open"
else
  echo "SMOKE_RESULT: NOT RUNNING — likely crashed on launch"
fi

echo "===== CRASH SCAN ====="
adb logcat -d > lc.txt
if grep -q "FATAL EXCEPTION" lc.txt; then
  echo "SMOKE_RESULT: FATAL EXCEPTION FOUND — stack trace:"
  grep -B3 -A50 "FATAL EXCEPTION" lc.txt
else
  echo "SMOKE_RESULT: no FATAL EXCEPTION (good)"
fi

echo "===== RELEVANT LOGS ====="
grep -iE "quicklist|googleauth|firebase|google|AndroidRuntime|Capacitor|chromium" lc.txt | tail -60
exit 0
