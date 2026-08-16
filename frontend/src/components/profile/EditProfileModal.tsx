import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { ProfileData, ProfileUpdatePayload, updateProfile } from "@/lib/profile";

// ─────────────────────────────────────────────────────────────────────────────
// Field MUST be defined at module scope — NOT inside EditProfileModal.
// If defined inside, React creates a new component type on every re-render,
// causing the input to unmount/remount on every keystroke and lose focus.
// ─────────────────────────────────────────────────────────────────────────────
function Field({
  label,
  field,
  type = "text",
  placeholder = "",
  form,
  set,
}: {
  label: string;
  field: keyof ProfileUpdatePayload;
  type?: string;
  placeholder?: string;
  form: ProfileUpdatePayload;
  set: (k: keyof ProfileUpdatePayload, v: unknown) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={
          type === "number"
            ? String(form[field] ?? "")
            : (form[field] as string) ?? ""
        }
        onChange={(e) =>
          set(
            field,
            type === "number"
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value
          )
        }
        placeholder={placeholder}
        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl
          px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600
          focus:outline-none focus:ring-2 focus:ring-sky-500/40
          focus:border-sky-500/50 transition-all"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditProfileModal
// ─────────────────────────────────────────────────────────────────────────────
export function EditProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: ProfileData;
  onClose: () => void;
  onSave: (updated: ProfileData) => void;
}) {
  const [form, setForm] = useState<ProfileUpdatePayload>({
    name:               profile.name,
    phone:              profile.phone              ?? "",
    college:            profile.college            ?? "",
    branch:             profile.branch             ?? "",
    grad_year:          profile.grad_year          ?? undefined,
    github:             profile.github             ?? "",
    linkedin:           profile.linkedin           ?? "",
    cf_handle:          profile.cf_handle          ?? "",
    target_role:        profile.target_role        ?? "",
    target_company:     profile.target_company     ?? "",
    visibility_setting: profile.visibility_setting,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ProfileUpdatePayload, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const clean: ProfileUpdatePayload = {};
      (Object.entries(form) as [keyof ProfileUpdatePayload, unknown][]).forEach(
        ([k, v]) => {
          if (v !== "" && v !== undefined)
            (clean as Record<string, unknown>)[k] = v;
        }
      );
      const updated = await updateProfile(clean);
      toast.success("Profile saved!");
      onSave(updated);
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800/80
        rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <h3 className="text-lg font-bold text-white">Edit Profile</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white
              hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name"           field="name"           placeholder="Arjun Sharma"                     form={form} set={set} />
            <Field label="Phone"               field="phone"          type="tel" placeholder="+91 98765 43210"       form={form} set={set} />
            <Field label="College / University" field="college"       placeholder="IIT Bombay"                      form={form} set={set} />
            <Field label="Branch / Major"      field="branch"         placeholder="Computer Science"                form={form} set={set} />
            <Field label="Graduation Year"     field="grad_year"      type="number" placeholder="2026"              form={form} set={set} />
            <Field label="Target Role"         field="target_role"    placeholder="Java Backend Developer"          form={form} set={set} />
            <Field label="GitHub URL"          field="github"         placeholder="https://github.com/username"     form={form} set={set} />
            <Field label="LinkedIn URL"        field="linkedin"       placeholder="https://linkedin.com/in/username" form={form} set={set} />
            <Field label="Codeforces Handle"   field="cf_handle"      placeholder="arjun_sharma"                    form={form} set={set} />
            <Field label="Target Company"      field="target_company" placeholder="Google, Razorpay…"              form={form} set={set} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Profile Visibility
            </label>
            <select
              value={form.visibility_setting}
              onChange={(e) => set("visibility_setting", e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl
                px-3.5 py-2.5 text-sm text-slate-200
                focus:outline-none focus:ring-2 focus:ring-sky-500/40
                focus:border-sky-500/50 transition-all"
            >
              <option value="public">Public — visible to all companies</option>
              <option value="companies_only">Companies Only</option>
              <option value="private">Private — hidden from search</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white
                border border-slate-700/60 rounded-xl hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold
                bg-sky-500 hover:bg-sky-400 text-white rounded-xl transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-sky-500/25"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
