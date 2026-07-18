import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contacto",
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function ContactoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
