"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type PickerPanelProps = {
  hasSearch: boolean;
};

type PickerMessage =
  | {
      kind: "idle";
      text: string;
    }
  | {
      kind: "empty";
      text: string;
    };

export function PickerPanel({ hasSearch }: PickerPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<PickerMessage>({
    kind: "idle",
    text: "Pick a surprise option from the current list.",
  });

  function pick({ resetFilters }: { resetFilters: boolean }) {
    startTransition(async () => {
      const params = new URLSearchParams(searchParams.toString());

      if (resetFilters) {
        params.delete("scope");
        params.delete("category");
        params.delete("q");
      }

      const response = await fetch(`/api/activities/pick?${params.toString()}`);
      if (!response.ok) {
        setMessage({
          kind: "empty",
          text: "The picker could not find an activity right now.",
        });
        return;
      }

      const payload = (await response.json()) as { activity: { id: number } | null };

      if (!payload.activity) {
        setMessage({
          kind: "empty",
          text: "No matching undone activities.",
        });
        return;
      }

      params.set("selected", String(payload.activity.id));
      setMessage({
        kind: "idle",
        text: "Picked a new activity.",
      });
      router.replace(`/?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  return (
    <section className="rounded-[2rem] border border-[var(--color-line)] bg-white/90 p-5 shadow-[0_20px_70px_rgba(88,68,48,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Surprise Pick
          </p>
          <p className="text-sm text-[var(--color-copy)]">{message.text}</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => pick({ resetFilters: false })}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
        >
          {isPending ? "Picking..." : "Pick something"}
        </button>
      </div>

      {message.kind === "empty" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-copy)]">
          <span>No matching undone activities.</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => pick({ resetFilters: true })}
            className="rounded-full border border-[var(--color-line)] px-3 py-1.5 font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink)] hover:bg-white disabled:opacity-50"
          >
            Pick from all undone
          </button>
        </div>
      ) : null}

      {hasSearch ? (
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Search and filter state in the URL controls what the picker sees.
        </p>
      ) : null}
    </section>
  );
}
