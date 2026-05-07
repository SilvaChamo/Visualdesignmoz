create extension if not exists "pgcrypto";

create table if not exists public.site_news (
  id uuid primary key default gen_random_uuid(),
  site_slug text not null default 'aamihe',
  slug text not null,
  title_pt text not null,
  content_pt text not null,
  title_en text,
  content_en text,
  title_fr text,
  content_fr text,
  excerpt_pt text,
  excerpt_en text,
  excerpt_fr text,
  image_url text,
  gallery_urls text[] not null default '{}',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_slug, slug)
);

create index if not exists site_news_site_published_idx
  on public.site_news (site_slug, published, published_at desc);

alter table public.site_news enable row level security;

drop policy if exists "Published site news are public" on public.site_news;
create policy "Published site news are public"
  on public.site_news
  for select
  using (published = true);

drop policy if exists "Service role manages site news" on public.site_news;
create policy "Service role manages site news"
  on public.site_news
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Optional public storage bucket for gallery/news images.
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;
