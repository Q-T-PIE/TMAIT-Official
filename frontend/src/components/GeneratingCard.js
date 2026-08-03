const STAGES = [["retrieving", "TMM Retrieval"], ["geocoding", "Geocoding"], ["drafting", "Drafting Plan"]];
const ORDER = STAGES.map(([k]) => k);

function badgeClass(active, done) {
  if (active) return "border-[#FF5F15] text-[#FF5F15] animate-pulse";
  if (done) return "border-[#10B981] text-[#10B981]";
  return "border-black/15 text-zinc-400";
}

function StageBadge({ k, label, stage }) {
  const active = stage === k;
  const done = ORDER.indexOf(stage) > ORDER.indexOf(k);
  return (
    <span data-testid={`stage-${k}`}
      className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 border rounded-sm ${badgeClass(active, done)}`}>
      {done ? "✓ " : ""}{label}
    </span>
  );
}

export default function GeneratingCard({ progress }) {
  return (
    <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="generating-state">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-3 bg-[#FF5F15] rounded-full animate-ping" />
        <p className="font-heading text-lg font-bold text-[#0A0A0A]">A.T.O.M is working…</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STAGES.map(([k, label]) => <StageBadge key={k} k={k} label={label} stage={progress?.stage} />)}
        {progress?.chars > 0 && <span className="font-mono text-[10px] text-zinc-500">{progress.chars.toLocaleString()} chars</span>}
      </div>
      {progress?.text ? (
        <pre data-testid="stream-preview" className="bg-[#0A0A0A] text-[#34d399] font-mono text-[10px] leading-relaxed p-4 rounded-sm max-h-44 overflow-hidden whitespace-pre-wrap">{progress.text}</pre>
      ) : (
        <p className="text-sm text-zinc-500 font-body leading-relaxed">Retrieving TMM 2020 excerpts → grounding signage & taper requirements → composing plan + layout sheets.</p>
      )}
    </div>
  );
}
