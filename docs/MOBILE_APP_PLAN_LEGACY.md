# [LEGACY] Digsan Mobile App Plan — Capacitor/PWA

> **Catatan**: Dokumen ini dari `digsan-ecosystem` (rencana Capacitor/PWA yang sudah dibatalkan).
> Keputusan final: Flutter native app. Disimpan sebagai referensi saja.
> Lihat `FULL_MIGRATION_PLAN.md` section 6 untuk rencana Flutter yang terpilih.

## Pendekatan Lama: PWA + Capacitor

Rencana awal menggunakan Capacitor untuk membungkus web app Next.js sebagai native app.

### Alasan Dibatalkan

1. **Performa**: WebView tidak se-smooth Flutter native rendering
2. **Apple Review Risk**: Apple bisa menolak app yang hanya WebView wrapper
3. **Native API Access**: Capacitor terbatas dibanding Flutter
4. **Medja Integration**: Medja sudah punya Flutter codebase (BLoC + Clean Architecture) yang bisa di-reuse
5. **Long-term**: Flutter lebih scalable untuk fitur-fitur native (kamera, GPS, biometric, offline)

### Store Requirements (Tetap Relevan)

#### Google Play Store
- App Icon: 512x512 PNG
- Feature Graphic: 1024x500 PNG
- Screenshots: min 2, max 8 per device type
- Privacy Policy URL
- App Description (short & full)
- Content Rating questionnaire

#### Apple App Store
- App Icon: 1024x1024 PNG (no alpha)
- Screenshots: 6.5" and 5.5" iPhone required
- Privacy Policy URL
- App Description
- Keywords
- Support URL
- Age Rating

---

*Dokumen ini untuk referensi saja. Keputusan final: Flutter native app.*
