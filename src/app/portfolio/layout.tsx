import type { Metadata } from "next";

const DESCRIPTION =
    "Veja projetos e trabalhos realizados pela VisualDesign — sites, design gráfico e soluções digitais para empresas em Moçambique.";

export const metadata: Metadata = {
    title: "Portfólio",
    description: DESCRIPTION,
    alternates: { canonical: "/portfolio" },
    openGraph: {
        title: "Portfólio | VisualDesign",
        description: DESCRIPTION,
        url: "https://visualdesignmoz.com/portfolio",
        siteName: "VisualDesign",
        locale: "pt_MZ",
        type: "website",
    },
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
