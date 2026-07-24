export const STATUS_META = {
  draft: { label: "Draft", color: "#F59E0B" },
  generating: { label: "Generating", color: "#FF5F15" },
  pending_review: { label: "Pending Review", color: "#3B82F6" },
  approved: { label: "Approved", color: "#10B981" },
  rejected: { label: "Rejected", color: "#EF4444" },
};

export function StatusBadge({ status, testId }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span data-testid={testId || `status-badge-${status}`}
      className="font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 border rounded-sm"
      style={{ color: m.color, borderColor: `${m.color}66`, backgroundColor: `${m.color}14` }}>
      {status === "generating" ? <span className="animate-pulse">{m.label}…</span> : m.label}
    </span>
  );
}
