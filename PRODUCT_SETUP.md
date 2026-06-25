# Product Setup Guide

This app is now prepared for a public-friendly path:

- Mobile-first React UI
- Optional Supabase login
- Supabase PostgreSQL transaction storage
- LocalStorage fallback while Supabase is not configured
- Capacitor Android packaging

## 1. Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run the full contents of `supabase-schema.sql`.
4. Go to Project Settings > API.
5. Copy:
   - Project URL
   - anon public key
6. Create a `.env` file in this project:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

7. Restart the dev server.

When these keys are present, the app shows login/signup and syncs transactions to Supabase.

## 2. Local Development

```bash
npm install
npm run dev
```

For production-style local testing:

```bash
npm run build
npm start
```

## 3. Database Tables

The first version uses:

- `transactions`
- `user_settings`

Every row is protected with Row Level Security so users only access their own data.

## 4. Deployment

For web hosting:

Build command:

```bash
npm install && npm run build
```

Preview command:

```bash
npm start
```

Environment variables:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 5. Android App

The native Android project is in `android/`.

App id:

```text
com.meroxio.expensemanager
```

After changing React code, sync it into Android:

```bash
npm run android:sync
```

Open Android Studio:

```bash
npm run android:open
```

In Android Studio:

1. Let Gradle finish syncing.
2. Connect a phone or start an emulator.
3. Click Run to test the app.
4. For Play Store, use Build > Generate Signed Bundle / APK.
5. Choose Android App Bundle (`.aab`), not APK, for Play Store upload.

Current machine note:

```text
Gradle build was not completed because JAVA_HOME is not set and `java` is not available in PATH.
Install Android Studio first, then open this project from Android Studio.
```

## 6. What You Need To Provide

- App icon
- Privacy policy text/page
- Google Play Console account
- Final Play Store app name
- Short and full store description
- Screenshots from the Android app
- Final app icon

Already configured locally:

- Supabase Project URL
- Supabase anon key
- App name: Expense Manager
