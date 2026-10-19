-- Cartões de site escondidos do painel de uma conta (revendedor/profissional)
-- — "Eliminar" do admin dentro da conta (impersonação) para limpar o painel
-- SEM apagar nada no servidor: o site, os ficheiros, o email e o DNS ficam
-- intactos, só deixam de aparecer no painel dessa conta. Ver
-- src/lib/panel-hidden-domains.ts e /api/admin/impersonate-reseller/sites.
-- (No painel Cliente os cartões são registos de produto e apagam-se
-- directamente — não usam esta tabela.)

CREATE TABLE IF NOT EXISTS panel_hidden_domains (
  owner TEXT NOT NULL,          -- conta de alojamento (Hestia/DA) cujo painel deixa de mostrar o site
  domain TEXT NOT NULL,
  hidden_by UUID,               -- admin que escondeu
  hidden_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, domain)
);

ALTER TABLE panel_hidden_domains ENABLE ROW LEVEL SECURITY;

-- Só o servidor (service role) e os admins lêem/escrevem.
CREATE POLICY panel_hidden_domains_admin ON panel_hidden_domains
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
