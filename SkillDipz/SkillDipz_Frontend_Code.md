# SkillDipz Frontend Implementation

This document contains the core frontend files for the Next.js application, including the Onboarding flow and layout configuration. As requested, these are provided here instead of being written directly to the project source code.

## 1. `frontend/src/app/layout.tsx`
This sets up the **Outfit** Google Font and dark theme for the entire application.

```tsx
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// Using Outfit for a highly modern and premium look
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "SkillDipz | Elevate Your Career",
  description: "AI-powered skill gap analysis and recruitment platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans bg-slate-950 text-slate-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

## 2. `frontend/src/app/(auth)/onboarding/page.tsx`
The primary onboarding flow for a student, featuring a modern glassmorphic UI, animations via `framer-motion`, and capturing real data defined in your MongoDB schemas (Full Name, College, Primary Role).

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, UploadCloud, Briefcase, GraduationCap } from "lucide-react";

// The Target Roles derived from the Feature Spec requirements
const ROLES = [
  "Java Backend Developer",
  "Frontend Engineer (React)",
  "Fullstack Developer",
  "Data Scientist",
  "DevOps Engineer"
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    college: "",
    primaryRole: "",
    resumeUploaded: false,
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  // Mock submission handler
  const handleCompleteSetup = () => {
    console.log("Submitting Profile to API...", formData);
    // This will hit POST /v1/auth/resume-upload and create the student_profile
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow Effects for Premium Look */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Step Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${step >= i ? 'bg-blue-500' : 'bg-slate-800'}`} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Basic Profile Info */}
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to SkillDipz</h1>
                <p className="text-slate-400">Let's set up your profile to start matching you with top companies.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-400" /> Full Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Arjun Sharma"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-400" /> College / University
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. IIT Bombay"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    value={formData.college}
                    onChange={(e) => setFormData({...formData, college: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!formData.fullName || !formData.college}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 2: Target Role Selection */}
          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Your Target Role</h1>
                <p className="text-slate-400">What role are you aiming for? We'll tailor your roadmap.</p>
              </div>

              <div className="grid gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setFormData({...formData, primaryRole: role})}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                      formData.primaryRole === role 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-medium text-slate-200">{role}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.primaryRole === role ? 'border-blue-500' : 'border-slate-600 group-hover:border-slate-500'
                    }`}>
                      {formData.primaryRole === role && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={prevStep}
                  className="px-6 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={nextStep}
                  disabled={!formData.primaryRole}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Resume Upload (For AI Parsing) */}
          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Resume</h1>
                <p className="text-slate-400">Our AI will parse your skills to build your custom roadmap instantly.</p>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/50 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-200">Click to upload PDF</p>
                  <p className="text-sm text-slate-500 mt-1">Maximum file size 5MB</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={prevStep}
                  className="px-6 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleCompleteSetup}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25"
                >
                  Complete Setup
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

## 3. Environment Variables (Frontend)
Based on `SkillDipz_Environment_And_Schemas.md`, these will go into `frontend/.env.local`.

```env
# ----------------------------------------------------
# FRONTEND CONFIGURATION
# ----------------------------------------------------
# Main API connection
NEXT_PUBLIC_API_URL="https://api.skilldipz.com/v1"

# WebSocket connection for real-time scores and notifications
NEXT_PUBLIC_SOCKET_URL="wss://api.skilldipz.com/ws"

# CDN for loading images/videos fast (bypassing S3 limits)
NEXT_PUBLIC_AWS_CLOUDFRONT_DOMAIN="https://cdn.skilldipz.com"

# Public key for payments
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_xxx"
```

## Next Steps
Once you are ready to bootstrap the actual codebase:
1. Run `npx create-next-app@latest frontend`
2. Install `framer-motion`, `lucide-react`, `zustand`
3. Copy these files into their respective directories!
