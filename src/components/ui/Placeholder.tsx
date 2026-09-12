import { Screen, PageHeader } from "./Screen";
import { EmptyState } from "./Feedback";

/** Scaffold for screens still being wired up. */
export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <Screen>
      <PageHeader title={title} />
      <EmptyState title="Coming together" body={note ?? "This screen is being wired up."} />
    </Screen>
  );
}
