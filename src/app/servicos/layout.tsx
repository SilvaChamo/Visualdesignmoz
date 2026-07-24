import type { Metadata } from "next";

const DESCRIPTION =
    "Conheça os serviços da VisualDesign: alojamento web, domínios, email profissional, SSL, design e marketing digital em Moçambique.";

export const metadata: Metadata = {
    title: "Serviços",
    description: DESCRIPTION,
    alternates: { canonical: "/servicos" },
    openGraph: {
        title: "Serviços | VisualDesign",
        description: DESCRIPTION,
        url: "https://visualdesignmoz.com/servicos",
        siteName: "VisualDesign",
        locale: "pt_MZ",
        type: "website",
    },
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function ServicesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
