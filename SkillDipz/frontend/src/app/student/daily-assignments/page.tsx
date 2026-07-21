"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { CalendarCheck } from "lucide-react";
export default function DailyAssignmentsPage() {
  return <ComingSoon title="Daily Assignments" icon={CalendarCheck}
    description="Platform-assigned daily tasks to keep your streak alive and push your score forward." />;
}