import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black text-neutral-500 text-xs py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>&copy; {new Date().getFullYear()} SkillDipz. All rights reserved.</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center">
          <Link href="/legal/privacy" className="hover:text-neutral-300">Privacy Notice</Link>
          <Link href="/legal/terms" className="hover:text-neutral-300">Terms of Service</Link>
          <Link href="/legal/data-rights" className="hover:text-neutral-300">Data Rights Request</Link>
          <a href="mailto:privacy@skilldipz.com" className="hover:text-neutral-300">
            Grievance Officer: privacy@skilldipz.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
