"use client";

import { uploadProfilePhoto } from "@/lib/profile";
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function PhotoUpload({
  avatarUrl,
  initials,
  onUploaded,
}: {
  avatarUrl: string | null;
  initials: string;
  onUploaded: (url: string, completness_pct: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPEG, PNG, or WebP images accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadProfilePhoto(file);
      onUploaded(result.avatar_url, result.completeness_pct);
      toast.success("Profile photo uploaded.");
    } catch (error) {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {avatarUrl ? (
        <img
          src={
            avatarUrl.startsWith("/uploads")
              ? `${API_BASE}${avatarUrl}`
              : avatarUrl
          }
          alt="Profile"
          className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700/60"
        />
      ) : (
        <div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600
            flex items-center justify-center text-2xl font-bold text-white
            border-2 border-slate-700/60 shadow-lg shadow-sky-500/20"
        >
          {initials}
        </div>
      )}
      <div
        className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center
          opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : (
          <Camera className="w-5 h-5 text-white" />
        )}
      </div>
    </div>
  );
}
