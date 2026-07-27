import { ProfileData, ResumeAnalysisResult, uploadResume } from "@/lib/profile";
import {
  Badge,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function ResumeUploader({
  profile,
  onUploaded,
}: {
  profile: ProfileData;
  onUploaded: (r: ResumeAnalysisResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<ResumeAnalysisResult | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF or Word files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadResume(file);
      setLastResult(result);
      onUploaded(result);
      toast.success(
        `Resume analyzed! ${result.skills_extracted.length} skills extracted.`,
      );
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-7 text-center
          cursor-pointer transition-all duration-200 group
          ${
            dragOver
              ? "border-sky-400 bg-sky-500/10"
              : "border-slate-700/60 hover:border-sky-500/50 hover:bg-sky-500/5"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden sr-only"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
            <p className="text-sm font-semibold text-sky-400">
              Analyzing your resume…
            </p>
            <p className="text-xs text-slate-500">
              NLP skill extraction in progress
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20
                flex items-center justify-center group-hover:scale-110 transition-transform"
            >
              <Upload className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {profile.resume_uploaded ? "Replace Resume" : "Upload Resume"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop PDF or Word here, or click to browse · Max 5 MB
              </p>
            </div>
            {profile.resume_uploaded && (
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5
                    bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">
                    Resume on file
                  </span>
                </div>
                {profile.resume_url && (
                  <a
                    href={`${API_BASE}${profile.resume_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5
                      bg-slate-800/60 border border-slate-700/60 rounded-full
                      hover:border-sky-500/40 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400">
                      Download
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(lastResult || profile.resume_parse_summary) && (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <Zap className="w-5 h-5 text-emerald-400 flex-shrink-o mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-400 mb-1">
                NLP Analysis Result
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lastResult?.parse_summary ?? profile.resume_parse_summary}
              </p>
            </div>
          </div>
          {(lastResult?.skills_extracted.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lastResult!.skills_extracted.map((sk) => (
                <Badge key={sk} color="emerald">
                  {sk}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
