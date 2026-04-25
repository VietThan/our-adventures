"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type CompletionToggleButtonProps = {
  activityId: number;
  isComplete: boolean;
  compact?: boolean;
};

export function CompletionToggleButton({
  activityId,
  isComplete,
  compact = false,
}: CompletionToggleButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const label = isComplete ? "Mark undone" : "Mark done";

  function handleClick() {
    startTransition(async () => {
      const method = isComplete ? "DELETE" : "POST";
      const response = await fetch(`/api/activities/${activityId}/complete`, {
        method,
      });

      if (!response.ok) {
        return;
      }

      router.refresh();

      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", String(activityId));
      router.replace(params.size > 0 ? `/?${params.toString()}` : "/", {
        scroll: false,
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        compact
          ? "rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink)] hover:bg-white disabled:opacity-50"
          : "rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-ink-strong)] disabled:opacity-50"
      }
    >
      {isPending ? "Saving..." : label}
    </button>
  );
}
