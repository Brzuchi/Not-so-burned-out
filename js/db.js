/* =========================================================
   Vrstva databáze — připojení k Supabase, čtení/zápis, realtime.
   Tady nic upravovat nemusíš.
   ========================================================= */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* Načte všechny výzvy obou profilů, seřazené od nejstarší. */
export async function fetchChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* Přidá novou výzvu. */
export async function addChallenge({ owner, name, goal, frequency }) {
  const { error } = await supabase
    .from('challenges')
    .insert({ owner, name, goal, frequency, completions: {} });
  if (error) throw error;
}

/* Uloží upravenou mapu splněných dní (completions). */
export async function saveCompletions(id, completions) {
  const { error } = await supabase
    .from('challenges')
    .update({ completions })
    .eq('id', id);
  if (error) throw error;
}

/* Smaže výzvu. */
export async function removeChallenge(id) {
  const { error } = await supabase.from('challenges').delete().eq('id', id);
  if (error) throw error;
}

/* Realtime: zavolá onChange při jakékoli změně v tabulce challenges. */
export function subscribeToChanges(onChange) {
  return supabase
    .channel('challenges-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'challenges' },
      onChange
    )
    .subscribe();
}
