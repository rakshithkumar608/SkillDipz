"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { TrendingUp } from "lucide-react";

export default function SkillGapPage() {
  return (
    <ComingSoon
      title="Skill Gap Analysis"
      icon={TrendingUp}
      description="See exactly which skills you're missing..."
    />
  );
}