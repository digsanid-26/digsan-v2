# iPaymu Payment Gateway Integration

Digsan V2 sekarang mendukung **iPaymu** sebagai payment gateway lokal Indonesia.

## Setup

### 1. Daftar di iPaymu

1. Buka [https://ipaymu.com](https://ipaymu.com)
2. Daftar akun merchant
3. Verifikasi akun (KTP, NPWP, dll)
4. Dapatkan credentials:
   - **VA Number** (Virtual Account)
   - **API Key**

### 2. Konfigurasi Environment Variables

Tambahkan di `.env`:

```env
PAYMENT_GATEWAY=ipaymu

IPAYMU_VA="1179001234567890"
IPAYMU_API_KEY="QbGcoO7c...your-api-key"
IPAYMU_IS_PRODUCTION=false
IPAYMU_CALLBACK_URL=http://localhost:4000/api/jobs/payments/webhook
```

**Production:**
```env
IPAYMU_IS_PRODUCTION=true
IPAYMU_CALLBACK_URL=https://api.digsan.id/api/jobs/payments/webhook
```

### 3. Setup Webhook di iPaymu Dashboard

1. Login ke [https://my.ipaymu.com](https://my.ipaymu.com)
2. Menu **Settings** → **Callback URL**
3. Masukkan URL: `https://api.digsan.id/api/jobs/payments/webhook`
4. Save

## API Flow

### 1. Create Payment

**Request:**
```http
POST /api/jobs/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "cm5abc123",
  "method": "TRANSFER"
}
```

**Response:**
```json
{
  "id": "cm5payment123",
  "orderId": "cm5abc123",
  "amount": 150000,
  "method": "TRANSFER",
  "status": "PENDING",
  "transactionId": "TRX-20260422-001",
  "snapToken": "SESSION-abc123",
  "snapUrl": "1179001234567890",
  "metadata": {
    "SessionID": "SESSION-abc123",
    "TransactionId": "TRX-20260422-001",
    "ReferenceId": "ORD-20260422-001",
    "Via": "qris",
    "Channel": "qris",
    "PaymentNo": "1179001234567890",
    "PaymentName": "Virtual Account BCA",
    "Total": 150000,
    "Fee": 2500,
    "Expired": "2026-04-23 18:00:00",
    "QrImage": "https://...",
    "QrString": "00020101..."
  }
}
```

### 2. Customer Melakukan Pembayaran

Customer membayar via:
- **QRIS** (scan QR dari `metadata.QrImage`)
- **Virtual Account** (transfer ke `metadata.PaymentNo`)
- **E-Wallet** (Gopay, OVO, Dana, LinkAja)
- **Convenience Store** (Alfamart, Indomaret)

### 3. iPaymu Callback

iPaymu akan mengirim callback ke webhook URL saat status berubah:

**Callback Payload:**
```json
{
  "trx_id": "TRX-20260422-001",
  "status": "berhasil",
  "status_code": "1",
  "sid": "SESSION-abc123",
  "reference_id": "ORD-20260422-001",
  "via": "qris",
  "channel": "qris",
  "amount": 150000,
  "fee": 2500,
  "created_date": "2026-04-22 17:30:00"
}
```

### 4. Webhook Processing

Backend akan:
1. Verify signature
2. Find payment by `transactionId` atau `reference_id`
3. Map status iPaymu → internal status:
   - `berhasil` / `success` → `PAID`
   - `pending` → `PENDING`
   - `expired` → `EXPIRED`
   - `gagal` / `failed` → `FAILED`
   - `refund` → `REFUNDED`
4. Update payment & order status
5. Return `200 OK`

## Status Mapping

| iPaymu Status | Internal Status | Order Status | Description |
|---------------|-----------------|--------------|-------------|
| `berhasil` / `success` | `PAID` | `PAID` | Pembayaran berhasil |
| `pending` | `PENDING` | `PENDING` | Menunggu pembayaran |
| `expired` | `EXPIRED` | `EXPIRED` | Waktu pembayaran habis |
| `gagal` / `failed` | `FAILED` | - | Pembayaran gagal |
| `refund` | `REFUNDED` | `REFUNDED` | Pembayaran di-refund |

## Testing

### Sandbox Mode

iPaymu menyediakan sandbox untuk testing:

```env
IPAYMU_IS_PRODUCTION=false
```

Base URL: `https://sandbox.ipaymu.com/api/v2`

### Test Credentials

Gunakan test VA dan API Key dari dashboard sandbox.

### Manual Testing

```bash
# 1. Create payment
curl -X POST http://localhost:4000/api/jobs/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"cm5abc123","method":"TRANSFER"}'

# 2. Simulate callback (manual)
curl -X POST http://localhost:4000/api/jobs/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "trx_id": "TRX-20260422-001",
    "status": "berhasil",
    "status_code": "1",
    "sid": "SESSION-abc123",
    "reference_id": "ORD-20260422-001",
    "via": "qris",
    "channel": "qris",
    "amount": 150000,
    "fee": 2500,
    "created_date": "2026-04-22 17:30:00"
  }'
```

## Payment Methods

iPaymu mendukung berbagai metode pembayaran:

| Method | Code | Description |
|--------|------|-------------|
| **QRIS** | `qris` | QR Code Indonesian Standard |
| **Virtual Account** | `va` | BCA, BNI, Mandiri, BRI, CIMB, dll |
| **E-Wallet** | `gopay`, `ovo`, `dana`, `linkaja` | Digital wallet |
| **Convenience Store** | `alfamart`, `indomaret` | Bayar di toko |
| **Credit Card** | `cc` | Visa, Mastercard, JCB |

## Fees

| Method | Fee | Settlement |
|--------|-----|------------|
| QRIS | 0.7% | T+1 |
| Virtual Account | Rp 4.000 | T+1 |
| E-Wallet | 2% | T+1 |
| Convenience Store | Rp 5.000 | T+2 |
| Credit Card | 2.9% + Rp 2.000 | T+7 |

*Fees dapat berubah, cek dashboard iPaymu untuk info terbaru.

## Security

### Signature Verification

iPaymu menggunakan HMAC SHA256 untuk verifikasi:

```typescript
const bodyEncrypt = crypto
  .createHmac('sha256', apiKey)
  .update(JSON.stringify(body))
  .digest('hex');

const stringToSign = `POST:${va}:${bodyEncrypt}:${apiKey}`;

const signature = crypto
  .createHmac('sha256', apiKey)
  .update(stringToSign)
  .digest('hex');
```

Signature dikirim di header `signature` untuk setiap request.

## Troubleshooting

### Payment tidak terbuat

- Cek `IPAYMU_VA` dan `IPAYMU_API_KEY` valid
- Cek logs: `pm2 logs digsan-api | grep iPaymu`
- Verify signature calculation

### Callback tidak diterima

- Pastikan webhook URL accessible dari internet (bukan localhost)
- Cek firewall/nginx config
- Test dengan ngrok untuk development:
  ```bash
  ngrok http 4000
  # Update IPAYMU_CALLBACK_URL ke ngrok URL
  ```

### Status tidak update

- Cek logs webhook: `pm2 logs digsan-api | grep Payment`
- Verify `transactionId` match dengan database
- Manual check status via API:
  ```typescript
  await ipaymuService.checkTransactionStatus('TRX-20260422-001');
  ```

## Migration dari Midtrans

Jika sebelumnya pakai Midtrans:

1. Ubah `PAYMENT_GATEWAY=ipaymu` di `.env`
2. Tambahkan env iPaymu
3. Restart API: `pm2 restart digsan-api`
4. Webhook URL berubah (sama endpoint, beda payload)

Kedua gateway bisa jalan bersamaan dengan conditional logic di `PaymentService`.

## Resources

- [iPaymu Documentation](https://ipaymu.com/dokumentasi-api/)
- [iPaymu Dashboard](https://my.ipaymu.com)
- [iPaymu Sandbox](https://sandbox.ipaymu.com)
- [Support](https://ipaymu.com/kontak/)

## License

Private — © 2026 Digsan Indonesia
