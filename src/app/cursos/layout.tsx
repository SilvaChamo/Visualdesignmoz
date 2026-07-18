import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Cursos",
};

// Rodapé agora é único e global (ver ConditionalFooter em src/app/layout.tsx).
export default function CursosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
