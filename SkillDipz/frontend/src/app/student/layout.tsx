"use client";

import { useState } from "react";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  TrendingUp,
  Trophy,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Overview",          href: "/student/overview",          icon: LayoutDashboard },
  { label: "Skill Gap",         href: "/student/skill-gap",         icon: TrendingUp },
  { label: "Learning Roadmap",  href: "/student/roadmap",           icon: Map },
  { label: "Target Company",    href: "/student/target-company",    icon: Building2 },
  { label: "My Activity",       href: "/student/activity",          icon: Activity },
  { label: "Jobs Hub",          href: "/student/jobs",              icon: Briefcase },
  { label: "Notifications",     href: "/student/notifications",     icon: Bell, showBadge: true },
  { label: "Projects",          href: "/student/projects",          icon: FolderOpen },
  { label: "Skill Tests",       href: "/student/skill-tests",       icon: FlaskConical },
  { label: "Mock Interview",    href: "/student/mock-interview",    icon: Video },
  { label: "Daily Assignments", href: "/student/daily-assignments", icon: CalendarCheck },
  { label: "Leaderboard",       href: "/student/leaderboard",       icon: Trophy },
  { label: "My Profile",        href: "/student/profile",           icon: UserCircle },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user }  = useAuthStore();
  const { unreadCount } = useDashboardStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initials =
    user?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "S";

  /*  Shared sidebar content */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="px-3 py-1.5 rounded-xl flex items-center justify-center s">
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz Logo"
            width={150}
            height={45}
            className="w-24 sm:w-[130px] h-auto"
            priority
            style={{ height: "auto", width: "auto" }}
          />
        </div>
        {/* Close button — only visible on mobile */}
        <button
          className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-200 bg-white/5"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon     = item.icon;
            const badge    = item.showBadge && unreadCount > 0 ? unreadCount : undefined;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? "bg-sky-500/10 text-sky-400 border-l-[3px] border-sky-400 pl-[9px]"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }
                  `}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge !== undefined && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {user?.full_name ?? "Student"}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden text-slate-200">
      
      {/* ── Animated Dark Background Blobs ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[60vw] rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[40vw] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>

      <div className="flex w-full relative z-10">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex fixed top-0 left-0 h-full w-60 bg-slate-900/40 backdrop-blur-2xl border-r border-white/5 flex-col z-40 shadow-2xl">
          <SidebarContent />
        </aside>

        {/* ── Mobile backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Mobile slide-in drawer ── */}
        <aside
          className={`
            fixed top-0 left-0 h-full w-64 bg-slate-900/80 backdrop-blur-2xl border-r border-white/10 flex flex-col z-50
            lg:hidden transform transition-transform duration-300 ease-in-out shadow-2xl
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <SidebarContent />
        </aside>

        {/* ── Mobile top bar ── */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-4 z-30 shadow-sm">
          {/* Left: Menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="p-2 -ml-2 rounded-xl text-slate-300 hover:bg-white/10 transition-colors relative z-10"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Right: Notifications + Small Logo */}
          <div className="flex items-center gap-3 relative z-10">
            {unreadCount > 0 && (
              <Link href="/student/notifications" className="p-2 relative rounded-xl text-slate-300 hover:bg-white/10 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow-sm shadow-sky-500/50">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </Link>
            )}

            <div className="px-1 py-0.5 rounded-[3px] flex items-center justify-center ">
              <Image
                src="/images/skilldepz.png"
                alt="SkillDipz"
                width={40}
                height={12}
                className="h-[10px] w-auto"
                priority
                style={{ height: "auto", width: "auto" }}
              />
            </div>
          </div>
        </header>

        {/* ── Main content area ── */}
        <main className="lg:ml-60 flex-1 min-h-screen overflow-auto pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
