import { useMemo } from "react";
import { Inbox } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { listPlatformTickets } from "../../lib/services/superAdmin";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber/20 text-[#8a5a12]",
  resolved: "bg-teal/15 text-teal",
};

export default function SaSupport() {
  const tick = useDB((db) => db.platformTickets.length + db.platformTickets.map((t) => t.status).join(""));
  const tickets = useMemo(() => listPlatformTickets(), [tick]);

  return (
    <Screen>
      <div>
        <h1 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Inbox className="h-5 w-5" /> 9nerz support inbox
        </h1>
        <Text variant="caption" className="mt-0.5 block max-w-2xl">
          Connect the mailbox 9nerz customers write to. Mail to it becomes a ticket here and nowhere else. Each organisation's connected mailbox is isolated the same way.
        </Text>
      </div>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <span className="text-sm font-semibold text-ink">
            Tickets <span className="text-muted-foreground">· {tickets.length}</span>
          </span>
        </header>
        {tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tickets yet. They appear here once the mailbox is connected and mail arrives.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-background">
                    <td className="px-3 py-2">
                      <span className="block max-w-[26rem] truncate font-medium text-ink">{t.subject}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="block max-w-[14rem] truncate">{t.fromName || t.fromEmail}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[t.status] ?? ""}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] text-muted-foreground">{new Date(t.resolvedAt || t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-hairline px-4 py-2 text-[11px] text-muted-foreground">Read-only for now, replying from the Super Admin panel is coming next.</p>
      </section>
    </Screen>
  );
}
