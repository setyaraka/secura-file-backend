# Secura File – Backend

A secure file sharing backend built with **NestJS** and **PostgreSQL**.  
It supports advanced features like file access control, watermarking, and audit logging.

## Features
- 🔐 Auth (Login, Register)
- 📤 Upload File
- 📥 Download File
- 👁️ File visibility (private/public)
- 🔑 Password protection
- ⏰ Expiry date
- 🔢 Access limit
- 🖋️ Watermarking (image and pdf preview)
- 📊 Dashboard statistics
- 🕵️ Audit log

## Tech Stack
- **NestJS**
- **Prisma ORM**
- **PostgreSQL**
- **Multer** (file handling)
- **Sharp** (watermark image processing)

## Getting Started
```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Run server
npm run start:dev

## Environment Variables
DATABASE_URL="postgresql://your-db-url"
JWT_SECRET="your-secret-key"
LOCAL_URL="http://localhost:3000"
