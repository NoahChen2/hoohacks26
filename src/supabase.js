const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Cloud accounts are opt-in when configured, and can be explicitly disabled for
// local development even if credentials are present. No .env file is required.
const enabled = import.meta.env.VITE_SUPABASE_ENABLED?.trim().toLowerCase() !== 'false';

function validUrl() {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    // Invalid or placeholder configuration must not prevent local use.
    return false;
  }
}

export const supabaseEnabled = enabled && !!url && !!key && validUrl();

// The client library is loaded on demand so it stays off the startup path.
let client = null;
export function getSupabase() {
  client ||= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key));
  return client;
}
