import { useNavigate } from "react-router-dom";
import { ArrowRight, Inbox, ListChecks, Network } from "lucide-react";
import { Wordmark } from "../components/brand/Logo";
import { Text } from "../components/ui/Text";
import { colors, gradient } from "../lib/theme";

const CAPABILITIES = [
  { icon: Network, label: "Your org chart is the foundation" },
  { icon: ListChecks, label: "Briefs route themselves up the chain" },
  { icon: Inbox, label: "Support email becomes a tracked ticket" },
];

const BOARD = [
  { name: "To do", dot: colors.amber, cards: [{ tag: "Marketing", t: "Draft Q3 campaign brief" }, { tag: "Legal", t: "Vendor contract review" }] },
  { name: "In progress", dot: colors.ink, cards: [{ tag: "Design", t: "Billboard artwork — Lekki" }, { tag: "Finance", t: "Monthly revenue report" }] },
  { name: "Review", dot: colors.teal, cards: [{ tag: "Sales", t: "Client proposal — new account" }] },
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="h-screen w-screen overflow-y-auto bg-background">
      <div
        className="relative overflow-hidden px-6 pb-14 pt-10"
        style={{ background: `linear-gradient(115deg, ${gradient.brand[0]}, ${gradient.brand[1]})` }}
      >
        <div className="flex max-w-[520px] flex-col gap-6">
          <Wordmark size={30} tone="white" />
          <div className="flex flex-col gap-3.5">
            <h1 className="font-display text-[32px] leading-[39px] tracking-[-0.2px] text-white">
              Your organization,
              <br />
              on one board.
            </h1>
            <div className="h-[3px] w-14 rounded-full bg-amber" />
            <p className="max-w-[330px] text-[14px] leading-6 text-white/75">
              Task and ticket management that runs on your real structure — the units, roles and reporting lines you
              define.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="flex h-12 flex-row items-center justify-center gap-2 rounded-xl bg-amber px-5 hover:opacity-90"
            >
              <Text variant="heading" className="text-ink">
                Create your organization
              </Text>
              <ArrowRight size={16} color={colors.ink} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex h-12 flex-row items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 hover:bg-white/10"
            >
              <Text variant="heading" className="text-white">
                Log in
              </Text>
            </button>
          </div>
          <Text className="text-[11px] text-white/55">No credit card · self-host option</Text>
        </div>
      </div>

      <div className="-mt-6 px-4">
        <div className="rounded-2xl border border-hairline bg-card p-3 shadow-sm">
          <div className="flex flex-row gap-2.5 overflow-x-auto">
            {BOARD.map((col) => (
              <div key={col.name} className="w-44 shrink-0 rounded-xl bg-muted/50 p-2.5">
                <div className="mb-2 flex flex-row items-center gap-2 px-1">
                  <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col.dot }} />
                  <Text variant="heading" className="text-[12px]">
                    {col.name}
                  </Text>
                  <Text variant="caption" className="ml-auto">
                    {col.cards.length}
                  </Text>
                </div>
                <div className="flex flex-col gap-2">
                  {col.cards.map((c) => (
                    <div key={c.t} className="rounded-lg border border-hairline bg-card p-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-teal">{c.tag}</div>
                      <div className="mt-1 text-[11px] font-medium leading-snug text-ink">{c.t}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-10 pt-8">
        {CAPABILITIES.map((c) => (
          <div key={c.label} className="flex flex-row items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/[0.12]">
              <c.icon size={16} color={colors.teal} />
            </div>
            <span className="flex-1 text-[13px] text-slate">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
