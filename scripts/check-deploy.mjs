import nextEnv from '@next/env';

// Read locally without logging values. On Netlify values come from the site environment.
nextEnv.loadEnvConfig(process.cwd(), false);
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME', 'SITE_URL'];
const errors = required.filter(name => !process.env[name]?.trim()).map(name => `${name}: missing`);
const mode = process.env.EMAIL_TRANSPORT?.trim();
if ((process.env.EMAIL_TRANSPORT ?? '') !== (mode ?? '')) errors.push('EMAIL_TRANSPORT: whitespace is not allowed');
if (mode && mode !== 'brevo') errors.push('EMAIL_TRANSPORT: deployment requires brevo or unset');
if (process.env.SITE_URL) {
  try {
    const url = new URL(process.env.SITE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash ||
        /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(url.hostname) ||
        /\.(example|test|invalid|local|localhost)$/.test(url.hostname)) {
      errors.push('SITE_URL: requires the real public HTTPS site origin');
    }
    if (process.env.NETLIFY === 'true' && process.env.URL && new URL(process.env.URL).origin !== url.origin) {
      errors.push('SITE_URL: must match this Netlify site stable URL (including its primary domain)');
    }
  } catch { errors.push('SITE_URL: invalid URL'); }
}
if (errors.length) {
  console.error('Deployment configuration blocked:\n' + errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Deployment variables present; real transport selected. Credentials, sender and live routes still need smoke verification.');
}
