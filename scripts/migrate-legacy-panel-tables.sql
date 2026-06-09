-- Migração única: instalações antigas → nomenclatura panel_*
-- Executar no SQL Editor do Supabase (self-hosted ou cloud)
-- Idempotente: ignora tabelas/colunas já migradas

DO $$
DECLARE
  legacy_map text[][] := ARRAY[
    ARRAY['cyberpanel_sites', 'panel_sites'],
    ARRAY['cyberpanel_users', 'panel_users'],
    ARRAY['cyberpanel_packages', 'panel_packages']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY legacy_map
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = pair[1]
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', pair[1], pair[2]);
      RAISE NOTICE 'Renamed % → %', pair[1], pair[2];
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_contas'
      AND column_name = 'senha_cyberpanel'
  ) THEN
    ALTER TABLE email_contas RENAME COLUMN senha_cyberpanel TO senha_servidor;
    RAISE NOTICE 'Renamed email_contas.senha_cyberpanel → senha_servidor';
  END IF;
END $$;
