import { activityCategories, type ActivityCategory } from "@/types/activity";

export type ActivityScope = "undone" | "all";

export type DashboardFilters = {
  category: ActivityCategory | null;
  scope: ActivityScope;
  search: string;
  selectedActivityId: number | null;
};

type SearchParamValue = string | string[] | undefined;

type RawSearchParams = Record<string, SearchParamValue>;

export function parseDashboardFilters(
  searchParams: RawSearchParams,
): DashboardFilters {
  return {
    category: parseCategory(searchParams.category),
    scope: parseScope(searchParams.scope),
    search: parseSearch(searchParams.q),
    selectedActivityId: parseSelectedActivityId(searchParams.selected),
  };
}

export function parseCategory(
  value: SearchParamValue,
): ActivityCategory | null {
  const normalized = normalizeSingleValue(value)?.toLowerCase();

  if (!normalized) {
    return null;
  }

  return activityCategories.includes(normalized as ActivityCategory)
    ? (normalized as ActivityCategory)
    : null;
}

export function parseScope(value: SearchParamValue): ActivityScope {
  return normalizeSingleValue(value) === "all" ? "all" : "undone";
}

export function parseSearch(value: SearchParamValue) {
  return normalizeSingleValue(value)?.trim() ?? "";
}

export function parseSelectedActivityId(value: SearchParamValue) {
  const raw = normalizeSingleValue(value);

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeSingleValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
