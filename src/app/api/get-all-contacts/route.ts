import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey);

const ALLOWED_DOMAINS = [
  'visualdesignmoz.com',
  'visualdesignmoz.com',
  'anap.co.mz',
  'entrecampos.co.mz'
];

/**
 * GET /api/get-all-contacts
 * Retorna contactos consolidados de:
 * 1. CyberPanel (emails do domínio)
 * 2. Supabase (contactos salvos pelos usuários)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain') || 'visualdesignmoz.com';
  const includeSupabase = searchParams.get('includeSupabase') !== 'false'; // true por padrão

  try {
    let allContacts: Set<string> = new Set();
    const contactsMap: Record<string, { email: string; source: 'cyberpanel' | 'supabase'; nome?: string }> = {};

    // ========== 1. BUSCAR DO CYBERPANEL ==========
    console.log(`📧 [Contacts API] Buscando emails do CyberPanel para ${domain}`);
    
    try {
      const cleanDomain = domain.replace(/[^a-zA-Z0-9_.-]/g, '');
      const command = `mysql -D cyberpanel -e "SELECT email FROM e_users WHERE emailOwner_id='${cleanDomain}';" -B -N`;
      
      const raw = await executeCyberPanelCommand(command);
      
      if (raw && raw.trim()) {
        const lines = raw.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.includes('ERROR') && !trimmed.includes('error')) {
            const email = trimmed.toLowerCase();
            
            // 🚫 FILTRO: Ignorar emails inválidos
            if (!shouldFilterOut(email)) {
              allContacts.add(email);
              contactsMap[email] = {
                email,
                source: 'cyberpanel',
                nome: email.split('@')[0]
              };
            }
          }
        }
      }
      
      console.log(`✅ [Contacts API] CyberPanel: ${allContacts.size} emails válidos`);
    } catch (error) {
      console.error('❌ [Contacts API] Erro ao buscar do CyberPanel:', error);
    }

    // ========== 2. BUSCAR DO SUPABASE ==========
    if (includeSupabase) {
      console.log(`📧 [Contacts API] Buscando contactos do Supabase para ${domain}`);
      
      try {
        const { data: contacts, error } = await supabaseAdmin
          .from('email_contas')
          .select('email, nome, cliente_id')
          .ilike('email', `%@${domain}`)
          .eq('status', 'active');
        
        if (error) {
          console.error('❌ [Contacts API] Erro ao buscar Supabase:', error);
        } else if (contacts && contacts.length > 0) {
          for (const contact of contacts) {
            const email = contact.email?.toLowerCase();
            if (email && !shouldFilterOut(email)) {
              // Usar Supabase se não existir no CyberPanel, ou manter CP como primário
              if (!contactsMap[email]) {
                allContacts.add(email);
                contactsMap[email] = {
                  email,
                  source: 'supabase',
                  nome: contact.nome || email.split('@')[0]
                };
              }
            }
          }
        }
        
        console.log(`✅ [Contacts API] Supabase adicionou ${Object.values(contactsMap).filter(c => c.source === 'supabase').length} contactos`);
      } catch (error) {
        console.error('❌ [Contacts API] Erro ao buscar Supabase:', error);
      }
    }

    // Converter Set para array ordenado
    const emails = Array.from(allContacts).sort();

    console.log(`🎯 [Contacts API] Total consolidado: ${emails.length} contactos`);

    return NextResponse.json({
      success: true,
      domain,
      emails,
      contacts: Object.values(contactsMap), // Array com detalhes de cada contacto
      count: emails.length,
      stats: {
        cyberpanel: Object.values(contactsMap).filter(c => c.source === 'cyberpanel').length,
        supabase: Object.values(contactsMap).filter(c => c.source === 'supabase').length,
      }
    });

  } catch (error: any) {
    console.error('❌ [Contacts API] Erro geral:', error);
    
    return NextResponse.json({
      success: false,
      domain,
      emails: [],
      contacts: [],
      count: 0,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Verifica se um email deve ser filtrado (inválido ou indesejado)
 */
function shouldFilterOut(email: string): boolean {
  const invalidEmails = [
    'geral@visualdesignmoz.com',
  ];

  const suspiciousPatterns = [
    'joao',
    'teste',
    'exemplo',
    'your-domain',
    'admin@your',
    'placeholder',
  ];

  // 1. Filtrar domínios permitidos
  const emailDomain = email.split('@')[1];
  if (!ALLOWED_DOMAINS.includes(emailDomain)) {
    return true;
  }

  // 2. Filtrar emails conhecidos como inválidos
  if (invalidEmails.some(inv => email === inv.toLowerCase())) {
    return true;
  }

  // 3. Filtrar padrões suspeitos
  if (suspiciousPatterns.some(pattern => email.includes(pattern.toLowerCase()))) {
    return true;
  }

  return false;
}
