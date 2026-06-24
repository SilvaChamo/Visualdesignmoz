import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { checkAvailability, spaceshipAPI } from '@/lib/spaceship-adapter';
import { createClient } from '@/utils/supabase/server';

function mapProfileToSpaceshipContact(profile: any, userEmail: string) {
  // Dividir o nome completo em nome e apelido
  const nomeCompleto = (profile?.nome || 'Utilizador').trim();
  const parts = nomeCompleto.split(/\s+/);
  const firstName = parts[0] || 'Utilizador';
  const lastName = parts.slice(1).join(' ') || 'Registo';

  // Normalizar formato de telefone: +CCC.NNNNNNNNN (exemplo: +258.840000000)
  let rawPhone = (profile?.telefone || '').replace(/[\s\-\(\)]/g, '');
  if (!rawPhone) {
    rawPhone = '840000000'; // Fallback padrão
  }

  let phone = '';
  if (rawPhone.startsWith('+')) {
    const withoutPlus = rawPhone.substring(1);
    if (withoutPlus.includes('.')) {
      phone = rawPhone;
    } else {
      if (withoutPlus.startsWith('258') && withoutPlus.length > 3) {
        phone = `+258.${withoutPlus.substring(3)}`;
      } else if (withoutPlus.startsWith('351') && withoutPlus.length > 3) {
        phone = `+351.${withoutPlus.substring(3)}`;
      } else {
        phone = `+${withoutPlus.substring(0, 3)}.${withoutPlus.substring(3)}`;
      }
    }
  } else {
    if (rawPhone.startsWith('258') && rawPhone.length > 3) {
      phone = `+258.${rawPhone.substring(3)}`;
    } else if (rawPhone.startsWith('351') && rawPhone.length > 3) {
      phone = `+351.${rawPhone.substring(3)}`;
    } else {
      phone = `+258.${rawPhone}`;
    }
  }

  // Mapeamento de país para ISO de 2 letras
  const countryMap: Record<string, string> = {
    'moçambique': 'MZ',
    'mozambique': 'MZ',
    'portugal': 'PT',
    'brasil': 'BR',
    'brazil': 'BR',
    'angola': 'AO',
    'cabo verde': 'CV',
    'guiné-bissau': 'GW',
    'são tomé e príncipe': 'ST',
    'timor-leste': 'TL',
  };
  const cleanCountry = (profile?.pais || 'Moçambique').toLowerCase().trim();
  const country = countryMap[cleanCountry] || 'MZ';

  return {
    firstName,
    lastName,
    email: userEmail || 'admin@your-domain.com',
    address1: profile?.morada || 'Av. Marginal 123',
    city: profile?.cidade || 'Maputo',
    country,
    phone,
    postalCode: '1100', // Código postal padrão para Maputo
    organization: profile?.empresa || undefined,
  };
}

export async function POST(req: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { domain, agreeToTerms } = await req.json();

    if (!domain) {
      return NextResponse.json({ status: 'ERROR', message: 'Domínio não fornecido' }, { status: 400 });
    }

    if (!agreeToTerms) {
      return NextResponse.json(
        { success: false, error: 'Tem de aceitar os termos do registrador para registar.' },
        { status: 400 }
      );
    }

    const clean = String(domain).toLowerCase().trim();

    // 1. Verificar disponibilidade real via Spaceship
    const check = await checkAvailability(clean);
    if (!check.available) {
      return NextResponse.json(
        { success: false, error: check.error || 'Este domínio já não se encontra disponível para registo.' },
        { status: 400 }
      );
    }

    // 2. Obter dados do perfil do utilizador na BD
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', auth.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[API] Erro ao carregar perfil do utilizador:', profileError);
    }

    // 3. Mapear perfil para dados de contacto WHOIS da Spaceship
    const contactData = mapProfileToSpaceshipContact(profile, auth.user.email || '');
    console.log('[API] Criando contacto WHOIS na Spaceship com dados:', contactData);

    // 4. Criar contacto na Spaceship
    const contactResult = await spaceshipAPI.createContact(contactData);
    if (!contactResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Erro ao registar contacto WHOIS: ${contactResult.error}`
        },
        { status: 400 }
      );
    }

    console.log(`[API] Contacto WHOIS criado com sucesso. ID: ${contactResult.contactId}`);

    // 5. Registar domínio utilizando o ID de contacto criado
    console.log(`[API] Iniciando compra do domínio ${clean} na Spaceship...`);
    const registerResult = await spaceshipAPI.registerDomain(clean, contactResult.contactId, 1, true);

    if (registerResult.success) {
      return NextResponse.json({
        success: true,
        message: `Domínio ${clean} registado com sucesso!`,
        operationId: registerResult.operationId,
        raw: registerResult.raw,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: registerResult.error || 'Erro ao registar o domínio. Verifique o saldo ou os limites do serviço de registo.',
        raw: registerResult.raw,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('API Domain Register Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
