# Timeregistrering

Norsk tidsregistreringsapp for bedrifter — inn/ut-stempling, fraværssøknader, overtidsberegning, godkjenningsflyt og lønnseksport.

## Teknologi

- **client/** — React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + React Router
- **server/** — Node.js + Express + TypeScript
- **shared/** — Delte TypeScript-typer
- **supabase/** — SQL-migrasjoner

## Kom i gang

### 1. Opprett Supabase-prosjekt

Gå til [supabase.com](https://supabase.com) og opprett et nytt prosjekt.

### 2. Kjør migrasjoner

I Supabase SQL-editoren, kjør migrasjonene i rekkefølge:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_absence_codes.sql
supabase/migrations/004_seed_overtime_rules.sql
```

### 3. Konfigurer miljøvariabler

**Server:**
```bash
cp server/.env.example server/.env
# Fyll inn SUPABASE_URL og SUPABASE_SERVICE_KEY (service role key)
```

**Client:**
```bash
cp client/.env.example client/.env
# Fyll inn VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY (anon/public key)
```

### 4. Installer og bygg shared

```bash
npm install
npm run build -w shared
```

### 5. Opprett første admin-bruker

I Supabase Authentication → Users, opprett en bruker manuelt. Legg så til en rad i `users`-tabellen:

```sql
INSERT INTO users (id, employee_number, name, role)
VALUES ('<auth-user-id>', '001', 'Admin Bruker', 'admin');
```

### 6. Start applikasjonen

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

## Brukerroller

| Rolle | Tilgang |
|-------|---------|
| `ansatt` | Egne timer, fravær, fleksitidssaldo |
| `leder` | Team-oversikt, godkjenning av timer og fravær |
| `admin` | Brukere, arbeidsplaner, overtidsregler, fraværskoder |
| `lonningsansvarlig` | Lønnsrapporter og XLSX/CSV-eksport |

## Verifisering

```bash
# Typesjekk alle pakker
npm run typecheck

# Start dev-server
npm run dev
```

**Manuell testflyt:**
1. Logg inn som ansatt → stempl inn → stempl ut → send inn timer
2. Logg inn som leder → godkjenn timer
3. Verifiser at fleksitidssaldo er oppdatert på ansatt-dashbordet
4. Logg inn som lønningsansvarlig → velg periode → last ned XLSX-eksport

## Arkitektur

```
Klient (Supabase Auth)
  ↓ JWT-token
Server (Express + Supabase admin client)
  ↓ Service Role (omgår RLS)
PostgreSQL (Supabase)
```

All dataaksess skjer via Express-serveren. Supabase Auth håndterer innlogging; JWT-token valideres av serveren på hvert API-kall.

## Fase 2 (ikke implementert)

Integrasjon med Huma (HR) og Xledger (lønn) via API er designet for fremtidig implementering. Lønnseksport-formatet er kompatibelt med standard lønnsimportsystemer.
