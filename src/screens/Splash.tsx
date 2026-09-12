import { LogoMark } from "../components/brand/Logo";

/** Branded loading screen while the local DB + session hydrate — matches the web app's Preloader. */
export default function Splash() {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid">
        <div
          className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-ink/15 blur-3xl"
          style={{ animation: "aurora-a 20s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal/15 blur-3xl"
          style={{ animation: "aurora-b 24s ease-in-out infinite" }}
        />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-ink/15 blur-2xl" />
          <div className="relative rounded-2xl shadow-lg ring-1 ring-hairline">
            <LogoMark size={80} />
          </div>
        </div>

        <div className="font-display text-2xl font-bold tracking-tight text-ink">9nerz</div>

        <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-hairline">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(135deg, #202b4e, #1f7a66)", animation: "preloader-bar 1.6s ease-in-out infinite" }}
          />
        </div>
      </div>
    </div>
  );
}
