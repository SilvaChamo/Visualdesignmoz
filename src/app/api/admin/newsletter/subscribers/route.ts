import { NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';

// Note: Using createClient from supabase-js for server-side if needed, 
// but since we have a browser client, we'll adapt or use the service role for admin tasks.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    let query = supabaseAdmin.from('newsletter_subscribers').select('*');
    
    if (email) {
        query = query.ilike('email', `%${email}%`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, full_name, tags, metadata } = body;
        
        if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        
        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .upsert({ 
                email, 
                full_name, 
                tags: tags || [], 
                metadata: metadata || {},
                status: 'subscribed',
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' })
            .select();
            
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    const { error } = await supabaseAdmin
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id);
        
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
