import { Plus, SignOut, Database, Brain, UsersThree } from "@phosphor-icons/react";
import { StatusBadge } from "./StatusBadge";
import { useAuth } from "../context/AuthContext";

export default function JobsSidebar({ jobs, selectedId, onSelect, onNewRequest, onOpenKb, onOpenTraining, onOpenUsers }) {
  const { user, logout } = useAuth();
  return (
    <aside data-testid="jobs-sidebar" className="w-80 flex-shrink-0 bg-[#0A0A0A] border-r border-white/10 h-full flex flex-col noise-overlay">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 bg-[#FF5F15] rounded-sm flex items-center justify-center font-heading font-bold text-black">T</div>
          <span className="font-heading text-xl font-bold text-white tracking-tight">TMAIT</span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">A.T.O.M · BC TMM 2020</p>
      </div>

      <div className="p-4">
        <button data-testid="new-request-button" onClick={onNewRequest}
          className="w-full flex items-center justify-center gap-2 bg-[#FF5F15] text-black font-heading font-bold py-3 rounded-sm text-sm uppercase tracking-wide hover:bg-[#ff7538] transition-colors duration-150 glow-orange">
          <Plus weight="bold" size={16} /> New Request
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Jobs ({jobs.length})</p>
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="jobs-list">
        {jobs.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-500 font-body" data-testid="jobs-empty-state">No jobs yet. Submit your first traffic-management request.</p>
        )}
        {jobs.map((j, i) => (
          <button key={j.id} data-testid={`job-item-${j.id}`} onClick={() => onSelect(j.id)}
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            className={`w-full text-left px-4 py-3.5 border-b border-white/10 transition-colors duration-150 animate-rise ${selectedId === j.id ? "bg-white/[0.07] border-l-2 border-l-[#FF5F15]" : "hover:bg-white/[0.04] border-l-2 border-l-transparent"}`}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-heading font-medium text-sm text-white leading-tight">{j.title}</span>
              <StatusBadge status={j.status} />
            </div>
            <p className="text-xs text-zinc-400 font-body truncate">{j.location}</p>
            <p className="font-mono text-[10px] text-zinc-600 mt-1">{j.works_type} · {new Date(j.created_at).toLocaleDateString()}</p>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 space-y-2">
        {(user.role === "admin" || user.role === "reviewer") && (
          <>
            <button data-testid="knowledge-base-button" onClick={onOpenKb}
              className="w-full flex items-center gap-2 text-zinc-300 border border-white/15 px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em] hover:border-[#FF5F15] hover:text-white transition-colors duration-150">
              <Database size={14} /> Knowledge Base
            </button>
            <button data-testid="training-dashboard-button" onClick={onOpenTraining}
              className="w-full flex items-center gap-2 text-zinc-300 border border-white/15 px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em] hover:border-[#FF5F15] hover:text-white transition-colors duration-150">
              <Brain size={14} /> ATOM Training
            </button>
          </>
        )}
        {user.role === "admin" && (
          <button data-testid="user-management-button" onClick={onOpenUsers}
            className="w-full flex items-center gap-2 text-zinc-300 border border-white/15 px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em] hover:border-[#FF5F15] hover:text-white transition-colors duration-150">
            <UsersThree size={14} /> Users
          </button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white font-medium font-body">{user.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#FF5F15]">{user.role}</p>
          </div>
          <button data-testid="logout-button" onClick={logout} title="Sign out"
            className="text-zinc-500 hover:text-white p-2 transition-colors duration-150">
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
