"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { FolderOpen } from "lucide-react";
export default function ProjectsPage() {
  return <ComingSoon title="Projects" icon={FolderOpen}
    description="Company-assigned project briefs. Submit your GitHub repo and get NLP-evaluated scores." />;
}