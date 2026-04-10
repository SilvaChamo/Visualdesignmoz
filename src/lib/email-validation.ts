/**
 * Sistema de Validação de Emails
 * Verifica formato e existência do domínio para evitar bounces
 */

// Regex para validação de formato de email
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Lista de domínios descartáveis/temporários conhecidos
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  '10minutemail.com', 'yopmail.com', 'fakeemail.com', 'temp-mail.org',
  'burnermail.io', 'tempmailaddress.com', 'disposable-email.com'
];

// Domínios com TLD inválidos ou suspeitos
const INVALID_TLDS = ['.test', '.localhost', '.invalid', '.example'];

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  isFormatValid: boolean;
  isDomainValid: boolean;
  isDisposable: boolean;
  isRoleBased: boolean;
  errors: string[];
  suggestions?: string[];
}

export interface BulkValidationResult {
  total: number;
  valid: number;
  invalid: number;
  disposable: number;
  roleBased: number;
  withTypos: number;
  results: EmailValidationResult[];
  validEmails: string[];
  invalidEmails: string[];
}

export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) return false;
  if (trimmed.length > 254) return false;
  if (!trimmed.includes('@')) return false;
  if (trimmed.startsWith('@') || trimmed.endsWith('@')) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.includes('.@') || trimmed.includes('@.')) return false;
  
  return EMAIL_REGEX.test(trimmed);
}

export function getEmailDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return parts[1].toLowerCase().trim();
}

export function isRoleBasedEmail(email: string): boolean {
  const rolePrefixes = [
    'noreply', 'no-reply', 'admin', 'administrator', 'support', 'help',
    'info', 'sales', 'marketing', 'contact', 'webmaster', 'postmaster',
    'hostmaster', 'abuse', 'security', 'billing', 'orders', 'team',
    'office', 'service', 'customer', 'care', 'hello', 'hi'
  ];
  
  const localPart = email.split('@')[0]?.toLowerCase() || '';
  return rolePrefixes.some(prefix => localPart.startsWith(prefix));
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.some(d => domain.includes(d));
}

export function hasValidTLD(domain: string): boolean {
  const parts = domain.split('.');
  if (parts.length < 2) return false;
  
  const tld = '.' + parts[parts.length - 1].toLowerCase();
  
  if (INVALID_TLDS.some(invalid => domain.endsWith(invalid))) return false;
  
  const validTLDs = [
    '.com', '.pt', '.br', '.net', '.org', '.edu', '.gov', '.mil',
    '.io', '.co', '.ai', '.app', '.dev', '.cloud', '.tech', '.online',
    '.store', '.site', '.website', '.space', '.digital', '.agency',
    '.company', '.business', '.services', '.solutions', '.systems',
    '.world', '.global', '.international', '.group', '.team', '.work',
    '.email', '.marketing', '.design', '.studio', '.media', '.news',
    '.press', '.rocks', '.social', '.network', '.community', '.club',
    '.life', '.live', '.today', '.zone', '.ink', '.blog', '.shop',
    '.fit', '.health', '.guru', '.expert', '.pro', '.info', '.tel',
    '.name', '.mobi', '.jobs', '.travel', '.aero', '.museum', '.int',
    '.co.uk', '.org.uk', '.me.uk', '.com.br', '.org.br', '.net.br',
    '.co.pt', '.com.pt', '.pt', '.eu', '.me', '.cc', '.tv', '.ws',
    '.fm', '.am', '.at', '.be', '.ca', '.ch', '.cn', '.de', '.dk',
    '.es', '.fr', '.hk', '.ie', '.in', '.it', '.jp', '.nl', '.no',
    '.nu', '.pl', '.ru', '.se', '.sg', '.uk', '.us', '.vn', '.za'
  ];
  
  return validTLDs.some(validTld => domain.endsWith(validTld) || tld === validTld);
}

export async function verifyDomainMX(domain: string): Promise<{ valid: boolean; reason?: string }> {
  if (!domain || domain.length === 0) {
    return { valid: false, reason: 'Domínio vazio' };
  }
  
  if (domain.length > 253) {
    return { valid: false, reason: 'Domínio muito longo' };
  }
  
  if (!domain.includes('.')) {
    return { valid: false, reason: 'Domínio sem TLD' };
  }
  
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, reason: 'Domínio inválido' };
  }
  
  if (!hasValidTLD(domain)) {
    return { valid: false, reason: 'TLD não reconhecido' };
  }
  
  if (isDisposableDomain(domain)) {
    return { valid: false, reason: 'Domínio descartável/temporário' };
  }
  
  const invalidChars = /[^a-zA-Z0-9.-]/;
  if (invalidChars.test(domain)) {
    return { valid: false, reason: 'Caracteres inválidos no domínio' };
  }
  
  return { valid: true };
}

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim().toLowerCase();
  const result: EmailValidationResult = {
    email: trimmed,
    isValid: false,
    isFormatValid: false,
    isDomainValid: false,
    isDisposable: false,
    isRoleBased: false,
    errors: []
  };

  if (!isValidEmailFormat(trimmed)) {
    result.errors.push('Formato de email inválido');
    
    if (trimmed.includes('@@')) {
      result.suggestions = [trimmed.replace(/@@/g, '@')];
    } else if (trimmed.includes('@gmail.con')) {
      result.suggestions = [trimmed.replace('@gmail.con', '@gmail.com')];
    } else if (trimmed.includes('@gmail.co')) {
      result.suggestions = [trimmed.replace('@gmail.co', '@gmail.com')];
    } else if (trimmed.includes('@hotmail.con')) {
      result.suggestions = [trimmed.replace('@hotmail.con', '@hotmail.com')];
    } else if (trimmed.includes('..')) {
      result.suggestions = [trimmed.replace(/\.{2,}/g, '.')];
    }
    
    return result;
  }
  
  result.isFormatValid = true;

  const domain = getEmailDomain(trimmed);
  if (!domain) {
    result.errors.push('Domínio não encontrado');
    return result;
  }

  result.isRoleBased = isRoleBasedEmail(trimmed);
  
  if (isDisposableDomain(domain)) {
    result.isDisposable = true;
    result.errors.push('Domínio de email temporário/descartável');
  }

  const domainCheck = await verifyDomainMX(domain);
  if (!domainCheck.valid) {
    result.errors.push(domainCheck.reason || 'Domínio inválido');
  } else {
    result.isDomainValid = true;
  }

  result.isValid = result.isFormatValid && result.isDomainValid && !result.isDisposable;

  return result;
}

export async function validateEmailList(emails: string[]): Promise<BulkValidationResult> {
  const results: BulkValidationResult = {
    total: emails.length,
    valid: 0,
    invalid: 0,
    disposable: 0,
    roleBased: 0,
    withTypos: 0,
    results: [],
    validEmails: [],
    invalidEmails: []
  };

  const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e))];
  results.total = uniqueEmails.length;

  const validations = await Promise.all(
    uniqueEmails.map(email => validateEmail(email))
  );

  for (const validation of validations) {
    results.results.push(validation);
    
    if (validation.isValid) {
      results.valid++;
      results.validEmails.push(validation.email);
    } else {
      results.invalid++;
      results.invalidEmails.push(validation.email);
    }
    
    if (validation.isDisposable) results.disposable++;
    if (validation.isRoleBased) results.roleBased++;
    if (validation.suggestions && validation.suggestions.length > 0) results.withTypos++;
  }

  return results;
}
