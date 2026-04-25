import Link from "next/link";

import { auth } from "@/auth";
import { SignInForm, SignOutForm } from "@/components/auth-forms";
import { CompletionToggleButton } from "@/components/completion-toggle-button";
import { PickerPanel } from "@/components/picker-panel";
import {
  getActivityById,
  getCurrentUserAndAllowedUsers,
  isActivityVisibleInFilteredList,
  listActivities,
} from "@/db/queries";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import {
  parseDashboardFilters,
  type ActivityScope,
} from "@/lib/dashboard-filters";
import { activityCategories, type ActivityWithStatuses, type AppUser } from "@/types/activity";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Filters = ReturnType<typeof parseDashboardFilters>;

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  const filters = parseDashboardFilters(params);
  const authErrorMessage = getAuthErrorMessage(
    typeof params.authError === "string" ? params.authError : undefined,
  );

  if (!session?.user?.email) {
    return (
      <main className="min-h-screen px-6 py-16 text-[var(--color-ink)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <section className="overflow-hidden rounded-[2.5rem] border border-[var(--color-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(246,235,217,0.88))] p-8 shadow-[0_35px_120px_rgba(110,85,58,0.12)] md:p-12">
            <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] md:items-end">
              <div className="space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-muted)]">
                  our-adventures
                </p>
                <div className="space-y-4">
                  <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[var(--color-ink)] md:text-6xl">
                    A shared adventure list for Viet and Linh.
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[var(--color-copy)] md:text-lg">
                    Sign in to browse the activity catalog, see what each of you
                    has already done, and let the surprise picker choose the
                    next plan.
                  </p>
                </div>
                <SignInForm />
                {authErrorMessage ? (
                  <p className="max-w-xl rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {authErrorMessage}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4">
                <LandingCard
                  eyebrow="Shared Status"
                  title="One list, two views"
                  copy="See at a glance what Viet has done, what Linh has done, and what is still untouched."
                />
                <LandingCard
                  eyebrow="Focus"
                  title="Default to what is left"
                  copy="The dashboard starts with undone-by-me so the main list stays useful instead of archival."
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const { currentUser, users } = await getCurrentUserAndAllowedUsers(
    session.user.email,
  );

  if (!currentUser) {
    return (
      <main className="min-h-screen px-6 py-16 text-[var(--color-ink)]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-white/90 p-8 shadow-[0_30px_90px_rgba(88,68,48,0.08)]">
          <p className="text-sm text-[var(--color-copy)]">
            This signed-in account does not have a seeded database user yet.
            Run the Phase 1 bootstrap script, then try again.
          </p>
        </div>
      </main>
    );
  }

  const [{ activities }, selectedActivityResult] = await Promise.all([
    listActivities({
      currentUserId: currentUser.id,
      category: filters.category,
      scope: filters.scope,
      search: filters.search,
    }),
    filters.selectedActivityId
      ? getActivityById(filters.selectedActivityId)
      : Promise.resolve(null),
  ]);

  const selectedActivity = selectedActivityResult?.activity ?? null;
  const selectedVisible =
    selectedActivity && filters.selectedActivityId
      ? await isActivityVisibleInFilteredList(filters.selectedActivityId, {
          currentUserId: currentUser.id,
          category: filters.category,
          scope: filters.scope,
          search: filters.search,
        })
      : false;

  return (
    <main className="min-h-screen px-4 py-6 text-[var(--color-ink)] md:px-6 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-[var(--color-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(246,235,217,0.94))] p-5 shadow-[0_26px_90px_rgba(88,68,48,0.08)] md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-muted)]">
                our-adventures
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Browse what is left, or let the picker decide.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-[var(--color-copy)] md:text-base">
                  Signed in as <span className="font-semibold">{currentUser.displayName}</span>.
                  The list defaults to activities you have not completed yet.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Roster users={users} />
              <SignOutForm />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
          <section className="flex flex-col gap-6">
            <FilterBar filters={filters} />

            <PickerPanel hasSearch={filters.search.length > 0} />

            <section className="rounded-[2rem] border border-[var(--color-line)] bg-white/88 p-4 shadow-[0_25px_80px_rgba(88,68,48,0.07)] md:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
                    Activities
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {filters.scope === "undone" ? "Undone by me" : "All activities"}
                  </h2>
                </div>
                <div className="grid grid-cols-[3rem_3rem] gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  {users.map((user) => (
                    <span key={user.id}>{user.displayName}</span>
                  ))}
                </div>
              </div>

              {activities.length === 0 ? (
                <EmptyState currentSearch={filters.search} />
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {activities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      currentUser={currentUser}
                      filters={filters}
                      isSelected={filters.selectedActivityId === activity.id}
                    />
                  ))}
                </ul>
              )}
            </section>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <DetailPanel
              activity={selectedActivity}
              currentUser={currentUser}
              filters={filters}
              visibleInList={selectedVisible}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function LandingCard({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[var(--color-line)] bg-white/70 p-5 shadow-[0_20px_60px_rgba(96,72,46,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-xl font-semibold text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-copy)]">{copy}</p>
    </div>
  );
}

