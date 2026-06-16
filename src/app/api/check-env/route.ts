export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return new Response(
    JSON.stringify({
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).host : '(empty)',
      supabaseConfigured: Boolean(supabaseUrl && anonKey),
      isHetzner: supabaseUrl.includes('supabase.visualdesignmoz.com'),
      isCloud: supabaseUrl.includes('supabase.co'),
      panelUrl: process.env.NEXT_PUBLIC_PANEL_URL || '(empty)',
      publicSiteUrl: process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '(empty)',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '(empty)',
      passwordResetSmtp: process.env.PASSWORD_RESET_USE_SITE_SMTP || '(unset)',
      smtpHost: process.env.SMTP_HOST || '(empty)',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
