import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Portfólio",
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
