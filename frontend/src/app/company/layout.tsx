"use client";

import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import {
  Briefcase,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  Users,
  Video,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState} from "react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  {
    label: "Employer Dashboard",
    href: "/company/dashboard",
    icon: LayoutDashboard,
  },
  { label: "Browse Candidates", href: "/company/browse", icon: Users },
  { label: "Student Database", href: "/company/database", icon: Database },
  { label: "Scheduled Interviews", href: "/company/interviews", icon: Video },
  { label: "Global Leaderboard", href: "/company/leaderboard", icon: Trophy },
  { label: "Jobs & Applicants Center", href: "/company/jobs", icon: Briefcase },
];

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (_hasHydrated) {
      if (!user || user.role !== "COMPANY") {
        router.push("/login");
      }
    }
  }, [_hasHydrated, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const companyName = user?.full_name ?? "Company";
  const initials = companyName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
        <Image
          src="/images/skilldepz.png"
          alt="SkillDipz Logo"
          width={130}
          height={40}
          className="w-27.5 h-auto"
          priority
          style={{ height: "auto", width: "auto" }}
        />
        <button
          className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-200 bg-white/5"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Company badge */}
      <div className="px-4 py-3 mx-3 mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-300 truncate">
            {companyName}
          </p>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-wide">
            Hiring Partner
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={`${item.label}`}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-l-[3px] border-emerald-400 pl-2.25"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }
                  `}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-emerald-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {companyName}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-xl text-sm
                     text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased relative">
      <div className="flex w-full relative z-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed top-0 left-0 h-full w-60 bg-slate-900 border-r border-slate-800/80 flex-col z-40 shadow-xl">
          <SidebarContent />
        </aside>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer */}
        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800
            flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out shadow-2xl
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <SidebarContent />
        </aside>

        {/* Mobile top bar */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-md">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="p-2 -ml-2 rounded-xl text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz"
            width={80}
            height={24}
            className="h-6 w-auto"
            priority
            style={{ height: "auto", width: "auto" }}
          />
        </header>

        {/* Page content */}
        <main className="lg:ml-60 flex-1 min-h-screen overflow-auto pt-14 lg:pt-0 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
