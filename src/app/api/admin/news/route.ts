import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { createExcerpt, slugifyNewsTitle } from '@/lib/site-news';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role não configurado.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function translateNews(title: string, content: string) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      title_en: title,
      content_en: content,
      title_fr: title,
      content_fr: content,
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Traduza esta notícia institucional para Inglês e Francês, mantendo tom profissional e jornalístico. Responda apenas JSON com title_en, content_en, title_fr, content_fr.\n\nTítulo PT: ${title}\n\nConteúdo PT: ${content}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

export async function GET(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const siteSlug = searchParams.get('site_slug') || 'aamihe';
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('site_news')
      .select('*')
      .eq('site_slug', siteSlug)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, news: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const siteSlug = body.site_slug || 'aamihe';
    const titlePt = String(body.title_pt || '').trim();
    const contentPt = String(body.content_pt || '').trim();

    if (!titlePt || !contentPt) {
      return NextResponse.json(
        { success: false, error: 'Título e conteúdo em Português são obrigatórios.' },
        { status: 400 },
      );
    }

    const translations = body.auto_translate === false
      ? {
          title_en: body.title_en || titlePt,
          content_en: body.content_en || contentPt,
          title_fr: body.title_fr || titlePt,
          content_fr: body.content_fr || contentPt,
        }
      : await translateNews(titlePt, contentPt);

    const published = body.published !== false;
    const payload = {
      site_slug: siteSlug,
      slug: body.slug || slugifyNewsTitle(titlePt),
      title_pt: titlePt,
      content_pt: contentPt,
      title_en: translations.title_en || titlePt,
      content_en: translations.content_en || contentPt,
      title_fr: translations.title_fr || titlePt,
      content_fr: translations.content_fr || contentPt,
      excerpt_pt: body.excerpt_pt || createExcerpt(contentPt),
      excerpt_en: body.excerpt_en || createExcerpt(translations.content_en || contentPt),
      excerpt_fr: body.excerpt_fr || createExcerpt(translations.content_fr || contentPt),
      image_url: body.image_url || null,
      gallery_urls: Array.isArray(body.gallery_urls) ? body.gallery_urls : [],
      published,
      published_at: published ? (body.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdmin();
    const query = body.id
      ? supabase.from('site_news').update(payload).eq('id', body.id).select().single()
      : supabase.from('site_news').insert(payload).select().single();

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, news: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('site_news').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
