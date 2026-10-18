// Global XP leaderboard (supabase/schema.sql). Lesson and project XP is earned
// and stored in this browser (src/tutorial/store.js); signed-in users copy it to
// the `leaderboard` table. Explore posts score in the database itself.
import { getSupabase } from '../supabase.js';
import { getRewardSummary } from '../tutorial/store.js';
import { USERNAME, suggestUsername } from '../explore/posts.js';

const TABLE = 'leaderboard';
// Browser XP plus Explore posts, ranked by the `leaderboard_totals` view.
const TOTALS = 'leaderboard_totals';
// XP per Explore post. The view in supabase/schema.sql uses the same number.
export const POST_XP = 25;
// The same public name people use when posting to Explore.
const NAME_KEY = 'rethread.explore.username';
export const TOP = 50;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function localXp() {
  const store = storage();
  return store ? getRewardSummary(store).xp : 0;
}

function savedName(user) {
  try {
    const name = storage()?.getItem(NAME_KEY);
    if (USERNAME.test(name || '')) return name;
  } catch {
    /* The saved name is only a convenience. */
  }
  return suggestUsername(user.email);
}

export const missingTable = (error) => error?.code === 'PGRST205' || error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '');

// Records this browser's XP on the user's row and returns that row.
// XP only goes up: a new device with no local progress keeps the higher score.
export async function syncXp(user, { username } = {}) {
  const supabase = await getSupabase();
  const { data: mine, error } = await supabase.from(TABLE).select('username,xp').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (username) {
    if (!USERNAME.test(username)) throw Error('Your name needs 2–30 lowercase letters, numbers, dots or underscores.');
    try {
      storage()?.setItem(NAME_KEY, username);
    } catch {
      /* The saved name is only a convenience. */
    }
  }
  const row = { username: username || mine?.username || savedName(user), xp: Math.max(localXp(), mine?.xp || 0) };
  if (mine && mine.username === row.username && mine.xp === row.xp) return mine;
  const { error: saveError } = await supabase.from(TABLE).upsert({ user_id: user.id, ...row, updated_at: new Date().toISOString() });
  if (saveError) throw saveError;
  return row;
}

// The top players, ranked so equal XP shares a place, plus the user's own place.
export async function loadLeaderboard(user) {
  const supabase = await getSupabase();
  const { data: own, error: ownError } = await supabase.from(TOTALS).select('user_id,username,xp,posts').eq('user_id', user.id).maybeSingle();
  if (ownError) throw ownError;
  const me = own || { user_id: user.id, username: savedName(user), xp: 0, posts: 0 };
  const { data, error } = await supabase.from(TOTALS).select('user_id,username,xp').order('xp', { ascending: false }).order('updated_at', { ascending: true }).limit(TOP);
  if (error) throw error;
  let place = 0;
  const rows = data.map((row, i) => {
    if (i === 0 || row.xp !== data[i - 1].xp) place = i + 1;
    return { ...row, rank: place };
  });
  const listed = rows.find((row) => row.user_id === user.id);
  if (listed) return { rows, mine: { ...listed, posts: me.posts } };
  const { count, error: rankError } = await supabase.from(TOTALS).select('user_id', { count: 'exact', head: true }).gt('xp', me.xp);
  if (rankError) throw rankError;
  return { rows, mine: { ...me, rank: (count || 0) + 1 } };
}