function FilterBar({
  filters,
}: {
  filters: Filters;
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--color-line)] bg-white/90 p-5 shadow-[0_22px_70px_rgba(88,68,48,0.07)]">
      <form action="/" className="flex flex-col gap-5">
        <input type="hidden" name="scope" value={filters.scope} />
        {filters.category ? (
          <input type="hidden" name="category" value={filters.category} />
        ) : null}
        {filters.selectedActivityId ? (
          <input
            type="hidden"
            name="selected"
            value={String(filters.selectedActivityId)}
          />
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <ScopeLink
              filters={filters}
              nextScope="undone"
              label="Undone by me"
            />
            <ScopeLink filters={filters} nextScope="all" label="All" />
          </div>

          <div className="flex w-full gap-2 md:max-w-xl">
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Search title, notes, or tips"
              className="w-full rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none ring-0 placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent-strong)]"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-ink-strong)]"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <CategoryLink
            filters={filters}
            nextCategory={null}
            label="All categories"
          />
          {activityCategories.map((category) => (
            <CategoryLink
              key={category}
              filters={filters}
              nextCategory={category}
              label={toTitleCase(category)}
            />
          ))}
        </div>
      </form>
    </section>
  );
}

function ScopeLink({
  filters,
  nextScope,
  label,
}: {
  filters: Filters;
  nextScope: ActivityScope;
  label: string;
}) {
  return (
    <Link
      href={buildDashboardHref(filters, {
        scope: nextScope,
      })}
      className={
        filters.scope === nextScope
          ? "rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white"
          : "rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]"
      }
    >
      {label}
    </Link>
  );
}

function CategoryLink({
  filters,
  nextCategory,
  label,
}: {
  filters: Filters;
  nextCategory: Filters["category"];
  label: string;
}) {
  const isActive = filters.category === nextCategory;

  return (
    <Link
      href={buildDashboardHref(filters, {
        category: nextCategory,
      })}
      className={
        isActive
          ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
          : "rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-copy)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
      }
    >
      {label}
    </Link>
  );
}

function Roster({ users }: { users: AppUser[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          key={user.id}
          className="rounded-full border border-[var(--color-line)] bg-white/70 px-3 py-1.5 text-sm font-medium text-[var(--color-copy)]"
        >
          {user.displayName}
        </span>
      ))}
    </div>
  );
}

function ActivityRow({
  activity,
  currentUser,
  filters,
  isSelected,
}: {
  activity: ActivityWithStatuses;
  currentUser: AppUser;
  filters: Filters;
  isSelected: boolean;
}) {
  const currentUserStatus = activity.sharedStatuses.find(
    (status) => status.userId === currentUser.id,
  );

  return (
    <li className="py-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
        <Link
          href={buildDashboardHref(filters, { selectedActivityId: activity.id })}
          className={
            isSelected
              ? "rounded-[1.5rem] border border-[var(--color-accent)] bg-[var(--color-surface)] p-4 shadow-[0_12px_30px_rgba(100,72,36,0.08)]"
              : "rounded-[1.5rem] border border-transparent p-4 hover:border-[var(--color-line)] hover:bg-[var(--color-surface)]"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-pending)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-copy)]">
              {toTitleCase(activity.category)}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              {activity.season}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
            {activity.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-copy)]">
            {activity.notes || activity.tip || "No extra notes yet."}
          </p>
        </Link>

        <div className="grid grid-cols-[3rem_3rem] gap-2 self-center justify-self-start md:justify-self-center">
          {activity.sharedStatuses.map((status) => (
            <StatusMarker
              key={status.userId}
              displayName={status.displayName}
              isComplete={status.isComplete}
            />
          ))}
        </div>

        <div className="justify-self-start md:justify-self-end">
          <CompletionToggleButton
            activityId={activity.id}
            isComplete={currentUserStatus?.isComplete ?? false}
            compact
          />
        </div>
      </div>
    </li>
  );
}

function StatusMarker({
  displayName,
  isComplete,
}: {
  displayName: string;
  isComplete: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center"
      title={`${displayName}: ${isComplete ? "done" : "not done"}`}
      aria-label={`${displayName}: ${isComplete ? "done" : "not done"}`}
    >
      <span
        className={
          isComplete
            ? "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]"
            : "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-muted)]"
        }
      >
        {isComplete ? "●" : "○"}
      </span>
    </div>
  );
}

