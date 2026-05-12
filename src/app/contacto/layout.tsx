import type { Metadata } from "next";
import { InternalFooter } from "@/components/layout/InternalFooter";

export const metadata: Metadata = {
    title: "Contacto",
};

export default function ContactoLayout({
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
