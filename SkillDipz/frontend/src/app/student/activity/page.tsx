"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { Activity } from "lucide-react";
export default function ActivityPage() {
  return <ComingSoon title="My Activity" icon={Activity}
    description="Your full history of submissions, test scores, projects, shortlists, and streak calendar." />;
}