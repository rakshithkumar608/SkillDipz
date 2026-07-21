"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { Briefcase } from "lucide-react";
export default function JobsPage() {
  return <ComingSoon title="Jobs Hub" icon={Briefcase}
    description="Active job listings from verified companies, auto-matched to your profile with a match percentage." />;
}