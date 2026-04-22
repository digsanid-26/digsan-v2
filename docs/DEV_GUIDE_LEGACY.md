# [LEGACY] Digsan Ecosystem - Panduan Development (Windows PowerShell)

> **Catatan**: Dokumen ini dari `digsan-ecosystem` (stack lama).
> Disimpan sebagai referensi arsitektur lama. Untuk panduan digsan-v2, lihat `README.md` di root project.

## Arsitektur Lama (9 Micro-Frontend Apps)

| App | Port | URL |
|-----|------|-----|
| Landing | 3000 | http://localhost:3000 |
| Auth | 3001 | http://localhost:3001 |
| Dashboard | 3002 | http://localhost:3002 |
| Tree | 3003 | http://localhost:3003 |

## Struktur Folder Lama

```
digsan-ecosystem/
├── apps/
│   ├── landing/     # Landing page (port 3000)
│   ├── auth/        # Auth & SSO (port 3001)
│   ├── dashboard/   # User dashboard (port 3002)
│   └── tree/        # Family tree (port 3003)
├── packages/
│   ├── database/    # Prisma schema & client
│   ├── ui/          # Shared UI components
│   ├── config/      # Shared config
│   ├── utils/       # Shared utilities
│   └── auth-client/ # Auth client helpers
├── .env
├── package.json
└── turbo.json
```

## Environment Variables (Lama)

```env
DATABASE_URL="postgresql://dev_user:newpassword123@localhost:5432/digsan?schema=public"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
NEXT_PUBLIC_AUTH_URL="http://localhost:3001"
NEXT_PUBLIC_LANDING_URL="http://localhost:3000"
NEXT_PUBLIC_DASHBOARD_URL="http://localhost:3002"
NEXT_PUBLIC_TREE_URL="http://localhost:3003"
```

---

*Dokumen ini untuk referensi saja. Stack baru menggunakan NestJS centralized API + Next.js web + Flutter mobile.*
