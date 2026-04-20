# Produktionschecklista - Kodiprint

Saker att ha koll på innan produktionssättning.

---

## KRITISKT (Måste fixas innan lansering)

### Autentisering & Hemligheter
- [ ] **Byt admin-lösenord** — `admin123` i .env.local måste bytas till ett starkt lösenord
- [ ] **Rotera alla API-nycklar** — Stripe test-nyckel, publishable key, admin secret (`kodiprint-admin-2024`), revalidation secret (`kodiprint-revalidate-secret`)
- [ ] **Byt till Stripe live-nycklar** — Test-nycklar ligger i .env.local
- [ ] **Se till att .env.local ALDRIG committas** — Verifiera .gitignore

### Uppladdningar
- [ ] **Rate limiting på `/api/upload/konfigurator-logo`** — Ingen autentisering eller rate limit idag. Kan spammas med 10MB-filer tills disken är full
- [ ] **Rensa gamla konfigurator-snapshots** — Cron-jobb eller TTL, t.ex. radera filer äldre än 7 dagar i `public/uploads/konfigurator/`
- [ ] **Filkvot per session/IP** — Max antal uppladdningar per timme

### CSRF-skydd
- [ ] **Lägg till CSRF-tokens** på alla state-changing POST-routes (cart, settings, login)

---

## HÖGT (Bör fixas innan lansering)

### Miljökonfiguration
- [ ] **Ta bort localhost-fallback** — Flera filer har `|| 'http://localhost:9000'`. Om env-variabeln saknas i produktion kopplas den tyst mot localhost
- [ ] **Skapa .env.production.example** — Mall för produktionsmiljövariabler
- [ ] **Validera env-variabler vid uppstart** — `check-env-variables.js` kollar bara publishable key. Lägg till: `MEDUSA_BACKEND_URL`, `ADMIN_SECRET`, `STRIPE_PUBLIC_KEY`

### Rate limiting
- [ ] **Cart-operationer** (`/api/cart/add`, `/remove`, `/update`) — Saknar rate limiting
- [ ] **Produkt-API:er** — Inga begränsningar idag

### Content Security Policy
- [ ] **Ta bort `unsafe-eval` och `unsafe-inline`** från CSP i middleware.ts — Använd nonces istället
- [ ] **HSTS** — Verifiera att Strict-Transport-Security bara sätts i produktion

### Cookies
- [ ] **Verifiera `secure: true`** — Sätts via `NODE_ENV === 'production'`. Kontrollera att NODE_ENV är korrekt i deployment

### Filuppladdning
- [ ] **Validera MIME-typ server-side** (inte bara Content-Type-headern, som kan fejkas)
- [ ] **Överväg virusskanning** på uppladdade filer
- [ ] **PDF-preview** — Uppladdade PDF:er visas inte korrekt, TODO finns i koden

---

## MEDEL (Bör fixas inom 1-2 veckor efter lansering)

### Infrastruktur
- [ ] **Skapa Dockerfile** — Standardisera deployment-miljön
- [ ] **Extern fillagring (S3/R2)** — Flytta uploads från lokal disk till object store med auto-expiry
- [ ] **Strukturerad logging** — Idag loggas allt till console. Implementera persistent logging (t.ex. Axiom, Datadog, Sentry)
- [ ] **Felövervakning** — Sentry eller liknande för att fånga runtime-fel

### Build & Kvalitet
- [ ] **Fixa TypeScript-fel** — `next.config.js` ignorerar TS-fel vid build (`ignoreBuildErrors: true`). Fixa underliggande fel istället
- [ ] **Fixa ESLint-fel** — Även det ignorerat vid build (`ignoreDuringBuilds: true`)
- [ ] **Lägg till tester** — Inga tester finns. Minst: cart-flöde, checkout, föreningslogin
- [ ] **Lägg till `typecheck`-script** i package.json: `"typecheck": "tsc --noEmit"`

### SEO
- [ ] **Skapa robots.txt**
- [ ] **Verifiera sitemap-generering** — `next-sitemap.js` finns men output saknas
- [ ] **Meta-taggar** — Kontrollera OG-taggar och canonical URLs på alla sidor

### Betalning
- [ ] **Stripe webhooks** — Verifiera att Medusa-backend hanterar Stripe webhooks korrekt (orderbekräftelse, betalningsstatus)
- [ ] **Testa hela betalflödet** med live-nycklar i staging

---

## LÖPANDE

- [ ] Uppdatera dependencies regelbundet (speciellt säkerhetsfixar)
- [ ] Övervaka loggar och felrapporter
- [ ] Granska nya upload-filer/diskutrymme
- [ ] Säkerhetsskanning av dependencies (`npm audit`)
- [ ] Testa checkout-flödet manuellt efter varje deploy

---

## Kända tekniska skulder

| Fil | Problem |
|---|---|
| `api/forening/change-password/route.ts` | Implementationen är ofullständig, fallback till "glömt lösenord" |
| `api/forening/upload-logo/route.ts` | PDF-till-PNG konvertering saknas (TODO i koden) |
| `lib/medusa-admin-auth.ts` | Admin-token cachas i 20h utan invalidering |
| `next.config.js` | TS-fel och ESLint ignoreras vid build |
| `api/upload/konfigurator-logo` | Inga uppladdningsgränser per användare/session |
