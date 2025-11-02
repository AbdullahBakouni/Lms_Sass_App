# 🎓 LMS SaaS App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)  
[![Build Status](https://img.shields.io/github/actions/workflow/status/AbdullahBakouni/Lms_Sass_App/ci.yml?branch=main)]()  
[![Issues](https://img.shields.io/github/issues/AbdullahBakouni/Lms_Sass_App)]()  
[![Stars](https://img.shields.io/github/stars/AbdullahBakouni/Lms_Sass_App?style=social)]()

> A scalable SaaS Learning Management System (LMS) backend built with Express.js, Drizzle ORM, PostgreSQL, Redis, Google OAuth, and scheduled cron jobs.

---

## 🖥️ Overview

LMS SaaS App is a robust platform designed for educational institutions, training providers, or corporate learning environments.  
It supports: user authentication via Google OAuth, course management, subscription billing, content delivery, caching & queueing via Redis, and scheduled operations through cron jobs.

---

## 🧱 Tech Stack

| Layer            | Technology                                           |
|-------------------|------------------------------------------------------|
| Backend           | Express.js (Node.js)                                |
| Database          | PostgreSQL                                          |
| ORM               | Drizzle ORM                                          |
| Cache & Queue     | Redis                                               |
| Auth              | Google OAuth + JWT                                   |
| Scheduled Jobs   | Cron Jobs (via Node-cron, Bull or similar)          |
| Deployment        | Docker / Kubernetes / CI-CD                         |

---

## ✨ Features

- ✅ Google OAuth and JWT based authentication  
- 🎓 Course creation, enrollment, and tracking  
- 🧑‍🏫 Multi-tenant or SaaS configuration (organizations, users)  
- ⚡ High performance with Redis caching and job queues  
- 🕒 Scheduled tasks (daily reports, cleanup, subscriptions)  
- 📊 Analytics and logs for admin users  

---
## 🗺️ Architecture Diagram

```mermaid
flowchart TD
    U[User or Client App] --> F[Frontend - React or Next.js]
    F -->|REST API Calls| B[Express.js Backend]
    B --> D[PostgreSQL Database]
    B --> Z[Drizzle ORM]
    B --> R[Redis Cache and Queue]
    B --> G[Google OAuth Service]
    B --> C[Cron Jobs Scheduler]
    Z --> D
    R --> B
    C --> B
    G --> B
```
## ⚙️ Getting Started

### 1️⃣ Clone Repository  
```bash
git clone https://github.com/AbdullahBakouni/Lms_Sass_App.git
cd Lms_Sass_App
```
2️⃣ Install Dependencies
```bash
npm install
# or
yarn install
```
3️⃣ Configure Environment

Create a .env file from
```env
# App
APP_NAME=LMS_SaaS_App
NODE_ENV=development
PORT=4000

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/lms_saas_db

# ORM (Drizzle) config (if separate)
DRIZZLE_SCHEMA_DIR=./db/schema
DRIZZLE_MIGRATIONS_DIR=./db/migrations

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OAuth (Google)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# SaaS / Billing (optional)
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Cron / Jobs
CRON_SCHEDULE_DAILY=0 0 * * *
```
4️⃣ Run Database Migrations
```bash
npm run migrate
# or
yarn migrate
```
5️⃣ Start the Application
```bash
npm run dev
```
## 🧪 API Examples

This backend exposes modular RESTful routes organized by feature domain.

---

### 🔐 Auth Routes (`/api/v1/auth`)

| Method | Endpoint | Description |
|---------|-----------|-------------|
| `POST` | `/sign-up` | Register a new user (supports image upload via `multer`) |
| `POST` | `/sign-in` | Authenticate user with email & password |
| `POST` | `/sign-out` | Logout current user and invalidate session/token |
| `POST` | `/switch-account` | Switch between user accounts (multi-tenant support) |
| `POST` | `/verify-otp` | Verify OTP to confirm or update email |
| `POST` | `/resend-otp` | Resend verification OTP |
| `GET` | `/google` | Begin Google OAuth login flow |
| `GET` | `/google/callback` | Google OAuth callback endpoint |
| `GET` | `/google/failure` | Google OAuth failure handler |

**Example: Sign-Up (multipart form-data)**  
```http
POST /api/v1/auth/sign-up
Content-Type: multipart/form-data
Body:
{
   email: user@example.com,
   password: strongPassword123,
   image: (file upload),
}
```
**Example: Google OAuth Flow**
```http
GET /api/v1/auth/google
```
### 🧑‍🏫 User Routes (/api/v1/user)
| Method   | Endpoint              | Description                                       |
| -------- | --------------------- | ------------------------------------------------- |
| `POST`   | `/update`             | Update user info (supports avatar upload)         |
| `DELETE` | `/:id/delete`         | Delete user by ID (requires authorization)        |
| `GET`    | `/me`                 | Get current authenticated user profile            |
| `GET`    | `/:id/mysubscription` | Retrieve active subscriptions for a specific user |

**Example: Get Current User Info**
```http
GET /api/v1/user/me
Authorization: Bearer <JWT_TOKEN>
```
### 💼 Wallet Routes (/api/v1/wallet)
| Method | Endpoint  | Description                            |
| ------ | --------- | -------------------------------------- |
| `POST` | `/charge` | Charge or top-up a user wallet balance |
**Example: Charge Wallet**
```http
POST /api/v1/wallet/charge
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 25.00,
  "currency": "USD"
}
```
### 🤖 Companion Routes (/api/v1/companion)
| Method | Endpoint  | Description                                     |
| ------ | --------- | ----------------------------------------------- |
| `POST` | `/create` | Create a new AI companion or learning assistant |
**Example: Create Companion**
```http
POST /api/v1/companion/create
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Lumi",
  "language": "English",
  "personality": "Friendly",
  "purpose": "Tutor"
}
```
### 💳 Subscription Routes (/api/v1/subscription)
| Method | Endpoint     | Description                      |
| ------ | ------------ | -------------------------------- |
| `POST` | `/subscribe` | Subscribe user to a pricing plan |

**Example: Subscribe to Plan**
```http
POST /api/v1/subscription/subscribe
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "plan_id": "pro_monthly"
}
```
### ⚙️ Common Headers

Most routes require authentication. Include this header in requests after login:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```
**💡 Notes**

File uploads (e.g. profile images) are handled via Multer, stored under uploads/.

Google OAuth uses Passport.js with the google strategy.

Each domain (auth, user, wallet, etc.) has its own Express router for modular design.

Error handling and validation should be done via centralized middleware.

OTP flow (verify-otp, resend-otp) enables secure account verification.

# 🐳 Docker Setup
```bash
docker build -t lms-saas-app .
docker run -p 4000:4000 --env-file .env lms-saas-app
```

Example docker-compose.yml:
```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - .env
    depends_on:
      - db
      - redis
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: lms_saas_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```
# 🛡️ Best Practices & Security

Store sensitive credentials in environment variables — never commit secrets

Use Redis for caching frequently accessed data and queue tasks

Use HTTPS in production — secure cookies and tokens (JWT)

Use input validation and sanitize any user-provided data

Use logging and monitoring for cron jobs and background tasks

# 🛣️ Roadmap

 Add subscription billing via Stripe / PayPal

 Add multi-language support for international learners

 Add WebSocket notifications for live class events

 Add AI-based content recommendations

# 🤝 Contributing

Contributions are welcome!

Fork this repo

Create a new branch (git checkout -b feature/your-feature)

Make your changes and commit (git commit -m "feat: your feature")

Push to your branch (git push origin feature/your-feature)

Create a Pull Request 🎉

# 📜 License

MIT © 2025 [Abdullah Bakouni](https://github.com/AbdullahBakouni)
