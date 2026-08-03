import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { toast } from "sonner";

const AERIAL = "https://images.unsplash.com/photo-1623173651777-e013ac17e563?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwyfHxhZXJpYWwlMjB2aWV3JTIwdHJhZmZpYyUyMGludGVyc2VjdGlvbnxlbnwwfHx8fDE3ODQ4NjA5MTR8MA&ixlib=rb-4.1.0&q=85";

const INPUT_CLS = "w-full bg-black/50 border border-white/15 text-white px-4 py-3 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-[#FF5F15] placeholder:text-zinc-500 font-body";

function submitLabel(busy, mode) {
  if (busy) return "Authenticating…";
  if (mode === "login") return "Enter Control Center";
  return "Create Account";
}

function LoginHero() {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
      <img src={AERIAL} alt="Aerial traffic intersection" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
      <div className="absolute bottom-12 left-12 right-12">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-3">BC TMM 2020 Compliant</p>
        <h2 className="font-heading text-4xl text-white font-bold tracking-tight leading-none">
          Standards-grounded traffic plans, generated in minutes.
        </h2>
      </div>
    </div>
  );
}

function Branding() {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-[#FF5F15] rounded-sm flex items-center justify-center font-heading font-bold text-black text-lg">T</div>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight">TMAIT</h1>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">Traffic Management AI Tool — powered by A.T.O.M</p>
    </div>
  );
}

function ModeTabs({ mode, setMode }) {
  return (
    <div className="flex border border-white/15 rounded-sm mb-8 overflow-hidden">
      {["login", "register"].map((m) => (
        <button key={m} data-testid={`${m}-tab`} onClick={() => setMode(m)}
          className={`flex-1 py-2.5 text-xs font-mono uppercase tracking-[0.15em] transition-colors duration-150 ${mode === m ? "bg-[#FF5F15] text-black font-bold" : "text-zinc-400 hover:text-white"}`}>
          {m === "login" ? "Sign In" : "Register"}
        </button>
      ))}
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "client" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password, form.role);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0A0A0A] noise-overlay">
      <LoginHero />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-rise">
          <Branding />
          <ModeTabs mode={mode} setMode={setMode} />

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <input data-testid="register-name-input" className={INPUT_CLS} placeholder="Full name" value={form.name} onChange={set("name")} required />
                <select data-testid="register-role-select" className={INPUT_CLS} value={form.role} onChange={set("role")}>
                  <option value="client">Client — submit requests</option>
                  <option value="reviewer">Reviewer — approve plans</option>
                </select>
              </>
            )}
            <input data-testid="login-email-input" className={INPUT_CLS} type="email" placeholder="Email address" value={form.email} onChange={set("email")} required />
            <input data-testid="login-password-input" className={INPUT_CLS} type="password" placeholder="Password" value={form.password} onChange={set("password")} required />
            <button data-testid="login-submit-button" disabled={busy}
              className="w-full bg-[#FF5F15] text-black font-heading font-bold py-3.5 rounded-sm text-sm uppercase tracking-wide hover:bg-[#ff7538] transition-colors duration-150 disabled:opacity-50 glow-orange">
              {submitLabel(busy, mode)}
            </button>
          </form>

          <p className="mt-8 text-xs text-zinc-500 font-mono leading-relaxed">
            Demo — client@tmait.ca / Client@1234 · reviewer@tmait.ca / Review@1234 · admin@tmait.ca / Admin@1234
          </p>
        </div>
      </div>
    </div>
  );
}
