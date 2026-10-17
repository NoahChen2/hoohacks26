import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Cloud accounts are opt-in when configured, and can be explicitly disabled for
// local development even if credentials are present. No .env file is required.
const enabled = import.meta.env.VITE_SUPABASE_ENABLED?.trim().toLowerCase() !== 'false';

function configuredClient() {
  if (!enabled || !url || !key) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return createClient(url, key);
  } catch {
    // Invalid or placeholder configuration must not prevent local use.
    return null;
  }
}

export const supabase = configuredClient();
export const supabaseEnabled = supabase !== null;
