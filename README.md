# APIHub

APIHub is a developer workspace to discover, document, test, and manage APIs. It includes a curated library of 102 APIs in 17 categories, an HTTP tester, user workspaces, and an API-key-protected catalog API.

## Features

- API library with search, category filters, provider documentation, and Tester handoff
- HTTP tester for GET, POST, PUT, PATCH, and DELETE requests
- PostgreSQL-ready account, API-key, custom API, endpoint, saved-request, and history schema
- Secure password hashing, HTTP-only signed session cookies, hashed API keys, ownership boundaries, rate-limited API-key access, and SSRF safeguards

## Local setup

Install dependencies in `frontend` and `backend`. Copy `backend/.env.example` to `backend/.env`, supply `DATABASE_URL` and a long random `JWT_SECRET`, then run `npm run migrate` in `backend`. Start the backend with `npm run dev` and frontend with `npm run dev`.

## APIHub API

Create an API key in Dashboard, then send `Authorization: Bearer YOUR_APIHUB_KEY` to `GET /api/v1/apis`, `/apis/:id`, `/apis/:id/endpoints`, or `/categories`. The default limit is 60 requests/minute per key. Never commit or share API keys.

## Deployment

Deploy the React app and Node service separately, configure `CLIENT_URL`, `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SAME_SITE=none`, and production CORS before publishing. The repository intentionally contains no credentials.
