import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { title, content } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
      Traduza a seguinte notícia para Inglês (EN) e Francês (FR). 
      Mantenha um tom profissional e jornalístico.
      
      Título Original (PT): ${title}
      Conteúdo Original (PT): ${content}
      
      Responda APENAS em formato JSON com as seguintes chaves:
      {
        "title_en": "...",
        "content_en": "...",
        "title_fr": "...",
        "content_fr": "..."
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return NextResponse.json({ success: true, translations: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
