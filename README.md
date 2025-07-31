# 🔐 Vaultiva – Backend

NestJS backend for secure document sharing, featuring password-protected access, watermarking, file expiration, and detailed access logging, built for privacy-focused workflows.

Built with NestJS, PostgreSQL, Prisma, and integrated with Cloudflare R2 for object storage.

---

## 🔗 Related Repository

This is the backend part of a fullstack secure file-sharing project.  
👉 Frontend repo: [vaultiva-frontend](https://github.com/setyaraka/vaultiva-frontend)

---

## 🧰 Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL + Prisma ORM
- **Storage**: Cloudflare R2 (via AWS SDK)
- **Security**: Helmet.js (CSP), CORS
- **Utilities**: Multer, Sharp (image watermark), PDF-lib (PDF watermark)
- **Scheduler**: Cron (via @nestjs/schedule)
- **Mail Service**: Resend
- **Cache**: In-memory (via @nestjs/cache-manager)

---

## 🔐 Key Features

- JWT-based Authentication
- File Upload & Secured Download Endpoint
- Password-Protected File Sharing
- Watermarking (Image & PDF)
- File Visibility: Public, Protected, Private
- Audit Logging (Email, IP, User Agent)
- Download Statistics (views/downloads)
- Auto Deletion via Cron Job
- RESTful API for Angular frontend

---

## 🛠️ Setup

```bash
npm install
npx prisma generate
npm run start:dev
```

Create a .env file with the following variables:
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

## 📌 About the Project
This backend powers Vaultiva, a secure file-sharing MVP built for showcasing enterprise-grade privacy controls, file tracking, and lifecycle management.

It simulates real-world scenarios like:

- Limited-time file access
- Traceable access logs with IP/user-agent
- PDF/image watermarking
- Secure download flows with audit support

## 🎯 Why This Project Matters
Vaultiva backend is designed to explore production-level challenges in:

- 🛡️ File protection and metadata tracking
- 🧠 Combining image & PDF watermarking with conditional access
- 🧾 Logging every download access for accountability
- ⏳ Auto-cleanup of expired files

This project serves as a backend foundation for secure, trackable document workflows.


