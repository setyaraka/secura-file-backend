# 🔐 Vaultiva – Backend

A secure, production-grade NestJS backend for document sharing — supporting password protection, watermarking, file expiration, and detailed access logging.

> ⚙️ Built with NestJS, PostgreSQL, Prisma, and integrated with Cloudflare R2 for object storage.

---

## 🔗 Related Repository

This is the **backend** of a fullstack secure file-sharing project.

👉 Frontend repo: [vaultiva-frontend](https://github.com/setyaraka/vaultiva-frontend)

---

## 🧰 Tech Stack

| Layer        | Technology                         |
|--------------|-------------------------------------|
| Framework    | NestJS                              |
| Database     | PostgreSQL + Prisma ORM             |
| Storage      | Cloudflare R2 (via AWS SDK)         |
| Security     | Helmet.js (CSP), CORS               |
| Upload Tools | Multer, Sharp, PDF-lib              |
| Scheduling   | Cron (via `@nestjs/schedule`)       |
| Mail Service | Resend                              |
| Caching      | In-memory (`@nestjs/cache-manager`) |

---

## 🔐 Key Features

- ✅ JWT-based Authentication
- 📁 File Upload & Secured Download Endpoint (via Cloudflare Signed URL)
- ⏳ Time-limited access for private files (5-minute signed URLs)
- 🔒 Password-Protected File Sharing
- 🖋️ Watermarking (Image & PDF)
- 🔍 File Visibility: Public, Protected, Private
- 🧾 Audit Logging (Email, IP, User Agent)
- 📊 Download Stats: Views & Downloads
- 🧹 Auto File Deletion via Cron Job
- 🔗 RESTful API for Angular Frontend

---

## 🔐 Cloudflare Signed URL for Secure Access

Vaultiva uses **Cloudflare R2 Signed URLs** to serve private files securely with time-limited access.

- Signed URLs are generated using `@aws-sdk/s3-request-presigner`, valid for 5 minutes.
- Prevents direct public access to Cloudflare R2 buckets.
- Used in download and preview endpoints for safer, temporary file delivery.

> Example: When a user accesses a shared file, the backend returns a signed URL that's valid for a short time, protecting the actual object storage from exposure.

## 🛠️ Getting Started

```bash
npm install
npx prisma generate
npm run start:dev
```
---

### 📄 Create .env file with the following:
```
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=supersecret
BASE_URL=https://your-backend-url.com
FRONTEND_URL=https://your-frontend-url.com
RESEND_API_KEY=your_resend_key

R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=your_bucket
R2_ENDPOINT=https://r2.cloudflarestorage.com
R2_PUBLIC_DOMAIN=https://your-bucket.r2.dev
CORS_ORIGIN=https://vaultiva.cloud
```
---

## 📌 About the Project

Vaultiva backend powers a secure file-sharing platform designed for privacy-focused workflows.
It simulates real-world enterprise scenarios with:
- ⏳ Limited-time file access
- 🧾 Full audit logs (IP, email, user agent)
- 🖋️ PDF/Image watermarking
- 🔒 Secured download flows with conditional access

---

## 🎯 Why This Project Matters

This backend explores production-level concerns in:

- 🛡️ File protection & access tracking
- 🔐 Conditional file visibility and expiration
- 🧠 Watermarking engine for various file types
- 📈 Download tracking & lifecycle management
- 🧹 Automatic cleanup of expired resources
  
Vaultiva backend is a solid foundation for any application requiring secure, auditable, and privacy-first document workflows.

---

## 🔮 What's Next
Vaultiva is built with a long-term plan to gradually enhance document protection, user experience, and enterprise readiness.

### 🥇 Stage 1 – Lockdown Basics (MVP)
- Proxy all file access via backend (token-based)
- Hard watermark rendering via backend (pdf-lib + Sharp)
- Watermark preview per recipient
- Replace <iframe> viewer with PDF.js
- Token-based session tracking
- Log PDF open event and last page viewed
- Basic JS protections (blur on tab out, disable right-click)
- Strengthened watermark rendering (positioning, rotating, opacity, content)

### 🥈 Stage 2 – UX & Try Vaultiva
- “Try Vaultiva Now” share demo
- “View as recipient” simulation
- Group file list by protection level
- Enhanced empty states and guidance messages

### 🥉 Stage 3 – Abuse Prevention & Performance
- Brute-force password protection
- IP-based upload/share limiting
- Compress dashboard thumbnails
- Optimize PDF and asset delivery via CDN

### 🧠 Stage 4 – AI & Smart Recovery
- Vaultiva Assistant (AI guide/helper)
- “Forgot password?” → reset suggestion or revoke flow

### 💎 Stage 5 – Enterprise-Grade Protections
- Server-side image rendering + watermark stamping (Sharp)
- Invisible metadata injection (user ID, timestamp, access info)
- Multi-device session logging
- PDF interaction heatmap & analytics

---

## 🙋 Feedback

Have thoughts or found a bug?
Feel free to open an issue for any suggestions or questions.