function DetailPanel({
  activity,
  currentUser,
  filters,
  visibleInList,
}: {
  activity: ActivityWithStatuses | null;
  currentUser: AppUser;
  filters: Filters;
  visibleInList: boolean;
}) {
  if (!activity) {
    return (
      <section className="rounded-[2rem] border border-[var(--color-line)] bg-white/85 p-6 shadow-[0_22px_70px_rgba(88,68,48,0.07)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Details
        </p>
        <p className="mt-4 text-sm leading-7 text-[var(--color-copy)]">
          Select an activity from the list or use the picker to open its detail
          panel here.
        </p>
      </section>
    );
  }

  const currentUserStatus = activity.sharedStatuses.find(
    (status) => status.userId === currentUser.id,
  );
  const showMismatch = filters.selectedActivityId === activity.id && !visibleInList;

  return (
    <section className="rounded-[2rem] border border-[var(--color-line)] bg-white/92 p-6 shadow-[0_24px_80px_rgba(88,68,48,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
        Details
      </p>

      {showMismatch ? (
        <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>This activity does not match the current filters.</p>
          <Link
            href={buildDashboardHref(filters, {
              scope: "all",
              category: null,
              search: "",
            })}
            className="mt-3 inline-flex rounded-full border border-amber-400/70 px-3 py-1.5 font-semibold hover:bg-white"
          >
            Show it in list
          </Link>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--color-pending)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-copy)]">
          {toTitleCase(activity.category)}
        </span>
        <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {activity.season}
        </span>
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
        {activity.title}
      </h2>

      <div className="mt-5 flex flex-wrap gap-3">
        <CompletionToggleButton
          activityId={activity.id}
          isComplete={currentUserStatus?.isComplete ?? false}
        />
        {activity.link ? (
          <a
            href={activity.link}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] hover:bg-[var(--color-surface)]"
          >
            Open link
          </a>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5">
        <DetailBlock label="Notes" value={activity.notes} fallback="No notes yet." />
        <DetailBlock label="Tip" value={activity.tip} fallback="No tip saved yet." />
      </div>

      <div className="mt-7 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Shared status
        </p>
        <div className="grid gap-3">
          {activity.sharedStatuses.map((status) => (
            <div
              key={status.userId}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--color-ink)]">
                  {status.displayName}
                </p>
                <span
                  className={
                    status.isComplete
                      ? "rounded-full bg-[var(--color-success-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-success)]"
                      : "rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]"
                  }
                >
                  {status.isComplete ? "Done" : "Not done"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-copy)]">
                {status.completedAt
                  ? formatCompletion(status.completedAt)
                  : "No completion timestamp yet."}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--color-copy)]">
        {value || fallback}
      </p>
    </div>
  );
}

function EmptyState({ currentSearch }: { currentSearch: string }) {
  return (
    <div className="flex flex-col gap-4 px-2 py-10 text-center">
      <p className="text-lg font-semibold text-[var(--color-ink)]">
        No activities match your current filters.
      </p>
      <p className="text-sm text-[var(--color-copy)]">
        Try broadening the list or clearing the current search.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href={buildDashboardHref(
            { category: null, scope: "undone", search: currentSearch, selectedActivityId: null },
            { scope: "all" },
          )}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] hover:bg-white"
        >
          Switch to All
        </Link>
        {currentSearch ? (
          <Link
            href={buildDashboardHref(
              { category: null, scope: "undone", search: currentSearch, selectedActivityId: null },
              { search: "" },
            )}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] hover:bg-white"
          >
            Clear search
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function buildDashboardHref(
  current: Filters,
  updates: {
    scope?: ActivityScope;
    category?: string | null;
    search?: string;
    selectedActivityId?: number | null;
  },
) {
  const params = new URLSearchParams();
  const nextScope = updates.scope ?? current.scope;
  const nextCategory =
    updates.category === undefined ? current.category : updates.category;
  const nextSearch = updates.search === undefined ? current.search : updates.search;
  const nextSelected =
    updates.selectedActivityId === undefined
      ? current.selectedActivityId
      : updates.selectedActivityId;

  if (nextScope !== "undone") {
    params.set("scope", nextScope);
  }

  if (nextCategory) {
    params.set("category", nextCategory);
  }

  if (nextSearch) {
    params.set("q", nextSearch);
  }

  if (nextSelected) {
    params.set("selected", String(nextSelected));
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function formatCompletion(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
