import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteFont } from "@/lib/site-font";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OAuthCodeRedirect } from "@/components/auth/OAuthCodeRedirect";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CartProvider } from "@/contexts/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "VisualDesign",
    template: "%s | VisualDesign",
  },
  description: "Painel de gestão de clientes e campanhas de email marketing",
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
  openGraph: {
    title: "VisualDesign",
    description: "Painel de gestão de clientes e campanhas de email marketing",
    type: "website",
    locale: "pt MZ",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )vd-theme=(light|dark)(?:;|$)/);var t=m?m[1]:localStorage.getItem('vd-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        <meta property="og:title" content="VisualDesign" />
        <meta property="og:description" content="Painel de gestão de clientes e campanhas de email marketing" />
        <meta property="og:image" content="https://visualdesignmoz.com/icons/icon-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://visualdesignmoz.com" />
        <meta property="og:site_name" content="VisualDesign" />
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
      <body className={`${siteFont.className} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <OAuthCodeRedirect />
            <CartProvider>
              <I18nProvider>
                <ConditionalNavbar />
                <main className="site-content min-h-screen bg-background text-foreground">
                  {children}
                </main>
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

