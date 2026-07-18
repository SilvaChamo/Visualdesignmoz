import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Serviços",
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function ServicesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
