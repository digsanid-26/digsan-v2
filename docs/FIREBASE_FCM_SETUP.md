# Firebase Cloud Messaging (FCM) Setup Guide

Panduan lengkap setup Firebase Cloud Messaging untuk Digsan V2:
- Backend API (NestJS) — untuk send notifications
- Web App (Next.js) — untuk receive notifications di browser
- Mobile App (Flutter) — untuk receive notifications di Android & iOS

---

## Daftar Isi

1. [Setup Firebase Project](#1-setup-firebase-project)
2. [Dapatkan Firebase Admin SDK Credentials (Backend)](#2-dapatkan-firebase-admin-sdk-credentials-backend)
3. [Setup Firebase Web (Next.js)](#3-setup-firebase-web-nextjs)
4. [Setup Firebase Android (Flutter)](#4-setup-firebase-android-flutter)
5. [Setup Firebase iOS (Flutter)](#5-setup-firebase-ios-flutter)
6. [Testing FCM](#6-testing-fcm)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Setup Firebase Project

### Langkah 1: Buat Project

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Klik **"Add project"** atau **"Create a project"**
3. Masukkan nama project: `digsanid` (atau nama lain)
4. Pilih apakah mau enable Google Analytics (opsional, recommended **Yes**)
5. Pilih Analytics Account (atau buat baru)
6. Klik **Create Project** → tunggu ~30 detik

### Langkah 2: Enable Cloud Messaging

1. Di sidebar, klik **Build** → **Cloud Messaging**
2. FCM otomatis enabled untuk project baru (gratis, unlimited)

### Langkah 3: Catat Project ID

Di **Project Settings** (gear icon kanan atas):
```
Project ID: digsanid-6dbf6
Project Number: 333664323360
Web API Key: AIzaSyXXXXXX...
```

---

## 2. Dapatkan Firebase Admin SDK Credentials (Backend)

Backend API butuh **Service Account** untuk kirim notifikasi ke device.

### Langkah 1: Generate Service Account Key

1. Di Firebase Console → **Project Settings** (⚙️ gear icon)
2. Tab **Service accounts**
3. Pilih **Firebase Admin SDK**
4. Pilih bahasa **Node.js**
5. Klik **"Generate new private key"**
6. Klik **"Generate key"** di dialog konfirmasi
7. File JSON akan didownload otomatis, contoh:
   `digsanid-6dbf6-firebase-adminsdk-abc123-xyz.json`

### Langkah 2: Format File JSON

File JSON berisi:

```json
{
  "type": "service_account",
  "project_id": "digsanid-6dbf6",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-abc123@digsanid-6dbf6.iam.gserviceaccount.com",
  "client_id": "111222333444555666777",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-abc123%40digsanid-6dbf6.iam.gserviceaccount.com"
}
```

### Langkah 3: Extract Credentials untuk .env

Dari file JSON, ambil 3 nilai ini:

| Env Variable | JSON Key | Contoh |
|--------------|----------|--------|
| `FIREBASE_PROJECT_ID` | `project_id` | `digsanid-6dbf6` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` | `firebase-adminsdk-abc123@digsanid-6dbf6.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `private_key` | `-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n` |

### Langkah 4: Setup .env

```env
FIREBASE_PROJECT_ID="digsanid-6dbf6"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-abc123@digsanid-6dbf6.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**⚠️ PENTING tentang `FIREBASE_PRIVATE_KEY`:**

1. **Harus diapit `"..."` (double quotes)**
2. **Semua `\n` harus tetap ada sebagai literal** — JANGAN diganti dengan newline beneran
3. **Pastikan `-----BEGIN PRIVATE KEY-----` dan `-----END PRIVATE KEY-----` utuh**

Contoh private key yang SALAH:
```env
# ❌ SALAH (newline asli)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSj...
-----END PRIVATE KEY-----"

# ❌ SALAH (tidak pakai quotes)
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----
```

Contoh yang BENAR:
```env
# ✅ BENAR (literal \n dalam quotes)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSj...\n-----END PRIVATE KEY-----\n"
```

### Langkah 5: Load di NestJS

Di backend API, private key biasanya di-parse:

```typescript
// firebase.service.ts
import * as admin from 'firebase-admin';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
```

### 🔒 Security Best Practices

1. **JANGAN commit file JSON service account ke git**
   - Sudah di-ignore: `*-firebase-adminsdk-*.json`
   - Simpan di tempat aman (password manager, vault)

2. **Untuk production:**
   - Gunakan Secret Manager (AWS Secrets Manager, GCP Secret Manager)
   - Atau environment variables di hosting provider
   - Rotate keys setiap 6-12 bulan

3. **Jika key ter-leak:**
   - Segera revoke di Firebase Console
   - Generate key baru
   - Update semua deployment

---

## 3. Setup Firebase Web (Next.js)

### Langkah 1: Register Web App

1. Di Firebase Console → **Project Settings** → **General**
2. Scroll ke **"Your apps"**
3. Klik icon **Web** (`</>`)
4. App nickname: `digsan-web`
5. Centang **"Also set up Firebase Hosting"** (opsional)
6. Klik **"Register app"**

### Langkah 2: Copy Config

Firebase akan menampilkan config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXX",
  authDomain: "digsanid-6dbf6.firebaseapp.com",
  projectId: "digsanid-6dbf6",
  storageBucket: "digsanid-6dbf6.appspot.com",
  messagingSenderId: "333664323360",
  appId: "1:333664323360:web:abc123def456",
  measurementId: "G-XXXXXXXXX"
};
```

### Langkah 3: Generate VAPID Key (untuk Web Push)

1. Di **Project Settings** → tab **Cloud Messaging**
2. Scroll ke **"Web Push certificates"**
3. Klik **"Generate key pair"**
4. Copy key yang muncul, contoh: `BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U`

### Langkah 4: Install Firebase di Next.js

```powershell
cd apps/web
pnpm add firebase
```

### Langkah 5: Setup Environment Variables

`apps/web/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=digsanid-6dbf6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=digsanid-6dbf6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=digsanid-6dbf6.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=333664323360
NEXT_PUBLIC_FIREBASE_APP_ID=1:333664323360:web:abc123def456
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
```

### Langkah 6: Setup Firebase Client

`apps/web/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase messaging not supported:', error);
  }
}

export { app, messaging };

/**
 * Request permission & get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!token) {
      console.warn('No FCM token available');
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Listen to foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return;
  return onMessage(messaging, callback);
}
```

### Langkah 7: Setup Service Worker

`apps/web/public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyXXXXXXXXXX",
  authDomain: "digsanid-6dbf6.firebaseapp.com",
  projectId: "digsanid-6dbf6",
  storageBucket: "digsanid-6dbf6.appspot.com",
  messagingSenderId: "333664323360",
  appId: "1:333664323360:web:abc123def456",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload);

  const notificationTitle = payload.notification?.title || 'Digsan';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/badge.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(urlToOpen));
});
```

### Langkah 8: Gunakan di Component

```typescript
// apps/web/src/app/layout.tsx atau component lain
'use client';

import { useEffect } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase';

export function NotificationHandler() {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => console.log('SW registered:', registration))
        .catch((error) => console.error('SW registration failed:', error));
    }

    // Request permission & get token
    requestNotificationPermission().then(async (token) => {
      if (token) {
        console.log('FCM Token:', token);
        // Send token ke backend untuk disimpan
        await fetch('/api/notifications/register-device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ fcmToken: token, platform: 'web' }),
        });
      }
    });

    // Listen foreground messages
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message:', payload);
      // Show toast atau custom notification UI
      alert(`${payload.notification.title}: ${payload.notification.body}`);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return null;
}
```

---

## 4. Setup Firebase Android (Flutter)

### Langkah 1: Register Android App

1. Di Firebase Console → **Project Settings** → **General**
2. Klik **"Add app"** → pilih icon **Android**
3. **Package name**: `id.digsan.mobile` (harus match dengan `applicationId` di `apps/mobile/android/app/build.gradle`)
4. **App nickname**: `Digsan Mobile`
5. **Debug signing certificate SHA-1** (opsional tapi recommended):
   ```powershell
   cd apps/mobile
   cd android
   ./gradlew signingReport
   # Copy SHA-1 untuk 'debug' variant
   ```
6. Klik **"Register app"**

### Langkah 2: Download google-services.json

1. Download file `google-services.json`
2. Simpan di: `apps/mobile/android/app/google-services.json`

### Langkah 3: Install FlutterFire CLI (Recommended)

```powershell
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Konfigurasi otomatis
cd apps/mobile
flutterfire configure --project=digsanid-6dbf6
```

FlutterFire CLI akan:
- Download `google-services.json` (Android)
- Download `GoogleService-Info.plist` (iOS)
- Generate `firebase_options.dart`
- Update Android & iOS config files

### Langkah 4: Manual Configuration (jika tidak pakai FlutterFire CLI)

`apps/mobile/android/build.gradle`:

```gradle
buildscript {
    dependencies {
        // ... existing dependencies
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

`apps/mobile/android/app/build.gradle`:

```gradle
// Di paling bawah file
apply plugin: 'com.google.gms.google-services'

android {
    defaultConfig {
        applicationId "id.digsan.mobile"
        minSdkVersion 21  // Minimal 21 untuk FCM
        // ...
    }
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'com.google.firebase:firebase-analytics'
}
```

### Langkah 5: Install Flutter Packages

```powershell
cd apps/mobile

flutter pub add firebase_core
flutter pub add firebase_messaging
flutter pub add flutter_local_notifications
flutter pub add permission_handler
```

### Langkah 6: Initialize Firebase di main.dart

`apps/mobile/lib/main.dart`:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';  // Generated by flutterfire configure

// Background message handler (harus top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  print('Background message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // Register background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(const MyApp());
}
```

### Langkah 7: Buat FCM Service

`apps/mobile/lib/core/services/fcm_service.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class FcmService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  /// Initialize FCM
  Future<void> initialize() async {
    // Request permission (iOS & Android 13+)
    await _requestPermission();

    // Setup local notifications
    await _setupLocalNotifications();

    // Get FCM token
    final token = await getToken();
    print('FCM Token: $token');

    // Listen token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      print('FCM Token refreshed: $newToken');
      _sendTokenToBackend(newToken);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle message when app opened from notification
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app opened from terminated state via notification
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  /// Request notification permission
  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    print('Permission status: ${settings.authorizationStatus}');
  }

  /// Setup local notifications (untuk tampilkan notif di foreground)
  Future<void> _setupLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    
    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: (response) {
        print('Notification tapped: ${response.payload}');
        // Handle navigation
      },
    );
  }

  /// Get FCM token
  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (e) {
      print('Error getting token: $e');
      return null;
    }
  }

  /// Send token to backend
  Future<void> _sendTokenToBackend(String token) async {
    // Implement di repository Anda
    // await notificationRepository.registerDevice(token, platform: 'android');
  }

  /// Handle message saat app di foreground
  void _handleForegroundMessage(RemoteMessage message) {
    print('Foreground message: ${message.notification?.title}');

    // Tampilkan local notification
    final notification = message.notification;
    if (notification != null) {
      _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'digsan_channel',
            'Digsan Notifications',
            channelDescription: 'Main notification channel',
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: DarwinNotificationDetails(),
        ),
        payload: message.data.toString(),
      );
    }
  }

  /// Handle saat user tap notification
  void _handleNotificationTap(RemoteMessage message) {
    print('Notification tapped: ${message.data}');
    // Navigate berdasarkan data
    // contoh: if (message.data['type'] == 'chat') { router.go('/chat/${message.data['roomId']}'); }
  }

  /// Subscribe to topic
  Future<void> subscribeToTopic(String topic) async {
    await _messaging.subscribeToTopic(topic);
  }

  /// Unsubscribe from topic
  Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging.unsubscribeFromTopic(topic);
  }
}
```

### Langkah 8: Register Service di DI

`apps/mobile/lib/core/di/injection.dart`:

```dart
import '../services/fcm_service.dart';

Future<void> configureDependencies() async {
  // ... existing code
  
  // FCM Service
  getIt.registerLazySingleton<FcmService>(() => FcmService());
}
```

### Langkah 9: Initialize di Main

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  await configureDependencies();
  
  // Initialize FCM setelah login
  // (atau langsung jika mau anonymous)
  await getIt<FcmService>().initialize();
  
  runApp(const MyApp());
}
```

### Langkah 10: Update AndroidManifest.xml

`apps/mobile/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application>
        <!-- Default notification icon & color -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_launcher" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/notification_color" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="digsan_channel" />
    </application>
</manifest>
```

---

## 5. Setup Firebase iOS (Flutter)

### Langkah 1: Register iOS App

1. Firebase Console → **Add app** → pilih **iOS**
2. **Bundle ID**: `id.digsan.mobile` (match dengan Xcode)
3. Download **GoogleService-Info.plist**
4. Letakkan di: `apps/mobile/ios/Runner/GoogleService-Info.plist`
5. Tambahkan file ke Xcode project (drag & drop di Xcode)

### Langkah 2: Enable Push Notifications di Xcode

1. Buka `apps/mobile/ios/Runner.xcworkspace` di Xcode
2. Pilih **Runner** target → **Signing & Capabilities**
3. Klik **+ Capability** → tambahkan:
   - **Push Notifications**
   - **Background Modes** → centang **Remote notifications**

### Langkah 3: APNs Setup (Untuk iOS Production)

1. Buka [Apple Developer Console](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Keys**
3. Buat key baru dengan **Apple Push Notifications service (APNs)**
4. Download `.p8` file
5. Upload ke Firebase Console:
   - **Project Settings** → **Cloud Messaging** → **Apple app configuration**
   - Upload `.p8` file + Key ID + Team ID

### Langkah 4: Update Info.plist

`apps/mobile/ios/Runner/Info.plist`:

```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

### Langkah 5: Update AppDelegate.swift

`apps/mobile/ios/Runner/AppDelegate.swift`:

```swift
import UIKit
import Flutter
import Firebase
import FirebaseMessaging

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FirebaseApp.configure()
    
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as? UNUserNotificationCenterDelegate
    }
    
    application.registerForRemoteNotifications()
    
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

---

## 6. Testing FCM

### Test dari Firebase Console

1. Firebase Console → **Cloud Messaging** → **Send test message**
2. Klik **"New campaign"** → **Notification**
3. Isi title & body
4. Target: **User segment** (all) atau **FCM registration token** (untuk test 1 device)
5. Paste FCM token dari log aplikasi
6. Send

### Test dari Backend API

```bash
# Register device
curl -X POST http://localhost:4000/api/notifications/register-device \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fcmToken": "dYourFCMTokenHere...",
    "platform": "android"
  }'

# Send notification (admin only)
curl -X POST http://localhost:4000/api/admin/notifications/send \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "title": "Test Notification",
    "body": "Hello from Digsan!",
    "data": { "type": "test" }
  }'
```

### Test Background Message

1. Close app completely (swipe dari recent apps)
2. Kirim notification dari Firebase Console
3. Notification harus muncul di notification tray
4. Tap notification → app harus terbuka dengan route yang sesuai

---

## 7. Troubleshooting

### Backend: "FIREBASE_PRIVATE_KEY invalid"

**Penyebab**: Format private key salah.

**Fix**:
```typescript
// Pastikan replace \n jadi newline beneran
privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
```

Atau di `.env`:
```env
# Literal \n, dalam double quotes
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

### Web: "Messaging: This browser doesn't support the API's required"

**Penyebab**: Browser tidak support, atau HTTPS tidak aktif.

**Fix**:
- FCM Web hanya works di **HTTPS** (kecuali localhost)
- Browser support: Chrome, Firefox, Edge (Safari limited)
- Pastikan service worker registered di `/firebase-messaging-sw.js`

### Android: "Default FirebaseApp is not initialized"

**Penyebab**: `google-services.json` tidak ada atau salah lokasi.

**Fix**:
- Pastikan file di `apps/mobile/android/app/google-services.json`
- Pastikan `apply plugin: 'com.google.gms.google-services'` ada di `build.gradle`
- Clean & rebuild: `flutter clean && flutter pub get && flutter run`

### Android: Token null

**Penyebab**: Google Play Services tidak available atau permission denied.

**Fix**:
- Android 13+ butuh runtime permission `POST_NOTIFICATIONS`
- Pastikan Google Play Services updated di device
- Test di real device (bukan emulator tanpa Google Services)

### iOS: Notification tidak muncul

**Penyebab**: APNs certificate belum di-upload ke Firebase.

**Fix**:
- Upload `.p8` APNs key ke Firebase Console
- Enable **Push Notifications** capability di Xcode
- Test di real device (simulator tidak support push)

### Token berubah-ubah

**Normal behavior**: FCM token bisa refresh karena:
- App install/reinstall
- Data cleared
- Token expired (setelah beberapa bulan)
- Backup/restore

**Fix**: Selalu handle `onTokenRefresh` dan update backend.

---

## Resources

- [Firebase Console](https://console.firebase.google.com)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FlutterFire Docs](https://firebase.flutter.dev)
- [Firebase Admin SDK (Node.js)](https://firebase.google.com/docs/admin/setup)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)

---

## Checklist Setup

### Backend (NestJS)
- [ ] Firebase project created
- [ ] Service account key generated (JSON file)
- [ ] `FIREBASE_PROJECT_ID` set di `.env`
- [ ] `FIREBASE_CLIENT_EMAIL` set di `.env`
- [ ] `FIREBASE_PRIVATE_KEY` set dengan format benar (`\n` literal)
- [ ] JSON file NOT committed ke git
- [ ] Test send notification dari backend

### Web (Next.js)
- [ ] Web app registered di Firebase
- [ ] VAPID key generated
- [ ] Firebase config di `.env.local`
- [ ] `firebase` package installed
- [ ] `firebase-messaging-sw.js` ada di `public/`
- [ ] Service worker registered
- [ ] Permission request works
- [ ] Foreground & background messages tested

### Mobile (Flutter)
- [ ] Android app registered di Firebase
- [ ] iOS app registered di Firebase
- [ ] `google-services.json` di Android app folder
- [ ] `GoogleService-Info.plist` di iOS Runner folder
- [ ] `firebase_options.dart` generated
- [ ] `firebase_core`, `firebase_messaging`, `flutter_local_notifications` installed
- [ ] Permission requested (iOS & Android 13+)
- [ ] APNs key uploaded (iOS)
- [ ] FCM token obtained & sent ke backend
- [ ] Foreground, background, terminated state tested

---

© 2026 Digsan Indonesia
