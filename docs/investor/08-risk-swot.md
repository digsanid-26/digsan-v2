# Digsan — Analisis Risiko & SWOT

---

## 1. Analisis SWOT

### 1.1 Strengths (Kekuatan)

| No | Kekuatan | Dampak |
|----|----------|--------|
| 1 | Fokus pada pasar Indonesia dengan budaya genealogi yang kuat | Tinggi — segmen yang underserved |
| 2 | Platform sudah live dan operasional (MVP ready) | Tinggi — bukan sekadar ide |
| 3 | Sistem klaim anggota yang unik | Sedang — diferensiasi produk |
| 4 | Ads Builder dengan AI image generation | Sedang — fitur monetisasi inovatif |
| 5 | Tim teknis yang mampu build end-to-end | Tinggi — eksekusi cepat |
| 6 | Model freemium dengan growth loop organik | Tinggi — CAC rendah |
| 7 | Bahasa Indonesia & konteks budaya lokal | Sedang — barrier to entry untuk kompetitor global |

### 1.2 Weaknesses (Kelemahan)

| No | Kelemahan | Dampak |
|----|----------|--------|
| 1 | Startup baru, belum ada traction signifikan | Tinggi — investor butuh bukti |
| 2 | Tim masih kecil/solo | Tinggi — bottleneck eksekusi |
| 3 | Belum ada revenue (pre-revenue) | Tinggi — perlu validasi model bisnis |
| 4 | Belum ada automated testing | Sedang — risk teknis |
| 5 | File storage masih lokal (belum cloud) | Rendah — bisa di-scale |
| 6 | Belum ada mobile app | Sedang — kompetitor punya mobile |
| 7 | Brand awareness masih rendah | Sedang — perlu marketing |

### 1.3 Opportunities (Peluang)

| No | Peluang | Dampak |
|----|---------|--------|
| 1 | Tidak ada kompetitor lokal yang dominan | Tinggi — first-mover advantage |
| 2 | ~85 juta keluarga Indonesia sebagai pasar | Tinggi — market size besar |
| 3 | Tren digitalisasi & minat genealogi generasi muda | Tinggi — tailwind pasar |
| 4 | Kemitraan dengan komunitas marga/lembaga adat | Sedang — channel acquisition |
| 5 | Ekspansi ke pasar Melayu (Malaysia, Brunei, Singapura) | Sedang — market expansion |
| 6 | Integrasi dengan layanan government (KTP digital, KK) | Rendah — perlu kemitraan |
| 7 | AI untuk auto-generate silsilah dari data KTP/KK | Sedang — inovasi produk |

### 1.4 Threats (Ancaman)

| No | Ancaman | Dampak | Mitigasi |
|----|---------|--------|----------|
| 1 | Kompetitor global (MyHeritage, FamilySearch) masuk Indonesia | Tinggi | Fokus pada lokalisasi & komunitas |
| 2 | Perubahan regulasi (UU PDP, UU ITE) | Sedang | Compliance plan & legal advisor |
| 3 | Kesulitan monetisasi pasar Indonesia | Tinggi | Diversifikasi revenue (ads, B2B, premium) |
| 4 | Data breach / kebocoran data | Tinggi | Security audit, encryption, helmet |
| 5 | Perubahan algoritma SEO/platform | Rendah | Diversifikasi channel acquisition |
| 6 | Ekonomi makro (resesi) | Sedang | Model freemium tetap relevan |
| 7 | Kompetitor lokal baru muncul | Sedang | First-mover advantage, lock-in data |

---

## 2. Analisis Risiko Detail

### 2.1 Risiko Produk

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Product-market fit tidak tercapai | Sedang | Tinggi | User research, iterasi cepat, feedback loop |
| Fitur tidak sesuai ekspektasi pasar | Sedang | Sedang | Beta testing, survei pengguna |
| Skalabilitas teknis | Rendah | Tinggi | Arsitektur sudah dirancang untuk scale |
| Mobile app delay | Sedang | Sedang | Prioritas PWA, roadmap mobile Year 2 |

### 2.2 Risiko Bisnis

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Konversi free → premium rendah | Sedang | Tinggi | A/B testing pricing, value props |
| CAC terlalu tinggi | Sedang | Sedang | Growth loop organik, SEO, referral |
| Churn rate tinggi | Sedang | Tinggi | Engagement features, data lock-in |
| Tidak mencapai break-even | Sedang | Tinggi | Cost control, diversifikasi revenue |

### 2.3 Risiko Tim

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Key person dependency | Tinggi | Tinggi | Dokumentasi, hiring, equity vesting |
| Sulit rekrut talent teknis | Sedang | Sedang | Remote work, competitive compensation |
| Founder conflict | Rendah | Tinggi | Founder agreement, vesting schedule |

### 2.4 Risiko Eksternal

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Kompetitor global masuk | Sedang | Tinggi | Lokalisasi, komunitas, brand loyalty |
| Regulasi data privacy | Tinggi | Sedang | UU PDP compliance, DPO, audit |
| Perubahan teknologi (AI, platform) | Sedang | Rendah | Arsitektur fleksibel, tech-agnostic |
| Krisis ekonomi | Rendah | Sedang | Model freemium, cost-efficient |

### 2.5 Risiko Teknologi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Data breach | Rendah | Sangat Tinggi | Helmet, encryption, security audit |
| Downtime server | Rendah | Tinggi | Monitoring, backup, failover plan |
| Ketergantungan API pihak ketiga | Sedang | Sedang | Fallback, multi-provider |
| Technical debt | Sedang | Sedang | Refactor plan, code review |

---

## 3. Risk Matrix

```
Dampak
  Tinggi │  ③ Kompetitor global    ① Data breach
         │  ③ Key person dep       ① PMF tidak tercapai
         │                         ① Churn tinggi
  Sedang │  ② Regulasi PDP         ② CAC tinggi
         │  ② Konversi rendah      ② Tim kecil
         │  ② Tech debt            ② Mobile delay
  Rendah │  ④ SEO change           ③ Downtime
         │  ④ Ekonomi              ③ API dependency
         └─────────────────────────────────────────
            Rendah         Sedang         Tinggi
                        Probabilitas
```

---

## 4. Mitigasi Prioritas

### Prioritas 1 — Critical (tangani segera)

1. **Key person dependency:** Rekrut developer tambahan, dokumentasi sistem.
2. **UU PDP compliance:** Konsultasi legal, implementasi data privacy.
3. **Validasi product-market fit:** User research, beta testing, metric tracking.

### Prioritas 2 — High (tangani dalam 3-6 bulan)

1. **Monetisasi:** Launch premium & ads, A/B test pricing.
2. **Security audit:** Penetration testing, security review.
3. **Hiring plan:** Rekrut tim inti post-funding.

### Prioritas 3 — Medium (tangani dalam 6-12 bulan)

1. **Mobile app:** Rencanakan development PWA/native.
2. **Scalability:** Cloudinary, CDN, database optimization.
3. **Automated testing:** CI/CD, test coverage.

---

## 5. Exit Strategy

| Strategi | Deskripsi | Timeline |
|----------|-----------|----------|
| Akuisisi | Diakuisisi oleh tech company / media / genealogi platform | 5-7 tahun |
| IPO | Go public di Bursa Efek Indonesia | 7-10 tahun |
| Merger | Merger dengan platform serupa di Asia Tenggara | 5-7 tahun |
| Profitable sustainable | Tetap private & profitable | Ongoing |

---

_Dokumen ini akan diperbarui seiring perkembangan dan hasil validasi risiko._
