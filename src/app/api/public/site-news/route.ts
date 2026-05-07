import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { localizeNewsItem, type SiteNewsLanguage, type SiteNewsRecord } from '@/lib/site-news';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteSlug = searchParams.get('site_slug') || 'aamihe';
    const language = (searchParams.get('lang') || 'pt') as SiteNewsLanguage;
    const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10) || 6, 24);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase público não configurado.' },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('site_news')
      .select('*')
      .eq('site_slug', siteSlug)
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const news = ((data || []) as SiteNewsRecord[]).map(item => localizeNewsItem(item, language));
    return NextResponse.json({ success: true, news }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
