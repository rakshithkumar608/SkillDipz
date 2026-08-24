import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Building2, LayoutDashboard, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Portal | SkillDipz",
  description: "SkillDipz Administration & Verification Control Center",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/skilldepz.png"
              alt="SkillDipz"
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Control Panel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/company/auth/signup"
            className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Company Signup Form</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-xs font-medium text-slate-400 hover:text-slate-200 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Login</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
