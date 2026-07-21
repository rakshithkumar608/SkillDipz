"use client";



import { ComingSoon } from "@/components/student/ComingSoon";
import { Video } from "lucide-react";
export default function MockInterviewPage() {
  return <ComingSoon title="Mock Interview" icon={Video}
    description="AI-powered webcam interview sessions with real-time feedback on your answers and communication." />;
}
