// Login / account UI + cloud sync of the user's body, closet and tools to Supabase.

import { getSupabase, supabaseEnabled } from '../supabase.js';
import { subscribe, snapshot, replaceState, useStorage, guestData } from '../state.js';
import { escapeHtml } from './escape.js';

const TABLE = 'user_data';
const SKIP = new Set(['tab', 'reset', 'goto:upcycle']);

let user = null;
let status = 'idle'; // idle | loading | saving | saved | error | nodb
let statusMsg = '';
let loading = false;
let pushTimer = null;
let root;

export function initAccount(el) {
  root = el;
  if (!supabaseEnabled) {
    root.innerHTML = '<span class="acct-chip muted" title="Guest mode: your changes are saved in this browser. Cloud accounts are unavailable.">Guest · saved on this device</span>';
    return;
  }
  render();

  getSupabase().then((supabase) => supabase.auth.onAuthStateChange((event, session) => {
    // Supabase advises against awaiting its own calls inside this callback.
    setTimeout(() => handleAuth(event, session), 0);
  }));

  subscribe((reason) => {
    if (!user || loading || SKIP.has(reason)) return;
    schedulePush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pushTimer) flush();
  });
}

async function handleAuth(event, session) {
  const next = session?.user || null;
  if (next?.id === user?.id) {
    if (next) user = next;
    render();
    return;
  }
  if (next) await enterAccount(next);
  else leaveAccount();
}

async function enterAccount(u) {
  const wasGuest = !user;
  user = u;
  loading = true;
  setStatus('loading');
  closeModal();
  // show this account's cached copy straight away, then reconcile with the server
  const guestSnapshot = wasGuest ? snapshot() : null;
  const cached = useStorage(u.id);
  if (cached) replaceState(cached);

  const { data, error } = await (await getSupabase()).from(TABLE).select('data').eq('user_id', u.id).maybeSingle();
  if (error) {
    loading = false;
    return failed(error);
  }
  if (data?.data && Object.keys(data.data).length) {
    replaceState(data.data);
    loading = false;
    setStatus('saved');
  } else {
    // first sign-in: carry over whatever they built as a guest
    if (!cached && guestSnapshot) replaceState(guestSnapshot);
    loading = false;
    await push();
  }
}

function leaveAccount() {
  clearTimeout(pushTimer);
  pushTimer = null;
  user = null;
  useStorage(null);
  const g = guestData();
  if (g) replaceState(g);
  setStatus('idle');
}

function schedulePush() {
  setStatus('saving');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 900);
}

function flush() {
  clearTimeout(pushTimer);
  push();
}

async function push() {
  pushTimer = null;
  if (!user) return;
  setStatus('saving');
  const { error } = await (await getSupabase()).from(TABLE).upsert({ user_id: user.id, data: snapshot(), updated_at: new Date().toISOString() });
  if (error) return failed(error);
  setStatus('saved');
}

function failed(error) {
  console.error('[ReThread sync]', error);
  const missingTable = error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '');
  setStatus(missingTable ? 'nodb' : 'error', missingTable ? 'Database table not set up yet: run supabase/schema.sql' : error.message);
}

function setStatus(s, msg = '') {
  status = s;
  statusMsg = msg;
  render();
}

// ---------------------------------------------------------------- top-bar UI

const STATUS_TEXT = {
  idle: '',
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
  nodb: 'Not saved',
};

function render() {
  if (!root) return;
  if (!user) {
    root.innerHTML = `<button class="btn small" id="acct-signin">Sign in</button>`;
    root.querySelector('#acct-signin').addEventListener('click', () => openModal('signin'));
    return;
  }
  const email = user.email || 'Account';
  root.innerHTML = `
    <div class="acct">
      <button class="acct-chip" id="acct-toggle" aria-haspopup="true">
        <span class="sync-dot ${status}"></span>
        <span class="acct-status">${STATUS_TEXT[status]}</span>
        <span class="avatar">${email[0].toUpperCase()}</span>
      </button>
      <div class="acct-menu" id="acct-menu" hidden>
        <div class="acct-email">${escapeHtml(email)}</div>
        <div class="acct-line ${status}">${statusMsg ? escapeHtml(statusMsg) : status === 'saved' ? 'Your closet is saved to your account.' : STATUS_TEXT[status]}</div>
        <button class="btn small ghost" id="acct-sync">Sync now</button>
        <button class="btn small ghost danger" id="acct-out">Sign out</button>
      </div>
    </div>`;
  const menu = root.querySelector('#acct-menu');
  root.querySelector('#acct-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', () => (menu.hidden = true), { once: true });
  menu.addEventListener('click', (e) => e.stopPropagation());
  root.querySelector('#acct-sync').addEventListener('click', flush);
  root.querySelector('#acct-out').addEventListener('click', async () => {
    if (pushTimer) await push();
    await (await getSupabase()).auth.signOut();
  });
}

