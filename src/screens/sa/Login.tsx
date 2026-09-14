import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saLogin } from "../../lib/services/superAdmin";

export default function SaLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await saLogin(email, password);
      navigate("/sa/overview", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#12172a] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1b2440] p-8 shadow-2xl">
        <div className="mb-6 font-display text-2xl font-bold text-white">9nerz</div>
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">Control plane</h1>
          <span className="rounded bg-[#f2a93b]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#f2a93b]">
            Super Admin
          </span>
        </div>
        <p className="mb-6 text-xs text-white/50">Platform owners only. Separate from company accounts.</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#12172a] px-3 py-2 text-sm text-white outline-none focus:border-[#f2a93b]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#12172a] px-3 py-2 text-sm text-white outline-none focus:border-[#f2a93b]"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#f2a93b] px-4 py-2 text-sm font-semibold text-[#202b4e] transition hover:brightness-95 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setEmail("owner@9nerz.app");
            setPassword("Password1!");
          }}
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-white/60 hover:bg-white/10"
        >
          Use demo owner — owner@9nerz.app / Password1!
        </button>
      </div>
    </div>
  );
}
