import type { Metadata } from "next";
import { InternalFooter } from "@/components/layout/InternalFooter";

export const metadata: Metadata = {
    title: "Cursos",
};

export default function CursosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <InternalFooter />
        </>
    );
}
