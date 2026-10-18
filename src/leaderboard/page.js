// /leaderboard: everyone's XP, for signed-in users (linked from the account menu).
import '../explore/style.css';
import './style.css';
import { siteHeader, installShell, pageTitle } from '../shell/shell.js';
import { getSupabase, supabaseEnabled } from '../supabase.js';
import { escape } from '../explore/ui.js';
import { syncXp, loadLeaderboard, missingTable, TOP } from './data.js';

document.title = pageTitle('Leaderboard');
document.body.classList.add('discovery-page', 'leaderboard-page');
document.body.innerHTML = `${siteHeader('leaderboard')}<main class="board-main"></main>`;
installShell();
const main = document.querySelector('main');

const intro = `<p class="eyebrow">EVERY MAKER, ONE SCOREBOARD</p><h1>Leaderboard</h1><p class="board-intro">Earn XP by passing Academy lessons and finishing projects. Your XP is added here whenever you open ReThread signed in.</p>`;

function notice(text) {
  main.innerHTML = `${intro}<p class="board-notice">${text}</p>`;
}

function row(entry, user) {
  const you = entry.user_id === user.id;
  return `<li class="board-row${you ? ' is-you' : ''}"${you ? ' aria-current="true"' : ''}><span class="board-rank">${entry.rank}</span><span class="board-name">@${escape(entry.username)}${you ? ' <small>You</small>' : ''}</span><span class="board-xp">${entry.xp.toLocaleString()} XP</span></li>`;
}

async function show(user) {
  if (!user) return notice('Sign in to see the global leaderboard. Use <strong>Sign in</strong> at the top of the page.');
  main.innerHTML = `${intro}<p class="board-notice" role="status">Loading the leaderboard…</p>`;
  try {
    const me = await syncXp(user);
    const { rows, mine } = await loadLeaderboard({ id: user.id, user_id: user.id, ...me });
    const listed = rows.some((entry) => entry.user_id === user.id);
    main.innerHTML = `${intro}
      <section class="board-you" aria-label="Your place">
        <div><span>Your place</span><strong>#${mine.rank}</strong></div>
        <div><span>Your XP</span><strong>${mine.xp.toLocaleString()}</strong></div>
        <form class="board-name-form" novalidate>
          <label>Your name on the leaderboard<input name="username" value="${escape(mine.username)}" maxlength="30" required autocomplete="nickname" pattern="[a-z0-9._]{2,30}" /></label>
          <button type="submit">Save name</button>
          <p class="board-form-msg" role="status"></p>
        </form>
      </section>
      <h2>Top ${TOP}</h2>
      ${rows.length ? `<ol class="board-list">${rows.map((entry) => row(entry, user)).join('')}${listed ? '' : `<li class="board-gap" aria-hidden="true">…</li>${row(mine, user)}`}</ol>` : '<p class="board-notice">No one is on the board yet.</p>'}`;
    const form = main.querySelector('.board-name-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const msg = form.querySelector('.board-form-msg');
      const username = form.username.value.trim().toLowerCase();
      try {
        await syncXp(user, { username });
        show(user);
      } catch (error) {
        msg.textContent = error.message;
      }
    });
  } catch (error) {
    console.error('[ReThread leaderboard]', error);
    notice(missingTable(error) ? 'The leaderboard isn’t set up yet: run supabase/schema.sql in Supabase.' : `The leaderboard couldn’t load (${escape(error.message || String(error))}). Try again in a moment.`);
  }
}

if (!supabaseEnabled) {
  notice('The leaderboard needs cloud accounts, which aren’t set up on this site.');
} else {
  notice('Loading…');
  let current;
  // Signing in or out from the header updates the page.
  getSupabase().then((supabase) =>
    supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user || null;
      if (user?.id === current?.id && event !== 'INITIAL_SESSION') return;
      current = user;
      setTimeout(() => show(user), 0);
    })
  );
}
