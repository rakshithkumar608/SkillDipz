"use client";

import { ComingSoon } from "@/components/student/ComingSoon";
import { Trophy } from "lucide-react";
export default function LeaderboardPage() {
  return <ComingSoon title="Leaderboard" icon={Trophy}
    description="See how you rank among peers targeting the same role — filtered by score, college, and more." />;
}