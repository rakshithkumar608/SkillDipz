"use client";


import { ComingSoon } from "@/components/student/ComingSoon";
import { Bell } from "lucide-react";
export default function NotificationsPage() {
  return <ComingSoon title="Notifications" icon={Bell}
    description="All your alerts — shortlists, score updates, new job openings, and platform messages." />;
}