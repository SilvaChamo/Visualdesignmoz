-- Limpar registos incorretos e duplicados
DELETE FROM records WHERE name = 'visualdesignmoz.com.visualdesignmoz.com';
DELETE FROM records WHERE name = 'resend._domainkey.visualdesignmoz.com' AND type = 'TXT';
DELETE FROM records WHERE name = '_dmarc.visualdesignmoz.com' AND type = 'TXT';
DELETE FROM records WHERE name = 'resend.visualdesignmoz.com' AND type = 'CNAME';

-- Obter o ID do domínio
SET @domainId = (SELECT id FROM domains WHERE name = 'visualdesignmoz.com');

-- Inserir registos corretos
-- SPF no root
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'visualdesignmoz.com', 'TXT', 'v=spf1 include:amazonses.com ~all', 3600, 0);

-- DKIM
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'resend._domainkey.visualdesignmoz.com', 'TXT', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNkU+jEhoTLv/3r4I0xewI3U9Ek5YqUx1SZZAqI9b7A2Wdn14DI2t4uofAGNad+xC79kby/2WC53oJySUL7huM0FM0ach8phIDWVjwNCs5nMfTi97dinv7d/cn7QKXKQmJCwaWbOydkhejAXiKZojaSfPE63SeVQbbqqaY268I1wIDAQAB', 3600, 0);

-- DMARC
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, '_dmarc.visualdesignmoz.com', 'TXT', 'v=DMARC1; p=none;', 3600, 0);

-- Feedback / Mail From CNAME
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'resend.visualdesignmoz.com', 'CNAME', 'feedback-smtp.sa-east-1.amazonses.com', 3600, 0);
