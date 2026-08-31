# 🚀 Expo Cloud (EAS) Mobile App Deployment Guide

This guide details step-by-step instructions to build, release, and deploy the **WorknAI HRMS Mobile Application** to **Expo Application Services (EAS Cloud)**, Google Play Store, and Apple App Store.

---

## 📋 Prerequisites
1. **Expo Developer Account**: Register at [expo.dev](https://expo.dev).
2. **EAS CLI**: Installed globally on your machine (`npm install -g eas-cli`).
3. **Google Play Console Account** (for Android production releases).
4. **Apple Developer Program Account** (for iOS App Store / TestFlight releases).

---

## 🛠️ Step 1: Install EAS CLI & Log In
Run the following commands in your terminal:
```bash
npm install -g eas-cli
eas login
```
Verify login status:
```bash
eas whoami
```

---

## ⚙️ Step 2: Initialize & Link Project
Navigate to the `mobile` directory and link the project to your Expo account:
```bash
cd mobile
eas init
```
This will automatically link your project slug (`workn-ai-hrms`) and update `app.json` with your unique `extra.eas.projectId`.

---

## 🔐 Step 3: Configure Environment Variables
Set your production backend API URL in EAS Cloud secrets:
```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value "https://api.hrms.yourdomain.com/api"
```

---

## 📦 Step 4: Build Mobile App on Expo Cloud

Expo Cloud compiles standalone Android and iOS binaries without needing local Android Studio or Xcode setups.

### Option A: Internal Preview Build (Android APK)
Great for distribution to internal QA testers via QR code or direct APK download link:
```bash
eas build --platform android --profile preview
```

### Option B: Production Android Build (AAB for Google Play Store)
Generates an Android App Bundle (`.aab`) signed for store distribution:
```bash
eas build --platform android --profile production
```

### Option C: Production iOS Build (IPA for App Store / TestFlight)
Generates an Apple iOS App Store package (`.ipa`):
```bash
eas build --platform ios --profile production
```

---

## 🚀 Step 5: Submit Builds to App Stores (EAS Submit)

Submit your build artifacts directly from Expo Cloud to app stores with a single command:

### Submit to Google Play Store:
```bash
eas submit --platform android --profile production
```

### Submit to Apple App Store / TestFlight:
```bash
eas submit --platform ios --profile production
```

---

## ⚡ Step 6: Over-The-Air (OTA) Instant Updates
Push instant bug fixes or UI enhancements to user devices without requiring users to re-download the app from app stores:
```bash
eas update --channel production --message "Instant bugfix update v1.0.1"
```
The **UpdateManager** component will detect the new version silently on launch and notify users accordingly based on your backend priority pattern (`optional`, `recommended`, `important`, `critical`, `maintenance`).
