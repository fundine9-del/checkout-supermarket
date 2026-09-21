# Checkout — Supermarket Dashboard

React + Vite + TypeScript web app where supermarkets sign up, manage products, and
track sales. It talks to the **checkout server** (Express + Supabase) over the
same `/api` endpoints the Flutter scanner app uses.

## Setup

1. Install dependencies

   ```
   npm install
   ```

2. Create `.env` from `.env.example` and fill in your Supabase project values
   (Project Settings → API). Only public values belong here:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   **Never** put the `service_role` key in a Vite app — it gets shipped to the
   browser.

3. Start the checkout server on `:3000` (dashboard routes are proxied to it in
   dev via `vite.config.ts`).

4. Run the app

   ```
   npm run dev
   ```

   Open http://localhost:5173.

## Features

- **Auth** via Supabase Auth (email/password) — sign up, sign in, sign out.
- **Overview** — total & today's earnings, average order, paid orders, top
  products, recent sales.
- **Products** — browse the shared catalogue (read-only) plus your own products
  (add / edit / delete), search by name or barcode.
- **Sales** — every paid order for your store with expandable line items.

## Scripts

- `npm run dev` — Vite dev server with `/api` proxy to `:3000`
- `npm run build` — type-check (`tsc -b`) + production build
- `npm run lint` — ESLint
- `npm run preview` — preview the production build