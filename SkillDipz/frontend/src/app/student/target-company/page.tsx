"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { Building2 } from "lucide-react";
export default function TargetCompanyPage() {
  return <ComingSoon title="Target Company" icon={Building2}
    description="Auto-matched companies based on your skills, score, and target role — with interview round details." />;
}