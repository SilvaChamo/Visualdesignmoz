import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteFont } from "@/lib/site-font";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OAuthCodeRedirect } from "@/components/auth/OAuthCodeRedirect";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { ConditionalMain } from "@/components/layout/ConditionalMain";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CartProvider } from "@/contexts/CartContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";

const SITE_DESCRIPTION =
  "Agência de design gráfico e serviços digitais em Maputo, Moçambique — sites, alojamento web, domínios, email profissional e marketing digital.";

export const metadata: Metadata = {
  metadataBase: new URL("https://visualdesignmoz.com"),
  title: {
    default: "VisualDesign",
    template: "%s | VisualDesign",
  },
  description: SITE_DESCRIPTION,
  keywords: ["VisualDesign", "VisualDesignMoz", "Visual Designer", "Visual Design", "Visual", "Design", "Design Gráfico", "Moçambique", "Maputo"],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VisualDesign",
  },
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "vNIsPlR4rwBNVt8TduD24Op9KaeHWmZiWT9eO_rnrOg",
  },
  openGraph: {
    title: "VisualDesign",
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "pt_MZ",
    url: "https://visualdesignmoz.com",
    siteName: "VisualDesign",
    images: [
      {
        url: "https://visualdesignmoz.com/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "VisualDesign Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VisualDesign",
    description: SITE_DESCRIPTION,
    images: ["https://visualdesignmoz.com/icons/icon-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { MaintenanceBanner } from "@/components/layout/MaintenanceBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning className={siteFont.variable}>
      <head>
        <OrganizationJsonLd />
        {/* Painel VisualHost: pede os dados do servidor logo que a página chega, em paralelo com o JavaScript
            (o painel usa esta resposta na primeira leitura — ver VisualHostApp, "carregar") */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname.indexOf('/vhost')===0){window.__vhDados=fetch('/api/vhost/dados',{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,status:r.status,j:j}})})}}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )vd-theme=(light|dark)(?:;|$)/);var t=m?m[1]:localStorage.getItem('vd-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        {/* Cores do site escolhidas pelo administrador no painel (VisualHost → Personalizar): aplicadas já com o cookie
            vd-cores e confirmadas no servidor de 10 em 10 minutos (/api/vhost/tema) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var K=/^--(color-red-(50|[1-9]00|950)|panel-accent)$/,H=/^#[0-9a-f]{6}$/i,s=document.documentElement.style;function a(v){for(var k in v){if(K.test(k)&&H.test(v[k]))s.setProperty(k,v[k])}}var m=document.cookie.match(/(?:^|; )vd-cores=([^;]+)/);if(m){a(JSON.parse(decodeURIComponent(m[1])))}var t=+localStorage.getItem('vd-cores-t')||0;if(Date.now()-t>600000){window.addEventListener('load',function(){fetch('/api/vhost/tema').then(function(r){return r.json()}).then(function(j){localStorage.setItem('vd-cores-t',String(Date.now()));var v=j&&j.tema&&j.tema.vars,sec=location.protocol==='https:'?'; Secure':'';if(v&&Object.keys(v).length){a(v);document.cookie='vd-cores='+encodeURIComponent(JSON.stringify(v))+'; path=/; max-age=31536000; SameSite=Lax'+sec}else if(m){var o=JSON.parse(decodeURIComponent(m[1]));for(var k in o)s.removeProperty(k);document.cookie='vd-cores=; path=/; max-age=0; SameSite=Lax'}}).catch(function(){})})}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <OAuthCodeRedirect />
            <CartProvider>
              <CurrencyProvider>
                <I18nProvider>
                  <MaintenanceBanner />
                  <ConditionalNavbar />
                  <ConditionalMain>{children}</ConditionalMain>
                  <ConditionalFooter />
                  <CartDrawer />
                  <PWAInstallPrompt />
                </I18nProvider>
              </CurrencyProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

