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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )vd-theme=(light|dark)(?:;|$)/);var t=m?m[1]:localStorage.getItem('vd-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
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

