"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { Map } from "lucide-react";
export default function RoadmapPage() {
  return <ComingSoon title="Learning Roadmap" icon={Map}
    description="Your AI-generated, week-by-week personalised learning plan based on your skill gaps and target role." />;
}