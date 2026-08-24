/**
 * Utility functions for robust date and timestamp parsing & formatting across SkillDipz.
 * Ensures UTC timestamps serialized without a 'Z' suffix are correctly parsed in local browser time.
 */

export function parseDate(dateInput: string | Date | number | undefined | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === "number") return new Date(dateInput);

  let s = String(dateInput).trim();
  if (!s) return new Date();

  // If the ISO string doesn't end with Z or an explicit +/- timezone offset, append 'Z' so it parses as UTC
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/.test(s) && !s.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    // Replace space with T if needed
    s = s.replace(" ", "T") + "Z";
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Returns human-readable relative time (e.g., "Just now", "2m ago", "1h ago", "3d ago").
 */
export function formatTimeAgo(dateInput: string | Date | number | undefined | null): string {
  const date = parseDate(dateInput);
  const now = Date.now();
  const diffMs = now - date.getTime();

  // If event is in the very near future (clock skew) or under 45 seconds ago:
  if (diffMs < 45000) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Returns exact formatted date and time for tooltips or detailed views (e.g. "Aug 24, 2026, 9:04 PM").
 */
export function formatExactDateTime(dateInput: string | Date | number | undefined | null): string {
  const date = parseDate(dateInput);
  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
