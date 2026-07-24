import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteFont } from "@/lib/site-font";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OAuthCodeRedirect } from "@/components/auth/OAuthCodeRedirect";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CartProvider } from "@/contexts/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";

const SITE_DESCRIPTION =
  "Agência de design e serviços digitais em Maputo, Moçambique — sites, alojamento web, domínios, email profissional e marketing digital.";

export const metadata: Metadata = {
  metadataBase: new URL("https://visualdesignmoz.com"),
  title: {
    default: "VisualDesign",
    template: "%s | VisualDesign",
  },
  description: SITE_DESCRIPTION,
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
  // Depois de registar o domínio na Google Search Console, colar aqui o
  // código de verificação: verification: { google: "..." }.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning className={siteFont.variable}>
      <head>
        <OrganizationJsonLd />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )vd-theme=(light|dark)(?:;|$)/);var t=m?m[1]:localStorage.getItem('vd-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Limpar Service Workers antigos que causam tela branca
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(registration) {
                    registration.unregister();
                  });
                });
                if ('caches' in window) {
                  caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                      caches.delete(cacheName);
                    });
                  });
                }
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <OAuthCodeRedirect />
            <CartProvider>
              <I18nProvider>
                <ConditionalNavbar />
                <main className="site-content min-h-screen bg-background text-foreground">
                  {children}
                </main>
                <ConditionalFooter />
                <CartDrawer />
                <PWAInstallPrompt />
              </I18nProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

