import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileData } from "@/lib/profile";
import { FaLinkedin } from "react-icons/fa";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function CertificateCard({
  cert,
}: {
  cert: ProfileData["certificates"][0];
}) {
  const shareLink = `https://skilldipz.com/verify/${cert.cert_id}`;
  const pct = Math.round(cert.score);

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Share link copied!");
  };

  const shareLinkedIn = () => {
    const url = new URL("https://www.linkedin.com/shareArticle");
    url.searchParams.set("mini", "true");
    url.searchParams.set("url", shareLink);
    url.searchParams.set(
      "title",
      `I earned a SkillDipz certificate for ${cert.role}!`
    );
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const C = 2 * Math.PI * 22;

  return (
    <div
      className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800/60
        rounded-xl hover:border-violet-500/30 transition-all group"
    >
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="-rotate-90 w-14 h-14" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle
            cx="28" cy="28" r="22" fill="none"
            stroke="#a78bfa" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-violet-300">{pct}%</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{cert.role}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(cert.issued_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {cert.pdf_url && (
          <a
            href={`${API_BASE}${cert.pdf_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400
              hover:bg-emerald-500/10 transition-colors"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400
            hover:bg-sky-500/10 transition-colors"
          title="Copy share link"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={shareLinkedIn}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400
            hover:bg-blue-500/10 transition-colors"
          title="Share on LinkedIn"
        >
          <FaLinkedin className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
