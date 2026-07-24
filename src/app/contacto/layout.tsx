import type { Metadata } from "next";

const DESCRIPTION =
    "Contacte a VisualDesign em Maputo, Moçambique — Av. Karl Marx, 177. Fale connosco sobre sites, alojamento web e serviços digitais.";

export const metadata: Metadata = {
    title: "Contacto",
    description: DESCRIPTION,
    alternates: { canonical: "/contacto" },
    openGraph: {
        title: "Contacto | VisualDesign",
        description: DESCRIPTION,
        url: "https://visualdesignmoz.com/contacto",
        siteName: "VisualDesign",
        locale: "pt_MZ",
        type: "website",
    },
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function ContactoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
