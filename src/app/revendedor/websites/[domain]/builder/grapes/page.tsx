"use client";

import React from "react";
import { useRouter } from "next/navigation";
import GrapesBuilder from "@/app/admin/page-builders/components/GrapesBuilder";

export default function ResellerGrapesBuilderPage({ params }: { params: { domain: string } }) {
  const router = useRouter();

  return <GrapesBuilder onBack={() => router.back()} />;
}
