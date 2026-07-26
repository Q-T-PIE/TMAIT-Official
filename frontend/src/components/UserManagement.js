import { useEffect, useState } from "react";
import { X, UsersThree, Trash } from "@phosphor-icons/react";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const ROLE_COLORS = { admin: "#FF5F15", reviewer: "#3B82F6", client: "#10B981" };

export default function UserManagement({ onClose }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmElevate, setConfirmElevate] = useState(null);

  const load = () => api.get("/users").then((r) => setUsers(r.data)).catch((e) => { toast.error(apiError(e)); setUsers([]); });
  useEffect(() => { load(); }, []);

  const changeRole = async (u, role) => {
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success(`${u.name} is now a ${role}`);
      setConfirmElevate(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onRoleChange = (u, role) => {
    if (role === "admin") setConfirmElevate({ id: u.id, name: u.name });
    else changeRole(u, role);
  };

  const remove = async (u) => {
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`${u.name} deleted`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" data-testid="users-modal">
      <div className="bg-[#121212] border border-white/15 rounded-sm w-full max-w-3xl max-h-[85vh] overflow-y-auto p-8 animate-rise">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF5F15] mb-1 flex items-center gap-1.5"><UsersThree size={12} /> Admin</p>
            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">User Management</h2>
            <p className="text-xs text-zinc-400 font-body mt-1">{users?.length ?? "…"} accounts · change roles or remove users</p>
          </div>
          <button data-testid="users-close-button" onClick={onClose} className="text-zinc-500 hover:text-white p-1 transition-colors duration-150"><X size={18} /></button>
        </div>

        <div className="border border-white/10 rounded-sm overflow-hidden">
          <table className="w-full text-sm" data-testid="users-table">
            <thead>
              <tr className="bg-black/40 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">
                {["User", "Role", "Jobs", "Joined", ""].map((h, i) => <th key={i} className="text-left px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <p className="text-white font-body font-medium">{u.name}{u.id === me.id && <span className="font-mono text-[9px] text-[#FF5F15] ml-2">YOU</span>}</p>
                    <p className="font-mono text-[10px] text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select data-testid={`user-role-select-${u.id}`} value={u.role} disabled={u.id === me.id}
                      onChange={(e) => onRoleChange(u, e.target.value)}
                      className="bg-black/50 border border-white/15 px-2 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#FF5F15] disabled:opacity-40"
                      style={{ color: ROLE_COLORS[u.role] }}>
                      <option value="client">client</option>
                      <option value="reviewer">reviewer</option>
                      <option value="admin">admin</option>
                    </select>
                    {confirmElevate?.id === u.id && (
                      <div data-testid={`elevate-confirm-${u.id}`} className="mt-2 border border-[#FF5F15]/60 bg-[#FF5F15]/10 rounded-sm px-3 py-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-[#FF5F15] mb-1.5">Grant full admin access?</p>
                        <div className="flex gap-2">
                          <button data-testid={`elevate-confirm-button-${u.id}`} onClick={() => changeRole(u, "admin")}
                            className="bg-[#FF5F15] text-black px-3 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider font-bold">Confirm</button>
                          <button data-testid={`elevate-cancel-button-${u.id}`} onClick={() => setConfirmElevate(null)}
                            className="text-zinc-400 font-mono text-[10px] uppercase hover:text-white">Cancel</button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{u.job_count}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-zinc-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmDelete === u.id ? (
                      <span className="flex items-center gap-2 justify-end">
                        <button data-testid={`user-delete-confirm-${u.id}`} onClick={() => remove(u)}
                          className="bg-[#EF4444] text-white px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-wider font-bold">Confirm</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-zinc-400 font-mono text-[10px] uppercase">Cancel</button>
                      </span>
                    ) : (
                      <button data-testid={`user-delete-button-${u.id}`} onClick={() => setConfirmDelete(u.id)} disabled={u.id === me.id}
                        className="text-zinc-500 hover:text-[#EF4444] p-1.5 transition-colors duration-150 disabled:opacity-30" title="Delete user">
                        <Trash size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
