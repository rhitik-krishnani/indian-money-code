<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4c025261-be66-43de-8f13-67783aade25a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Building the Android app

### Option A - Cloud build (no local Android SDK needed)
Push this repo to GitHub. The included `.github/workflows/android-build.yml` will
automatically build a **debug APK** on every push to `main` and attach it as a
downloadable workflow artifact (Actions tab → latest run → Artifacts). This is the
fastest way to get an installable APK without setting up Android Studio.

### Option B - Local build
Prerequisites: [Android Studio](https://developer.android.com/studio) (installs the
Android SDK) or the SDK command-line tools + a JDK 17-21.

```bash
npm install
npm run build          # builds the web bundle + syncs it into android/
cd android
./gradlew assembleDebug
```

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.
Transfer it to an Android phone and install it (enable "install from unknown
sources" if prompted).

### Signing a release build
Play Store submissions need a **signed** APK/AAB. Generate a keystore once:

```bash
keytool -genkeypair -v -keystore release.keystore \
  -alias indianmoneycode -keyalg RSA -keysize 2048 -validity 10000
```

Keep `release.keystore` and its passwords private - never commit them.

- **Locally**: place `release.keystore` in `android/app/`, then run
  `ANDROID_KEYSTORE_PASSWORD=... ANDROID_KEY_ALIAS=indianmoneycode ANDROID_KEY_PASSWORD=... ./gradlew bundleRelease`
  from `android/`.
- **In CI**: base64-encode the keystore (`base64 -i release.keystore | pbcopy` on
  Mac, or `base64 -w0 release.keystore` on Linux) and add these as GitHub Actions
  repo secrets (Settings → Secrets and variables → Actions):
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`. The workflow will then also produce a signed
  `app-release.aab` ready to upload to the Play Console.

## Building the iOS app

iOS builds require Xcode, which only runs on macOS - there is no cloud-free path
here the way there is for Android. On a Mac:

```bash
npm install && npm run build
npx cap sync ios
npx cap open ios
```

Then in Xcode: select your Apple Developer Team under Signing & Capabilities, plug
in an iPhone (or pick a simulator), and hit Run. For distribution builds you'll
need an Apple Developer Program membership ($99/yr) to archive and upload to
TestFlight/App Store Connect. If you don't have a Mac, cloud CI services like
Codemagic or GitHub Actions' `macos-latest` runners can build and sign iOS apps
using certificates you upload as secrets.

