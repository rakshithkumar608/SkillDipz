export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-slate-800/60 rounded-xl animate-pulse ${className}`} />
  );
}
