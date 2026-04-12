export type ActivityCategory =
  | "cinema"
  | "food"
  | "bakery"
  | "arts"
  | "shows"
  | "explore"
  | "wellness"
  | "daytrip"
  | "free"
  | "classes";

export type ActivitySeason = "spring" | "summer" | "fall" | "winter" | "any";

export type Activity = {
  id: number;
  title: string;
  category: ActivityCategory;
  season: ActivitySeason;
  notes: string | null;
  tip: string | null;
  link?: string | null;
};
