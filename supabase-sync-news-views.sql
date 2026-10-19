-- ============================================================
-- Sincronização de Notícias: Jornal Entrecampos <-> BD Agro
-- Tabela de Origem: public.news
-- ============================================================

-- 1. View para o Jornal Entrecampos
-- Regra: Mostra 100% das notícias publicadas no Entrecampos E 100% das notícias da BD Agro
CREATE OR REPLACE VIEW view_entrecampos_news AS
SELECT * 
FROM news 
WHERE (site_id = 'entrecampos' OR site_id = 'bdagro')
  AND (status = 'published' OR status IS NULL)
ORDER BY date DESC;

-- 2. View para a Base de Dados Agro
-- Regra: Mostra 100% das notícias da BD Agro E notícias do Entrecampos EXCETO a categoria 'comunidade'
CREATE OR REPLACE VIEW view_bdagro_news AS
SELECT * 
FROM news 
WHERE (
  site_id = 'bdagro' 
  OR (site_id = 'entrecampos' AND (category IS NULL OR category != 'comunidade'))
)
AND (status = 'published' OR status IS NULL)
ORDER BY date DESC;

-- Permissões de Acesso via REST API do Supabase
GRANT SELECT ON view_entrecampos_news TO anon, authenticated, service_role;
GRANT SELECT ON view_bdagro_news TO anon, authenticated, service_role;
