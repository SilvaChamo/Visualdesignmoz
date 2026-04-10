/**
 * Sistema de Warm-up de Email Marketing
 * Gestão progressiva de reputação de domínios para maximizar entregabilidade
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Limites de warm-up por fase (emails por dia)
export const WARMUP_LIMITS = {
  NEW: 50,           // Dia 0-1: Domínio novo
  PHASE_1: 100,      // Dia 2-3: Primeiros envios
  PHASE_2: 300,      // Dia 4-7: Semana 1
  PHASE_3: 600,      // Dia 8-14: Semana 2
  PHASE_4: 1000,     // Dia 15-30: Mês 1
  ESTABLISHED: 2000  // Dia 30+: Domínio estabelecido
};

// Dias necessários para cada fase
const PHASE_DAYS = {
  NEW: 0,
  PHASE_1: 2,
  PHASE_2: 4,
  PHASE_3: 8,
  PHASE_4: 15,
  ESTABLISHED: 30
};

export interface DomainReputation {
  domain: string;
  currentPhase: keyof typeof WARMUP_LIMITS;
  dailyLimit: number;
  emailsSentToday: number;
  emailsSentTotal: number;
  firstSendDate: string;
  daysSinceFirstSend: number;
  reputationScore: number; // 0-100
  lastSendDate: string;
  bounceRate: number;
  complaintRate: number;
  // 🆕 Campos de histórico para tracking de mudanças
  previousScore?: number; // Score da semana anterior
  scoreChange?: number; // Diferença em percentagem (+5, -3, etc)
  lastScoreUpdate?: string; // Data da última atualização de score
  weeklyHistory?: { week: number; score: number; date: string }[]; // Histórico semanal
}

/**
 * Inicializa ou obtém a reputação de um domínio
 */
export async function getDomainReputation(domain: string): Promise<DomainReputation> {
  try {
    const { data, error } = await supabaseAdmin
      .from('domain_reputation')
      .select('*')
      .eq('domain', domain)
      .single();

    if (error || !data) {
      // Criar novo registro para domínio
      return await initializeDomainReputation(domain);
    }

    // Calcular dias desde o primeiro envio
    const firstSend = new Date(data.first_send_date);
    const now = new Date();
    const daysSinceFirstSend = Math.floor((now.getTime() - firstSend.getTime()) / (1000 * 60 * 60 * 24));

    // Determinar fase atual baseada nos dias
    const currentPhase = calculatePhase(daysSinceFirstSend);
    const dailyLimit = WARMUP_LIMITS[currentPhase];

    // Verificar se é um novo dia (reset do contador)
    const lastSend = new Date(data.last_send_date);
    const isNewDay = lastSend.toDateString() !== now.toDateString();

    // 🆕 Calcular mudança de score (comparando com semana anterior)
    const currentScore = calculateReputationScore(data);
    const previousScore = data.previous_score || currentScore;
    const scoreChange = currentScore - previousScore;
    
    // 🆕 Construir histórico semanal se existir
    const weeklyHistory = data.weekly_history || [];

    return {
      domain: data.domain,
      currentPhase,
      dailyLimit,
      emailsSentToday: isNewDay ? 0 : (data.emails_sent_today || 0),
      emailsSentTotal: data.emails_sent_total || 0,
      firstSendDate: data.first_send_date,
      daysSinceFirstSend,
      reputationScore: currentScore,
      lastSendDate: data.last_send_date,
      bounceRate: data.bounce_rate || 0,
      complaintRate: data.complaint_rate || 0,
      // 🆕 Campos de histórico
      previousScore,
      scoreChange,
      lastScoreUpdate: data.last_score_update,
      weeklyHistory
    };
  } catch (error) {
    console.error('Erro ao obter reputação do domínio:', error);
    // Retorna reputação padrão em caso de erro
    return {
      domain,
      currentPhase: 'NEW',
      dailyLimit: WARMUP_LIMITS.NEW,
      emailsSentToday: 0,
      emailsSentTotal: 0,
      firstSendDate: new Date().toISOString(),
      daysSinceFirstSend: 0,
      reputationScore: 50,
      lastSendDate: new Date().toISOString(),
      bounceRate: 0,
      complaintRate: 0
    };
  }
}

/**
 * Inicializa reputação para novo domínio
 */
