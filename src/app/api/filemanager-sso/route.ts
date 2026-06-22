import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get('domain');
    const owner = searchParams.get('owner');

    if (!domain || !owner) {
      return NextResponse.json({ error: 'Missing domain or owner' }, { status: 400 });
    }

    // Auth check using standard app router client
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter secret e validar
    const secret = process.env.FILEGATOR_SSO_SECRET;
    if (!secret) {
      console.error('FILEGATOR_SSO_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const homedir = `/home/${owner}/domains/${domain}/public_html`;
    const user = owner; // Using the directadmin username as the FileGator username
    const exp = Math.floor(Date.now() / 1000) + 60; // 60 seconds validity

    const data = {
      user,
      homedir,
      exp
    };

    const jsonStr = JSON.stringify(data);
    let b64 = Buffer.from(jsonStr).toString('base64');
    
    // PHP strtr($b64, '+/', '-_') equivalent
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_');

    // SHA256 HMAC
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(b64);
    const sig = hmac.digest('hex'); // the PHP script checks with hash_equals, which expects hex or binary? 
    // Wait, hash_hmac in PHP returns hex string by default.

    const token = `${b64}.${sig}`;
    
    const host = process.env.NEXT_PUBLIC_DIRECTADMIN_HOST || 'host.visualdesignmoz.com';
    const redirectUrl = `https://${host}/files/sso.php?t=${token}`;

    return NextResponse.redirect(redirectUrl);

  } catch (err: any) {
    console.error('SSO Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
