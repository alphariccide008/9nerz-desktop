import { useMemo, useState } from "react";
import { Send } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Feedback";
import { useDB } from "../../lib/db/store";
import { closeConversation, getConversation, listConversations, markConversationRead, sendChatMessage } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";
import { cn } from "../../lib/cn";

export default function SaChat() {
  const tick = useDB((db) => db.chatMessages.length + JSON.stringify(db.chatConversations));
  const convos = useMemo(() => listConversations(), [tick]);
  const [active, setActive] = useState<string | null>(convos[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  const thread = useMemo(() => (active ? getConversation(active) : null), [active, tick]);

  const openConvo = (id: string) => {
    setActive(id);
    markConversationRead(id);
  };

  return (
    <Screen maxWidth="none">
      <div className="flex flex-1 flex-row gap-3">
        <div className="w-56 shrink-0">
          <Text variant="heading" className="mb-2 block">
            Conversations
          </Text>
          <Card>
            {convos.length === 0 ? (
              <Text variant="caption" className="block p-4">
                No conversations.
              </Text>
            ) : (
              convos.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConvo(c.id)}
                  className={cn("flex w-full flex-col px-3 py-2.5 text-left", i > 0 && "border-t border-hairline/60", active === c.id && "bg-accent")}
                >
                  <div className="flex flex-row items-center gap-1.5">
                    <span className="flex-1 truncate text-[13px] font-medium text-ink">{c.visitorName}</span>
                    {c.unreadForAdmin > 0 ? <span className="rounded-full bg-amber px-1.5 text-[10px] font-bold text-ink">{c.unreadForAdmin}</span> : null}
                  </div>
                  <Text variant="caption" className="block truncate">
                    {c.lastMessage}
                  </Text>
                </button>
              ))
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {!thread?.conversation ? (
            <EmptyState title="Pick a conversation" />
          ) : (
            <>
              <div className="mb-2 flex flex-row items-center justify-between">
                <Text variant="heading">{thread.conversation.visitorName}</Text>
                <Button title="Close" size="sm" variant="outline" onPress={() => closeConversation(thread.conversation!.id)} />
              </div>
              <Card className="flex flex-1 flex-col p-3">
                <div className="flex flex-1 flex-col gap-2">
                  {thread.messages.map((m) => (
                    <div key={m.id} className={cn("max-w-[85%] rounded-xl px-3 py-2", m.sender === "super_admin" ? "self-end bg-ink" : "self-start bg-muted")}>
                      <div className={cn("text-[13px]", m.sender === "super_admin" ? "text-white" : "text-ink")}>{m.body}</div>
                      <div className={cn("mt-0.5 text-[10px]", m.sender === "super_admin" ? "text-white/50" : "text-muted-foreground")}>{relativeTime(m.createdAt)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-row items-end gap-2">
                  <Input containerClassName="flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply…" />
                  <Button
                    title="Send"
                    size="sm"
                    icon={<Send size={13} color={colors.white} />}
                    onPress={() => {
                      if (!draft.trim() || !active) return;
                      sendChatMessage(active, "super_admin", draft);
                      setDraft("");
                    }}
                  />
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