async function initializeDomainReputation(domain: string): Promise<DomainReputation> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('domain_reputation')
    .insert({
      domain,
      current_phase: 'NEW',
      emails_sent_today: 0,
      emails_sent_total: 0,
      first_send_date: now,
      last_send_date: now,
      bounce_rate: 0,
      complaint_rate: 0,
      reputation_score: 50
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inicializar reputação:', error);
    throw error;
  }

  return {
    domain: data.domain,
    currentPhase: 'NEW',
    dailyLimit: WARMUP_LIMITS.NEW,
    emailsSentToday: 0,
    emailsSentTotal: 0,
    firstSendDate: data.first_send_date,
    daysSinceFirstSend: 0,
    reputationScore: 50,
    lastSendDate: data.last_send_date,
    bounceRate: 0,
    complaintRate: 0
  };
}

/**
 * Calcula a fase atual baseada nos dias desde o primeiro envio
 */
function calculatePhase(daysSinceFirstSend: number): keyof typeof WARMUP_LIMITS {
  if (daysSinceFirstSend >= PHASE_DAYS.ESTABLISHED) return 'ESTABLISHED';
  if (daysSinceFirstSend >= PHASE_DAYS.PHASE_4) return 'PHASE_4';
  if (daysSinceFirstSend >= PHASE_DAYS.PHASE_3) return 'PHASE_3';
  if (daysSinceFirstSend >= PHASE_DAYS.PHASE_2) return 'PHASE_2';
  if (daysSinceFirstSend >= PHASE_DAYS.PHASE_1) return 'PHASE_1';
  return 'NEW';
}

/**
 * Calcula score de reputação (0-100)
 */
