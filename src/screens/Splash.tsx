import { LogoMark } from "../components/brand/Logo";
import { gradient } from "../lib/theme";

/** Branded loading screen while the local DB + session hydrate. */
export default function Splash() {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${gradient.splash[0]}, ${gradient.splash[1]}, ${gradient.splash[2]})` }}
    >
      <div className="animate-pulse">
        <LogoMark size={84} />
      </div>
      <div className="mt-9 font-display text-[34px] tracking-wide text-white">9nerz</div>
      <div className="mt-3 text-[12px] text-white/55">Your structure. Your work. One board.</div>
    </div>
  );
}
