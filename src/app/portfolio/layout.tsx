import type { Metadata } from "next";
import { InternalFooter } from "@/components/layout/InternalFooter";

export const metadata: Metadata = {
    title: "Portfólio",
};

export default function PortfolioLayout({
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
