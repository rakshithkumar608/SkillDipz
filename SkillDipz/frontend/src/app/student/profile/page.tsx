"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { UserCircle } from "lucide-react";
export default function ProfilePage() {
  return <ComingSoon title="My Profile" icon={UserCircle}
    description="Manage your resume, skills, target role, visibility to companies, and certificates." />;
}