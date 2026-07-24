import type { Metadata } from "next";

const DESCRIPTION =
    "Conheça a VisualDesign, agência de design e serviços digitais em Maputo, Moçambique — a nossa história, missão e equipa.";

export const metadata: Metadata = {
    title: "Sobre Nós",
    description: DESCRIPTION,
    alternates: { canonical: "/sobre-nos" },
    openGraph: {
        title: "Sobre Nós | VisualDesign",
        description: DESCRIPTION,
        url: "https://visualdesignmoz.com/sobre-nos",
        siteName: "VisualDesign",
        locale: "pt_MZ",
        type: "website",
    },
};

export default function SobreNosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
