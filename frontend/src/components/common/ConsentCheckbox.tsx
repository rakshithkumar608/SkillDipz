"use client";

import Link from "next/link";

interface ConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  label: React.ReactNode;
}

/**
 * DPDP Act, 2023 (s.6) requires consent to be free, specific, informed,
 * unconditional, and unambiguous, with a clear affirmative action per purpose.
 * This checkbox is ALWAYS unticked on mount — never pre-check it, and never
 * bundle multiple purposes behind one checkbox.
 */
export default function ConsentCheckbox({
  id,
  checked,
  onChange,
  required = false,
  label,
}: ConsentCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2.5 text-sm text-neutral-400 cursor-pointer select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-violet-600"
      />
      <span>{label}</span>
    </label>
  );
}

export function PrivacyPolicyLink() {
  return (
    <Link href="/legal/privacy" target="_blank" className="text-violet-400 hover:underline">
      Privacy Notice
    </Link>
  );
}
