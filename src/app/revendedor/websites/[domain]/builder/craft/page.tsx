"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CraftBuilder from "@/app/dashboard/page-builders/components/CraftBuilder";

export default function ResellerCraftBuilderPage({ params }: { params: { domain: string } }) {
  const router = useRouter();

  return <CraftBuilder onBack={() => router.back()} />;
}
