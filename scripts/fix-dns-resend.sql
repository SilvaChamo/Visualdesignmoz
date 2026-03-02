-- Limpar registos incorretos e duplicados
DELETE FROM records WHERE name = 'visualdesigne.com.visualdesigne.com';
DELETE FROM records WHERE name = 'resend._domainkey.visualdesigne.com' AND type = 'TXT';
DELETE FROM records WHERE name = '_dmarc.visualdesigne.com' AND type = 'TXT';
DELETE FROM records WHERE name = 'resend.visualdesigne.com' AND type = 'CNAME';

-- Obter o ID do domínio
SET @domainId = (SELECT id FROM domains WHERE name = 'visualdesigne.com');

-- Inserir registos corretos
-- SPF no root
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'visualdesigne.com', 'TXT', 'v=spf1 include:amazonses.com ~all', 3600, 0);

-- DKIM
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'resend._domainkey.visualdesigne.com', 'TXT', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNkU+jEhoTLv/3r4I0xewI3U9Ek5YqUx1SZZAqI9b7A2Wdn14DI2t4uofAGNad+xC79kby/2WC53oJySUL7huM0FM0ach8phIDWVjwNCs5nMfTi97dinv7d/cn7QKXKQmJCwaWbOydkhejAXiKZojaSfPE63SeVQbbqqaY268I1wIDAQAB', 3600, 0);

-- DMARC
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, '_dmarc.visualdesigne.com', 'TXT', 'v=DMARC1; p=none;', 3600, 0);

-- Feedback / Mail From CNAME
INSERT INTO records (domain_id, name, type, content, ttl, prio) 
VALUES (@domainId, 'resend.visualdesigne.com', 'CNAME', 'feedback-smtp.sa-east-1.amazonses.com', 3600, 0);
