# API Reference

Base URL: `/api` (same origin as the website). Bodies are JSON.
Authentication uses an **httpOnly cookie** (`cakeshop_token`, JWT) set by `POST /api/auth/login`.
Errors always look like `{ "error": "message" }`.

| Symbol | Meaning |
|---|---|
| 🌐 | public |
| 🔑 | any logged-in user |
| 🛡️ | admin only (403 for customers) |

## Auth

| Method | Path | Access | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register` | 🌐 | `full_name, email, phone, password` | `201 { message, id }` · `409` email taken · `400` validation |
| POST | `/auth/login` | 🌐 | `email, password` | `200 { user }` + sets cookie · `401` bad credentials |
| POST | `/auth/logout` | 🌐 | – | `200` clears cookie |
| GET | `/auth/me` | 🔑 | – | `200 { user }` · `401` |

Password rules: 8–72 chars, letters and numbers. Passwords are stored as bcrypt hashes (cost 12).

## Cakes

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/cakes` | 🌐 | Optional query: `category`, `featured=1`, `search`. Returns only visible cakes. `{ cakes: [...] }` |
| GET | `/cakes/:id` | 🌐 | `{ cake }` · `404` |
| POST | `/cakes` | 🛡️ | `name, description, category, price, image_url?, is_featured?, is_available?` → `201 { id }` |
| PUT | `/cakes/:id` | 🛡️ | Same body as POST (full update) |
| DELETE | `/cakes/:id` | 🛡️ | Deletes the cake. If it is part of past orders it is **hidden** instead (`{ hidden: true }`) so order history stays intact. |

## Orders (customer)

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/orders` | 🔑 | `{ items: [{cake_id, quantity}], delivery_address, contact_phone, notes? }`. Prices are read from the DB inside a transaction. → `201 { order_id, total_amount }` |
| GET | `/orders/my` | 🔑 | The caller's own orders, each with `items[]`. |

Quantity must be 1–20 per cake; address 10–500 characters.

## Admin

All routes below need an admin cookie.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | `{ customers, cakes, orders, revenue }` |
| GET | `/admin/users` | All registered users (no password hashes) |
| GET | `/admin/cakes` | All cakes including hidden ones |
| GET | `/admin/orders` | All orders with customer details and items |
| PUT | `/admin/orders/:id/status` | `{ status }` where status ∈ `Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled` |

## Health

`GET /api/health` → `200 { status: "ok", database: "up" }` or `503` when MySQL is unreachable.

## Quick curl tests

```bash
# register + login (cookie jar keeps the session)
curl -i -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"full_name":"Test User","email":"t@example.com","phone":"9999999999","password":"Passw0rd123"}'
curl -i -c jar.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"t@example.com","password":"Passw0rd123"}'

curl localhost:3000/api/cakes
curl -b jar.txt localhost:3000/api/orders/my
curl -b jar.txt localhost:3000/api/admin/users        # 403 for a customer
```
