import type { MetadataRoute } from "next";

const SITE_URL = "https://visualdesignmoz.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/admin",
        "/dashboard",
        "/cliente",
        "/revendedor",
        "/guest",
        "/painel",
        "/api",
        "/auth",
        "/login",
        "/autenticacao",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
