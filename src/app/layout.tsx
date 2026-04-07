import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";

export const metadata: Metadata = {
  title: {
    default: "Portal de Serviços",
    template: "Portal - %s",
  },
  description: "Gestão Integrada de Serviços Digitais",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ">
      <body className="antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <AuthProvider>
          <I18nProvider>
            <ConditionalNavbar />
            {children}
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