// ---------------------------------------------------------------- sign-in modal

let modal;

function openModal(mode = 'signin') {
  closeModal();
  modal = document.createElement('div');
  modal.className = 'overlay auth-overlay';
  modal.innerHTML = `
    <form class="auth-card" novalidate>
      <div class="auth-brand">ReThread</div>
      <h2 id="auth-title"></h2>
      <p class="auth-sub" id="auth-sub"></p>
      <label class="lbl">Email<input type="email" name="email" autocomplete="email" required /></label>
      <label class="lbl" id="pw-wrap">Password<input type="password" name="password" minlength="6" autocomplete="current-password" required /></label>
      <div class="auth-msg" id="auth-msg" hidden></div>
      <button class="btn auth-submit" type="submit" id="auth-submit"></button>
      <div class="auth-links">
        <button type="button" class="linkish" id="auth-switch"></button>
        <button type="button" class="linkish" id="auth-forgot">Forgot password?</button>
      </div>
      <button type="button" class="linkish guest" id="auth-guest">Continue as guest (saved on this device only)</button>
    </form>`;
  document.body.appendChild(modal);
  const form = modal.querySelector('form');
  const msg = modal.querySelector('#auth-msg');
  const show = (text, kind = 'error') => {
    msg.hidden = false;
    msg.className = `auth-msg ${kind}`;
    msg.textContent = text;
  };

  const setMode = (m) => {
    mode = m;
    msg.hidden = true;
    const t = {
      signin: ['Welcome back', 'Sign in to load your body measurements and closet.', 'Sign in', 'New here? Create an account'],
      signup: ['Create your account', 'Save your measurements and closet, and open them on any device.', 'Create account', 'Have an account? Sign in'],
      reset: ['Reset password', 'We’ll email you a link to set a new password.', 'Send reset link', 'Back to sign in'],
    }[m];
    modal.querySelector('#auth-title').textContent = t[0];
    modal.querySelector('#auth-sub').textContent = t[1];
    modal.querySelector('#auth-submit').textContent = t[2];
    modal.querySelector('#auth-switch').textContent = t[3];
    modal.querySelector('#pw-wrap').hidden = m === 'reset';
    modal.querySelector('#auth-forgot').hidden = m !== 'signin';
    form.password.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  };
  setMode(mode);

  modal.querySelector('#auth-switch').addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
  modal.querySelector('#auth-forgot').addEventListener('click', () => setMode('reset'));
  modal.querySelector('#auth-guest').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => e.target === modal && closeModal());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Enter a valid email address.');
    if (mode !== 'reset' && password.length < 6) return show('Password must be at least 6 characters.');
    const btn = modal.querySelector('#auth-submit');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Please wait…';
    try {
      if (mode === 'signin') {
        const { error } = await (await getSupabase()).auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await (await getSupabase()).auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) show(`Check ${email} for a confirmation link, then sign in.`, 'info');
      } else {
        const { error } = await (await getSupabase()).auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (error) throw error;
        show(`If an account exists for ${email}, a reset link is on its way.`, 'info');
      }
    } catch (err) {
      show(friendly(err));
    } finally {
      if (modal) {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  });
  setTimeout(() => form.email.focus(), 30);
}

function closeModal() {
  modal?.remove();
  modal = null;
}

function friendly(err) {
  const m = err?.message || String(err);
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox).';
  if (/already registered/i.test(m)) return 'That email already has an account. Try signing in.';
  if (/rate limit/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  return m;
}
