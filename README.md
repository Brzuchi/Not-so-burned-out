# Výzvy — sdílený tracker pro dva

Jednoduchá webová appka, kde si ty a Matěj zaklikáváte denní progress osobních
výzev a vidíte se navzájem v reálném čase. Čistý HTML/CSS/JS + Supabase, hostuje
se zdarma na GitHub Pages. Žádný build krok.

```
habit-tracker/
├── index.html
├── css/styles.css
└── js/
    ├── supabase-config.js   ← jediný soubor, který upravuješ
    ├── db.js
    └── app.js
```

---

## 1) Založ databázi v Supabase

1. Jdi na <https://supabase.com> → **Sign in** (přes GitHub) → **New project**.
   Zvol název, silné databázové heslo a region (klidně Frankfurt). Free plán stačí.
2. Po vytvoření otevři vlevo **SQL Editor** → **New query**, vlož celý blok
   níže a klikni **Run**:

```sql
-- Tabulka výzev
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  owner       text not null check (owner in ('me','matej')),
  name        text not null,
  goal        text not null default '',
  frequency   text not null default 'daily' check (frequency in ('daily','weekly')),
  completions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Zapnout Row Level Security
alter table public.challenges enable row level security;

-- Práva pro veřejný (nepřihlášený) přístup – appka pro dva kamarády
grant select, insert, update, delete on public.challenges to anon, authenticated;

-- Pravidla: kdokoli s adresou appky smí číst i zapisovat
drop policy if exists "verejne cteni"  on public.challenges;
drop policy if exists "verejny zapis"  on public.challenges;
drop policy if exists "verejna uprava" on public.challenges;
drop policy if exists "verejne mazani" on public.challenges;

create policy "verejne cteni"  on public.challenges for select using (true);
create policy "verejny zapis"  on public.challenges for insert with check (true);
create policy "verejna uprava" on public.challenges for update using (true) with check (true);
create policy "verejne mazani" on public.challenges for delete using (true);

-- Zapnout realtime pro tuto tabulku
alter publication supabase_realtime add table public.challenges;
```

> Pokud poslední řádek hlásí, že tabulka už v publikaci je, klidně to ignoruj.

---

## 2) Vlož klíče do `js/supabase-config.js`

V Supabase otevři **Settings → API Keys** (nebo tlačítko **Connect** nahoře).
Zkopíruj:

- **Project URL** → do `SUPABASE_URL`
- **Publishable key** (`sb_publishable_…`) → do `SUPABASE_KEY`

> Publishable key je určený do veřejného kódu — je v pořádku ho commitnout.
> **Nikdy** sem nedávej *secret* / *service_role* klíč. (Pokud máš starší projekt
> a vidíš jen „anon key", použij ten — funguje stejně.)

---

## 3) Vyzkoušej lokálně

ES moduly se nenačtou přes `file://`, spusť tedy mini server:

```bash
cd habit-tracker
python3 -m http.server 8000
# otevři http://localhost:8000
```

Přidej výzvu, zaklikni dnešek. Otevři stejnou adresu v druhém okně — změna
se objeví okamžitě (realtime).

---

## 4) Nahraj na GitHub

**Přes web (nejjednodušší):**
1. <https://github.com/new> → název repa např. `vyzvy` → **Public** → **Create**.
2. Na stránce repa **Add file → Upload files**, přetáhni obsah složky
   `habit-tracker` (tedy `index.html`, složky `css` a `js`) → **Commit changes**.

**Nebo přes terminál:**
```bash
cd habit-tracker
git init
git add .
git commit -m "Výzvy – tracker"
git branch -M main
git remote add origin https://github.com/UZIVATEL/vyzvy.git
git push -u origin main
```

---

## 5) Zapni GitHub Pages

V repu **Settings → Pages** → *Build and deployment* → **Source: Deploy from a
branch** → branch **main**, složka **/ (root)** → **Save**. Za chvíli se nahoře
objeví adresa typu `https://UZIVATEL.github.io/vyzvy/`. Tu pošli Matějovi —
oba uvidíte stejná data.

---

## Bezpečnost — na rovinu

Pravidla výše jsou otevřená: kdokoli, kdo zná adresu appky, může data číst i
měnit. Pro tracker dvou kamarádů bez citlivých dat je to v pohodě. Když budeš
chtít přitvrdit, jde doplnit anonymní přihlášení Supabase Auth a pravidla
omezit na `auth.uid()` — řekni a pošlu rozšíření.

## Drobné úpravy

- Jména profilů: pole `PROFILES` v `js/supabase-config.js`.
- Barvy každé osoby: `--accent-me` a `--accent-matej` v `css/styles.css`.
