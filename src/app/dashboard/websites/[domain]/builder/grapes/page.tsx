"use client";

import React from "react";
import { useRouter } from "next/navigation";
import GrapesBuilder from "@/app/dashboard/page-builders/components/GrapesBuilder";

export default function GrapesBuilderPage({ params }: { params: { domain: string } }) {
  const router = useRouter();

  return <GrapesBuilder onBack={() => router.back()} />;
}
