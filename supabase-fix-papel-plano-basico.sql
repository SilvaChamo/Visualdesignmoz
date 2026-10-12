-- Repõe no painel Cliente as contas que ficaram em "profissional" sem plano Pro/Business/Enterprise
-- (regra de 12/10/2026: Básico, planos de e-mail e domínios → Cliente).
-- Origem do erro: 14 ago (todo o comprador → profissional), 8 out ("com site = profissional", e um profissional
-- nunca descia) e 10 out (/vhost: qualquer conta com site = Profissional).
--
-- 1) Ver primeiro quem muda (não altera nada):
select p.email, p.role, u.username, u.package_name
from profiles p
left join panel_users u on u.auth_user_id = p.user_id
where p.role = 'profissional'
  and lower(coalesce(u.package_name, '')) not in ('vd-host-pro', 'vd-host-business', 'vd-host-enterprise')
order by u.package_name nulls first, p.email;

-- 2) Corrigir (perfil e user_metadata, que também era lido como papel):
begin;

with alvo as (
  select p.user_id
  from profiles p
  left join panel_users u on u.auth_user_id = p.user_id
  where p.role = 'profissional'
    -- só planos Cliente (Básico, e-mail) ou contas sem alojamento; pacotes antigos/de recurso ("VisualDESIGN",
    -- "default"…) ficam de fora — podem ser compras Pro, decidir à mão depois de ver a lista do passo 1
    and (u.package_name is null
         or lower(u.package_name) in ('vd-host-basico', 'vd-email-basico', 'vd-email-premium', 'vd-email-enterprise'))
)
update profiles set role = 'client', updated_at = now()
where user_id in (select user_id from alvo);

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"client"}'::jsonb
where raw_user_meta_data ->> 'role' = 'profissional'
  and id in (select user_id from profiles where role = 'client');

commit;
