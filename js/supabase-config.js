/* =========================================================
   NASTAVENÍ — uprav jen tento soubor.

   1) Vytvoř projekt na https://supabase.com
   2) Otevři projekt → Settings → API Keys  (nebo tlačítko "Connect")
   3) Zkopíruj sem "Project URL" a "Publishable key" (sb_publishable_...)

   Publishable key je BEZPEČNÉ mít ve veřejném kódu — je to klíč
   s nízkými právy. Data chrání RLS pravidla, která nastavíš v SQL
   (viz README). NIKDY sem nedávej "secret" / "service_role" klíč.
   ========================================================= */

export const SUPABASE_URL = 'https://tfgtrvpzzdszdjnzxrdj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_BHJFvo1pDcmKbndJvzaC7Q_tU2PQ8uH';

/* Jména a pořadí profilů — klidně si přepiš popisky. */
export const PROFILES = [
  { id: 'me',    label: 'Kokotko' },
  { id: 'matej', label: 'Pičko' },
];

/* Pomocná kontrola, jestli jsou údaje doplněné. */
export const isConfigured =
  !SUPABASE_URL.includes('VAS-PROJEKT') &&
  !SUPABASE_KEY.includes('SEM-VLOZTE');
