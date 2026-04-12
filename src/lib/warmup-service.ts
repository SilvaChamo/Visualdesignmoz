/**
 * Sistema de Limite de Email Marketing - SIMPLIFICADO
 * Sem tabela domain_reputation - apenas limites fixos por conta
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Limite fixo: 200 emails/dia por conta
export const DAILY_EMAIL_LIMIT = 200;

export interface DomainReputation {
  domain: string;
  dailyLimit: number;
  emailsSentToday: number;
  emailsSentTotal: number;
  lastSendDate: string;
  bounceRate: number;
  complaintRate: number;
  currentPhase?: string;
  firstSendDate?: string;
  daysSinceFirstSend?: number;
  reputationScore?: number;
  scoreChange?: number;
  remainingToday?: number;
  phaseDescription?: string;
  sentToday?: number;
  sentTotal?: number;
  previousScore?: number;
  lastScoreUpdate?: string;
  weeklyHistory?: any[];
}

/**
 * Retorna reputação simplificada - DADOS ZERADOS (sem persistência)
 * Apenas mostra limite fixo de 200 emails/dia
 */
export async function getDomainReputation(domain: string): Promise<DomainReputation> {
  // Dados sempre zerados - não persiste nada
  return {
    domain,
    dailyLimit: DAILY_EMAIL_LIMIT,  // 200
    emailsSentToday: 0,             // Sempre 0 (não persiste)
    emailsSentTotal: 0,             // Sempre 0 (não persiste)
    lastSendDate: new Date().toISOString(),
    bounceRate: 0,
    complaintRate: 0,
    currentPhase: 'ACTIVE',
    firstSendDate: new Date().toISOString(),
    daysSinceFirstSend: 0,
    reputationScore: 100,
    scoreChange: 0,
    remainingToday: DAILY_EMAIL_LIMIT,  // 200
    phaseDescription: 'Limite: 200 emails/dia',
    sentToday: 0,                   // Para compatibilidade com frontend
    sentTotal: 0,                   // Para compatibilidade com frontend
    previousScore: 100,
    lastScoreUpdate: new Date().toISOString(),
    weeklyHistory: []
  };
}

/**
 * Verifica se pode enviar email
 * SEMPRE PERMITE - sem restrições
 */
export async function canSendEmail(domain: string, quantity: number = 1): Promise<{
  allowed: boolean;
  remainingToday: number;
  dailyLimit: number;
  reputation: DomainReputation;
  message?: string;
}> {
  const reputation = await getDomainReputation(domain);
  
  return {
    allowed: true,
    remainingToday: DAILY_EMAIL_LIMIT,
    dailyLimit: DAILY_EMAIL_LIMIT,
    reputation,
    message: 'Limite: 1000 emails/dia'
  };
}

/**
 * Registra envio de email - apenas logging, sem persistência
 */
export async function recordEmailSent(domain: string, quantity: number = 1): Promise<void> {
  // Apenas logging - não persiste em tabela
  console.log(`[Email Sent] Domain: ${domain}, Quantity: ${quantity}`);
}

/**
 * Estatísticas simplificadas
 */
export async function getEmailStats(domain: string): Promise<{
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  totalSent: number;
  averageBounceRate: number;
  averageComplaintRate: number;
  reputationTrend: 'up' | 'down' | 'stable';
}> {
  // Retorna valores zerados - sem persistência
  return {
    sentToday: 0,
    sentThisWeek: 0,
    sentThisMonth: 0,
    totalSent: 0,
    averageBounceRate: 0,
    averageComplaintRate: 0,
    reputationTrend: 'stable'
  };
}

// Funções legadas - mantidas para compatibilidade mas não fazem nada
export async function advanceToNextPhase(domain: string): Promise<any> {
  return {
    success: true,
    newPhase: 'TRUSTED',
    newLimit: DAILY_EMAIL_LIMIT,
    message: 'Sistema simplificado - sem fases de warm-up'
  };
}

export async function recordSuccessfulSends(domain: string, count: number): Promise<void> {
  // Não faz nada
}

export async function recordBounce(domain: string): Promise<void> {
  // Não faz nada
}

export async function recordComplaint(domain: string): Promise<void> {
  // Não faz nada
}

export function getReputationRecommendations(reputation: DomainReputation): string[] {
  const recommendations: string[] = [];

  if (reputation.bounceRate > 5) {
    recommendations.push('⚠️ Taxa de bounce alta (' + reputation.bounceRate.toFixed(1) + '%). Limpe sua lista de contactos.');
  }

  if (reputation.complaintRate > 0.1) {
    recommendations.push('🚨 Taxa de reclamações elevada! Revise a qualidade do seu conteúdo.');
  }

  if ((reputation.reputationScore || 0) < 70) {
    recommendations.push('💡 Reputação baixa. Considere pausar campanhas por 24-48h.');
  }

  if (reputation.currentPhase === 'ESTABLISHED' && (reputation.reputationScore || 0) > 80) {
    recommendations.push('🌟 Excelente reputação! Seu limite máximo é de 2000 emails/dia.');
  }

  return recommendations;
}

/**
 * Retorna informação simples do limite para exibição
 */
export function getLimitInfo(): {
  label: string;
  description: string;
  color: string;
} {
  return {
    label: 'Gratuito',
    description: '200 emails/dia',
    color: 'bg-blue-500'
  };
}