function calculateReputationScore(data: any): number {
  let score = 50; // Base

  // Penalidade por bounce rate
  const bouncePenalty = (data.bounce_rate || 0) * 2;
  score -= bouncePenalty;

  // Penalidade por complaint rate
  const complaintPenalty = (data.complaint_rate || 0) * 5;
  score -= complaintPenalty;

  // Bônus por tempo de envio consistente
  const daysActive = Math.floor(
    (new Date().getTime() - new Date(data.first_send_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeBonus = Math.min(daysActive * 0.5, 25);
  score += timeBonus;

  // Bônus por volume consistente
  const totalSent = data.emails_sent_total || 0;
  const volumeBonus = Math.min(totalSent * 0.001, 20);
  score += volumeBonus;

  return Math.max(0, Math.min(100, score));
}

/**
 * Verifica se pode enviar email (SISTEMA FLEXÍVEL)
 * 
 * 🎯 NOVO COMPORTAMENTO:
 * - Não penaliza por inatividade
 * - Quando excede limite, oferece opção de avançar fase
 * - Só bloqueia realmente se houver bounces/complaints graves
 */
export async function canSendEmail(domain: string, quantity: number = 1, options?: { 
  allowPhaseAdvance?: boolean // Se true, permite exceder com aviso
}): Promise<{
  allowed: boolean;
  remainingToday: number;
  dailyLimit: number;
  reputation: DomainReputation;
  message?: string;
  canAdvancePhase?: boolean; // 🆕 Indica se pode avançar de fase
  excessCount?: number; // 🆕 Quantos emails excederam
  nextPhaseInfo?: { // 🆕 Info sobre próxima fase
    phase: keyof typeof WARMUP_LIMITS;
    limit: number;
    description: string;
  };
}> {
  const reputation = await getDomainReputation(domain);
  const remainingToday = reputation.dailyLimit - reputation.emailsSentToday;

  // 🆕 VERIFICAÇÃO: Se há problemas graves de reputação, bloqueia mesmo assim
  if (reputation.reputationScore < 30 || reputation.bounceRate > 10 || reputation.complaintRate > 5) {
    return {
      allowed: false,
      remainingToday,
      dailyLimit: reputation.dailyLimit,
      reputation,
      message: `Reputação muito baixa (${reputation.reputationScore}/100). Corrija problemas de bounce/complaints antes de continuar.`
    };
  }

  // 🆕 EXCEDEU LIMITE: Oferece opção de avançar fase em vez de bloquear
  if (quantity > remainingToday && remainingToday > 0) {
    const excessCount = quantity - remainingToday;
    const nextPhase = getNextPhase(reputation.currentPhase);
    
    return {
      allowed: options?.allowPhaseAdvance || false, // Só permite se explicitamente autorizado
      remainingToday,
      dailyLimit: reputation.dailyLimit,
      reputation,
      message: `Você excedeu o limite desta fase em ${excessCount} emails.`,
      canAdvancePhase: true,
      excessCount,
      nextPhaseInfo: {
        phase: nextPhase.phase,
        limit: nextPhase.limit,
        description: nextPhase.description
      }
    };
  }

  // Limite diário atingido completamente
  if (reputation.emailsSentToday >= reputation.dailyLimit) {
    const nextPhase = getNextPhase(reputation.currentPhase);
    
    return {
      allowed: false,
      remainingToday: 0,
      dailyLimit: reputation.dailyLimit,
      reputation,
      message: `Limite diário desta fase atingido (${reputation.dailyLimit} emails).`,
      canAdvancePhase: true,
      excessCount: quantity,
      nextPhaseInfo: {
        phase: nextPhase.phase,
        limit: nextPhase.limit,
        description: nextPhase.description
      }
    };
  }

  return {
    allowed: true,
    remainingToday,
    dailyLimit: reputation.dailyLimit,
    reputation
  };
}

/**
 * 🆕 Obtém informação sobre a próxima fase disponível
 */
function getNextPhase(currentPhase: keyof typeof WARMUP_LIMITS): {
  phase: keyof typeof WARMUP_LIMITS;
  limit: number;
  description: string;
} {
  const phaseFlow: (keyof typeof WARMUP_LIMITS)[] = ['NEW', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'ESTABLISHED'];
  const currentIndex = phaseFlow.indexOf(currentPhase);
  const nextPhaseKey = phaseFlow[Math.min(currentIndex + 1, phaseFlow.length - 1)];
  
  const descriptions: Record<keyof typeof WARMUP_LIMITS, string> = {
    NEW: 'Domínio novo - 50/dia',
    PHASE_1: 'Fase 1 - 100/dia',
    PHASE_2: 'Fase 2 - 300/dia',
    PHASE_3: 'Fase 3 - 600/dia',
    PHASE_4: 'Fase 4 - 1000/dia',
    ESTABLISHED: 'Estabelecido - 2000/dia'
  };
  
  return {
    phase: nextPhaseKey,
    limit: WARMUP_LIMITS[nextPhaseKey],
    description: descriptions[nextPhaseKey]
  };
}

/**
 * 🆕 Avança manualmente para a próxima fase
 * Chamado quando o usuário confirma que quer acelerar o warm-up
 */
export async function advanceToNextPhase(domain: string): Promise<{
  success: boolean;
  newPhase: keyof typeof WARMUP_LIMITS;
  newLimit: number;
  message: string;
}> {
  try {
    const reputation = await getDomainReputation(domain);
    const nextPhase = getNextPhase(reputation.currentPhase);
    
    // Se já está na fase máxima
    if (nextPhase.phase === reputation.currentPhase) {
      return {
        success: false,
        newPhase: reputation.currentPhase,
        newLimit: reputation.dailyLimit,
        message: 'Domínio já está na fase máxima.'
      };
    }

    // Atualizar no banco de dados - avança fase artificialmente
    const now = new Date();
    // Ajusta first_send_date para simular os dias necessários para a próxima fase
    const daysNeeded = getDaysNeededForPhase(nextPhase.phase);
    const simulatedFirstSend = new Date(now.getTime() - (daysNeeded * 24 * 60 * 60 * 1000));
    
    const { error } = await supabaseAdmin
      .from('domain_reputation')
      .update({
        first_send_date: simulatedFirstSend.toISOString(),
        manually_advanced: true,
        advanced_at: now.toISOString(),
        previous_phase: reputation.currentPhase
      })
      .eq('domain', domain);
    
    if (error) {
      console.error('Erro ao avançar fase:', error);
      return {
        success: false,
        newPhase: reputation.currentPhase,
        newLimit: reputation.dailyLimit,
        message: 'Erro ao atualizar fase. Tente novamente.'
      };
    }
    
    return {
      success: true,
      newPhase: nextPhase.phase,
      newLimit: nextPhase.limit,
      message: `Fase avançada com sucesso! Novo limite: ${nextPhase.limit} emails/dia.`
    };
    
  } catch (error) {
    console.error('Erro em advanceToNextPhase:', error);
    return {
      success: false,
      newPhase: 'NEW',
      newLimit: 50,
      message: 'Erro interno ao processar avanço de fase.'
    };
  }
}

/**
 * 🆕 Helper: Retorna quantos dias são necessários para uma fase específica
 */
function getDaysNeededForPhase(phase: keyof typeof WARMUP_LIMITS): number {
  const phaseDays: Record<keyof typeof WARMUP_LIMITS, number> = {
    NEW: 0,
    PHASE_1: 2,
    PHASE_2: 4,
    PHASE_3: 8,
    PHASE_4: 15,
    ESTABLISHED: 30
  };
  return phaseDays[phase] || 0;
}

/**
 * Registra envios bem-sucedidos
 */
export async function recordSuccessfulSends(domain: string, count: number): Promise<void> {
  const now = new Date().toISOString();
  const today = new Date().toDateString();

  try {
    // Buscar registro atual
    const { data: current } = await supabaseAdmin
      .from('domain_reputation')
      .select('*')
      .eq('domain', domain)
      .single();

    if (!current) return;

    // Verificar se é novo dia
    const lastSend = new Date(current.last_send_date);
    const isNewDay = lastSend.toDateString() !== today;

    const updates = {
      emails_sent_today: isNewDay ? count : (current.emails_sent_today || 0) + count,
      emails_sent_total: (current.emails_sent_total || 0) + count,
      last_send_date: now,
      current_phase: calculatePhase(
        Math.floor((new Date().getTime() - new Date(current.first_send_date).getTime()) / (1000 * 60 * 60 * 24))
      )
    };

    await supabaseAdmin
      .from('domain_reputation')
      .update(updates)
      .eq('domain', domain);

  } catch (error) {
    console.error('Erro ao registrar envios:', error);
  }
}

/**
 * Registra bounce (email devolvido)
 */
export async function recordBounce(domain: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('domain_reputation')
      .select('bounce_count, emails_sent_total')
      .eq('domain', domain)
      .single();

    if (!data) return;

    const bounceCount = (data.bounce_count || 0) + 1;
    const totalSent = data.emails_sent_total || 1;
    const bounceRate = (bounceCount / totalSent) * 100;

    await supabaseAdmin
      .from('domain_reputation')
      .update({
        bounce_count: bounceCount,
        bounce_rate: bounceRate,
        reputation_score: calculateReputationScore({ ...data, bounce_rate: bounceRate })
      })
      .eq('domain', domain);

  } catch (error) {
    console.error('Erro ao registrar bounce:', error);
  }
}

/**
 * Registra complaint (reclamação/spam)
 */
export async function recordComplaint(domain: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('domain_reputation')
      .select('complaint_count, emails_sent_total')
      .eq('domain', domain)
      .single();

    if (!data) return;

    const complaintCount = (data.complaint_count || 0) + 1;
    const totalSent = data.emails_sent_total || 1;
    const complaintRate = (complaintCount / totalSent) * 100;

    await supabaseAdmin
      .from('domain_reputation')
      .update({
        complaint_count: complaintCount,
        complaint_rate: complaintRate,
        reputation_score: calculateReputationScore({ ...data, complaint_rate: complaintRate })
      })
      .eq('domain', domain);

  } catch (error) {
    console.error('Erro ao registrar complaint:', error);
  }
}

/**
 * Retorna recomendações de melhoria baseadas na reputação
 */
export function getReputationRecommendations(reputation: DomainReputation): string[] {
  const recommendations: string[] = [];

  if (reputation.currentPhase === 'NEW') {
    recommendations.push('🆕 Domínio novo: Comece enviando para os contactos mais engajados primeiro.');
    recommendations.push('📧 Limite atual: 50 emails/dia. Aumentará automaticamente em 2 dias.');
  }

  if (reputation.bounceRate > 5) {
    recommendations.push('⚠️ Taxa de bounce alta (' + reputation.bounceRate.toFixed(1) + '%). Limpe sua lista de contactos.');
  }

  if (reputation.complaintRate > 0.1) {
    recommendations.push('🚨 Taxa de reclamações elevada! Revise a qualidade do seu conteúdo.');
  }

  if (reputation.reputationScore < 70) {
    recommendations.push('💡 Reputação baixa. Considere pausar campanhas por 24-48h.');
  }

  if (reputation.currentPhase === 'ESTABLISHED' && reputation.reputationScore > 80) {
    recommendations.push('🌟 Excelente reputação! Seu limite máximo é de 2000 emails/dia.');
  }

  return recommendations;
}

/**
 * Formata fase para exibição amigável
 */
export function getPhaseDisplay(phase: keyof typeof WARMUP_LIMITS): {
  label: string;
  description: string;
  color: string;
} {
  const phases = {
    NEW: { label: '', description: 'Novo domínio', color: 'bg-blue-500' },
    PHASE_1: { label: 'Inicial', description: 'Primeiros envios (2-3 dias)', color: 'bg-yellow-500' },
    PHASE_2: { label: 'Crescendo', description: 'Construindo reputação (4-7 dias)', color: 'bg-orange-500' },
    PHASE_3: { label: 'Estável', description: 'Reputação estabelecida (8-14 dias)', color: 'bg-green-500' },
    PHASE_4: { label: 'Maduro', description: 'Alto volume permitido (15-30 dias)', color: 'bg-emerald-500' },
    ESTABLISHED: { label: 'Premium', description: 'Máxima reputação (30+ dias)', color: 'bg-purple-500' }
  };

  return phases[phase] || phases.NEW;
}
