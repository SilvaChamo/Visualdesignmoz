export type SiteNewsLanguage = 'pt' | 'en' | 'fr';

export type SiteNewsRecord = {
  id: string;
  site_slug: string;
  slug: string;
  title_pt: string;
  content_pt: string;
  title_en: string | null;
  content_en: string | null;
  title_fr: string | null;
  content_fr: string | null;
  excerpt_pt: string | null;
  excerpt_en: string | null;
  excerpt_fr: string | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function slugifyNewsTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `noticia-${Date.now()}`;
}

export function createExcerpt(content: string, maxLength = 180): string {
  const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

export function localizeNewsItem(item: SiteNewsRecord, language: SiteNewsLanguage) {
  const title = item[`title_${language}`] || item.title_pt;
  const content = item[`content_${language}`] || item.content_pt;
  const excerpt = item[`excerpt_${language}`] || item.excerpt_pt || createExcerpt(content || '');

  return {
    id: item.id,
    site_slug: item.site_slug,
    slug: item.slug,
    title,
    content,
    excerpt,
    image_url: item.image_url,
    gallery_urls: item.gallery_urls || [],
    published_at: item.published_at || item.created_at,
    created_at: item.created_at,
    language,
  };
}
