"use client";

import { DotPattern } from "@/components/ui/dot-pattern";
import { useRouter } from "next/navigation";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

export default function Home() {
  const router = useRouter();

  const handleStart = () => {
    // Wait 300ms for the button animation to complete before routing
    setTimeout(() => {
      router.push("/onboarding");
    }, 300);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-950">
      <div className="z-10 flex flex-col items-center gap-8 text-center px-4">
        
        <div className="space-y-4">
          <h1 className="z-10 whitespace-pre-wrap text-center text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-400 sm:text-8xl">
            SkillDipz
          </h1>
          <p className="z-10 max-w-xl text-center text-lg text-slate-300 sm:text-xl leading-relaxed">
            AI-powered skill gap analysis, personalized learning roadmaps, and direct matching with top-tier companies.
          </p>
        </div>

        <div className="mt-4" onClick={handleStart}>
          <InteractiveHoverButton>Get Started</InteractiveHoverButton> 
        </div>
      </div>

      <DotPattern
        width={24}
        height={24}
        cx={1}
        cy={1}
        cr={1}
        glow={true}
        className="fill-white/10"
      />
    </div>
  );
}
