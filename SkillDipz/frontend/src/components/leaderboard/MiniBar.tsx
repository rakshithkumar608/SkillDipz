interface Props {
  /** 0–100 */
  value: number;
}

export function MiniBar({ value }: Props) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="h-1 w-12 sm:w-16 bg-slate-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-linear-to-r from-sky-500 to-indigo-500 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
