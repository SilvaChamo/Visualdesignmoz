-- Template padrão para novas tabelas no schema public (Supabase Data API 2026+)
-- Uso: adaptar <table_name> e políticas ao contexto real de segurança.

-- 1) Criar tabela (exemplo)
-- create table if not exists public.<table_name> (
--   id uuid primary key default gen_random_uuid(),
--   created_at timestamptz not null default now()
-- );

-- 2) Ativar RLS
alter table if exists public.<table_name> enable row level security;

-- 3) Grants explícitos (ajustar conforme necessidade)
grant usage on schema public to anon, authenticated;
grant select on table public.<table_name> to authenticated;
-- grant insert, update, delete on table public.<table_name> to authenticated;
-- grant select on table public.<table_name> to anon; -- apenas se público

-- 4) Policies mínimas (exemplo por owner)
-- create policy "<table_name>_select_own"
-- on public.<table_name>
-- for select
-- to authenticated
-- using (auth.uid() = user_id);

-- create policy "<table_name>_insert_own"
-- on public.<table_name>
-- for insert
-- to authenticated
-- with check (auth.uid() = user_id);

-- 5) Opcional: role service_role para operações backend
-- create policy "<table_name>_service_role_all"
-- on public.<table_name>
-- for all
-- using (auth.jwt()->>'role' = 'service_role')
-- with check (auth.jwt()->>'role' = 'service_role');
