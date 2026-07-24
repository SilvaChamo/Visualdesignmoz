import type { MetadataRoute } from "next";

const SITE_URL = "https://visualdesignmoz.com";

const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/servicos", priority: 0.9, changeFrequency: "monthly" },
  { path: "/servicos/dominios", priority: 0.6, changeFrequency: "monthly" },
  { path: "/precos", priority: 0.9, changeFrequency: "monthly" },
  { path: "/precos/dominios", priority: 0.6, changeFrequency: "monthly" },
  { path: "/precos/email", priority: 0.6, changeFrequency: "monthly" },
  { path: "/precos/hospedagem", priority: 0.6, changeFrequency: "monthly" },
  { path: "/precos/ssl", priority: 0.6, changeFrequency: "monthly" },
  { path: "/precos/suporte", priority: 0.6, changeFrequency: "monthly" },
  { path: "/portfolio", priority: 0.7, changeFrequency: "monthly" },
  { path: "/sobre-nos", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contacto", priority: 0.8, changeFrequency: "monthly" },
  { path: "/cursos", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/diferencial", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacidade", priority: 0.2, changeFrequency: "yearly" },
  { path: "/termos", priority: 0.2, changeFrequency: "yearly" },
  { path: "/web", priority: 0.8, changeFrequency: "monthly" },
  { path: "/eventos", priority: 0.8, changeFrequency: "monthly" },
  { path: "/eventos/catering", priority: 0.6, changeFrequency: "monthly" },
  { path: "/eventos/feiras", priority: 0.6, changeFrequency: "monthly" },
  { path: "/brindes", priority: 0.8, changeFrequency: "monthly" },
  { path: "/brindes/kits", priority: 0.6, changeFrequency: "monthly" },
  { path: "/brindes/texteis", priority: 0.6, changeFrequency: "monthly" },
  { path: "/producoes", priority: 0.8, changeFrequency: "monthly" },
  { path: "/producoes/eventos", priority: 0.6, changeFrequency: "monthly" },
  { path: "/producoes/fotografia", priority: 0.6, changeFrequency: "monthly" },
  { path: "/transporte", priority: 0.8, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
