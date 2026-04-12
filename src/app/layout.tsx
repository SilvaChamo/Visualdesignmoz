import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

export const metadata: Metadata = {
  title: {
    default: "VisualDesign - Email Marketing",
    template: "%s | VisualDesign",
  },
  description: "Painel de gestão de clientes e campanhas de email marketing",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VisualDesign",
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
    <html lang="pt-MZ">
      <head>
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
      <body className="antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <AuthProvider>
          <I18nProvider>
            <ConditionalNavbar />
            {children}
            <PWAInstallPrompt />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

