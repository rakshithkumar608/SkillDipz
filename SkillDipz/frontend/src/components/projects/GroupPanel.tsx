"use client";

import { createGroup, getGroupDetails, GroupDetails, joinGroup } from "@/lib/projectsApi";
import { Check, Copy, Loader2, UserCircle2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface GroupPanelProps {
  projectId: string;
}

export default function GroupPanel({ projectId }: GroupPanelProps) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setLoading(true);
    try {
      const res = await createGroup({ project_id: projectId, group_name: groupName });
      const details = await getGroupDetails(res.invite_code);
      setGroup(details);
      toast.success("Group created! Share the code with your teammates.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await joinGroup(inviteCode.trim().toUpperCase());
      const details = await getGroupDetails(inviteCode.trim().toUpperCase());
      setGroup(details);
      toast.success(`Joined "${details.name}" successfully!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to join group.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Joined/created state — show roster
  if (group) {
    return (
      <div className="mt-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Users className="w-3.5 h-3.5" /> {group.name}
            <span className="text-slate-500 font-normal">
              · {group.members.length}/5 members
            </span>
          </div>
          {!group.is_open && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
              Full
            </span>
          )}
        </div>

        {/* Member List */}
        <div className="space-y-1.5">
          {group.members.map((m) => (
            <div key={m.student_id} className="flex items-center gap-2 text-xs text-slate-300">
              <UserCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{m.name}</span>
            </div>
          ))}
        </div>

        {/* Invite Code */}
        <div>
          <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Invite Code</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-1.5 bg-slate-800/80 rounded-lg text-sky-400 font-mono text-sm tracking-widest border border-white/6">
              {group.invite_code}
            </code>
            <button
              onClick={copyCode}
              className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-white/3 border border-white/6 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
        <Users className="w-3.5 h-3.5" /> Group Work (Up to 5 Students)
      </div>

      {mode === "idle" ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setMode("create")}
            className="flex-1 py-1.5 text-xs font-medium text-slate-300 border border-white/8 rounded-lg hover:bg-white/5 transition-all"
          >
            + Create Group
          </button>
          <button
            onClick={() => setMode("join")}
            className="flex-1 py-1.5 text-xs font-medium text-slate-300 border border-white/8 rounded-lg hover:bg-white/5 transition-all"
          >
            Join Group
          </button>
        </div>
      ) : mode === "create" ? (
        <div className="space-y-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Team Name (e.g. Fullstack Squad)"
            className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("idle")}
              className="flex-1 py-1 text-xs text-slate-500 border border-white/6 rounded-lg hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !groupName.trim()}
              className="flex-1 py-1 text-xs font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Create"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Enter 8-digit code"
            className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-xs text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("idle")}
              className="flex-1 py-1 text-xs text-slate-500 border border-white/6 rounded-lg hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={loading || !inviteCode.trim()}
              className="flex-1 py-1 text-xs font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Join"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}