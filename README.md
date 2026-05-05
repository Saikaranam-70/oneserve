# OneServe — WhatsApp Commerce OS

Full-stack SaaS platform for businesses to receive and manage orders via WhatsApp automatically.

---

## Architecture

```
WhatsApp (Meta / Baileys / WPPConnect)
        ↓
Express API Gateway (JWT Auth, Rate Limiting)
        ↓
Core Services: Webhook Handler, Order Engine, Product Catalog, Notification Service
        ↓
Redis Cache ←→ MongoDB
        ↓
Analytics Engine
        ↓
React + Vite Admin Dashboard
```

---

## Tech Stack

| Layer      | Tech                                         |
|------------|----------------------------------------------|
| Backend    | Node.js 18+, Express 4, Mongoose 8           |
| Database   | MongoDB                                      |
| Cache      | Redis (ioredis)                              |
| Frontend   | React 18, Vite 5, TailwindCSS 3              |
| WhatsApp   | Meta Cloud API + Baileys + WPPConnect        |
| Storage    | Cloudinary (product images)                  |
| Payments   | Razorpay                                     |
| Auth       | JWT + Refresh Tokens (Redis blacklist)       |

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally or Atlas URI
- Redis running locally

### Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## WhatsApp Connection Methods

### 1. Meta Cloud API (Recommended for production)
- Create a Meta App at developers.facebook.com
- Enable WhatsApp product
- Get Phone Number ID and Access Token
- Set webhook URL: `https://yourdomain.com/api/webhook/YOUR_BUSINESS_ID`
- Set verify token to match `META_VERIFY_TOKEN` in .env

### 2. Baileys (WA Web)
- No Meta account needed
- Scan QR with WhatsApp mobile app
- Sessions stored in `/sessions/baileys/`

### 3. WPPConnect
- Alternative WA Web method
- Better stability for high volume
- Sessions stored in `/sessions/wpp/`

---

## Bot Commands (Customer-facing)

| Command    | Action                              |
|------------|-------------------------------------|
| hi / hello | Shows welcome + menu                |
| menu       | Browse products                     |
| 1, 2, 3... | Add product by number to cart       |
| cart       | View cart + total                   |
| checkout   | Review cart before confirming       |
| confirm    | Place the order                     |
| cancel     | Cancel pending order                |
| orders     | Track last 3 orders                 |
| clear      | Empty cart                          |
| help       | Show all commands                   |

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `PATCH /api/auth/change-password`

### Products
- `GET    /api/products`
- `POST   /api/products` (multipart/form-data with images)
- `PATCH  /api/products/:id`
- `DELETE /api/products/:id`
- `GET    /api/products/categories`

### Orders
- `GET   /api/orders`
- `GET   /api/orders/counts`
- `PATCH /api/orders/:id/status`

### Analytics
- `GET /api/analytics/dashboard`
- `GET /api/analytics/revenue?period=7d|30d|90d`
- `GET /api/analytics/top-products`
- `GET /api/analytics/export` (CSV download)

### WhatsApp
- `POST /api/whatsapp/connect`
- `GET  /api/whatsapp/qr`
- `GET  /api/whatsapp/status`
- `POST /api/whatsapp/disconnect`
- `POST /api/whatsapp/test`

### Subscription
- `GET  /api/subscription/plans`
- `POST /api/subscription/create-order`
- `POST /api/subscription/verify`

### Webhook (Meta)
- `GET  /api/webhook/:businessId` — Verification
- `POST /api/webhook/:businessId` — Incoming messages

---

## Subscription Plans

| Plan  | Price    | Orders/month | Features                        |
|-------|----------|-------------|----------------------------------|
| Free  | ₹0       | 20          | Basic bot, 1 WA number          |
| Basic | ₹499/mo  | 100         | Analytics, CSV export            |
| Pro   | ₹999/mo  | Unlimited   | All features, priority support  |

---

## Folder Structure

```
oneserve/
├── backend/
│   ├── config/         # DB, Redis, Cloudinary
│   ├── controllers/    # Business logic
│   ├── middleware/     # Auth, error handler
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express routes
│   ├── services/       # Bot engine, WA session managers
│   └── server.js
└── frontend/
    └── src/
        ├── components/ # Layout, shared UI
        ├── pages/      # Dashboard, Orders, Products, Analytics, etc.
        ├── services/   # Axios API client
        └── store/      # Zustand state
```
