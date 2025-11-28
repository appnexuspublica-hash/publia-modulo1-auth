// scripts/test-env.ts
import 'dotenv/config';

function head(x?: string | null, n = 12) {
  return x ? x.slice(0, n) : '';
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const signup = process.env.SIGNUP_TOKEN || '';
const redir = process.env.REDIRECT_BLOCKED_SIGNUP || '';

console.log('🔍 NEXT_PUBLIC_SUPABASE_URL =', url);
console.log('🔍 URL Host =', (() => { try { return new URL(url).host } catch { return 'INVALID_URL' } })());
console.log('🔐 ANON length =', anon.length, 'head =', head(anon));
console.log('🛡️ SERVICE length =', service.length, 'head =', head(service));
console.log('🪪 SIGNUP_TOKEN =', signup ? 'OK' : 'MISSING');
console.log('↩️  REDIRECT_BLOCKED_SIGNUP =', redir || 'MISSING');
