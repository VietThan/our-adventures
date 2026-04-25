import type { PoolClient } from "pg";

import { withSchemaSearchPath } from "@/db/client";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import type {
  Activity,
  ActivityCompletionStatus,
  ActivityCategory,
  AppUser,
} from "@/types/activity";

type DbUserRow = {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  google_sub: string | null;
};

type DbActivityRow = {
  id: number;
  title: string;
  category: ActivityCategory;
  season: Activity["season"];
  notes: string | null;
  tip: string | null;
  link: string | null;
};

type ActivityListOptions = Pick<DashboardFilters, "category" | "scope" | "search"> & {
  currentUserId: number;
};

const preferredUserOrder = ["Viet", "Linh"];

export async function getAppUserByEmail(email: string) {
  return withSchemaSearchPath((client) => findAppUserByEmail(client, email));
}

export async function getAllowedUsers() {
  return withSchemaSearchPath(listAllowedUsers);
}

export async function listActivities(options: ActivityListOptions) {
  return withSchemaSearchPath((client) => listActivitiesWithClient(client, options));
}

export async function getActivityById(activityId: number) {
  return withSchemaSearchPath((client) => getActivityByIdWithClient(client, activityId));
}

export async function markActivityComplete(activityId: number, userId: number) {
  return withSchemaSearchPath(async (client) => {
    await client.query(
      `
        INSERT INTO completions (activity_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (activity_id, user_id)
        DO UPDATE SET completed_at = NOW()
      `,
      [activityId, userId],
    );

    return getActivityByIdWithClient(client, activityId);
  });
}

export async function removeActivityCompletion(activityId: number, userId: number) {
  return withSchemaSearchPath(async (client) => {
    await client.query(
      `
        DELETE FROM completions
        WHERE activity_id = $1
          AND user_id = $2
      `,
      [activityId, userId],
    );

    return getActivityByIdWithClient(client, activityId);
  });
}

export async function pickRandomActivity(options: ActivityListOptions) {
  return withSchemaSearchPath(async (client) => {
    const users = await listAllowedUsers(client);
    const activity = await pickRandomActivityWithClient(client, users, options);

    return {
      activity,
      users,
    };
  });
}

export async function isActivityVisibleInFilteredList(
  activityId: number,
  options: ActivityListOptions,
) {
  return withSchemaSearchPath(async (client) => {
    const users = await listAllowedUsers(client);
    const query = buildActivityListQuery(users, options, true);
    const result = await client.query<{ id: number }>(
      `
        ${query.sql}
          AND activities.id = $${query.params.length + 1}
      `,
      [...query.params, activityId],
    );

    return result.rows.length > 0;
  });
}

export async function getCurrentUserAndAllowedUsers(email: string) {
  return withSchemaSearchPath(async (client) => {
    const [currentUser, users] = await Promise.all([
      findAppUserByEmail(client, email),
      listAllowedUsers(client),
    ]);

    return {
      currentUser,
      users,
    };
  });
}

async function findAppUserByEmail(client: PoolClient, email: string) {
  const result = await client.query<DbUserRow>(
    `
      SELECT id, email, display_name, avatar_url, google_sub
      FROM users
      WHERE lower(email) = $1
      LIMIT 1
    `,
    [email.trim().toLowerCase()],
  );

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

async function listAllowedUsers(client: PoolClient) {
  const result = await client.query<DbUserRow>(
    `
      SELECT id, email, display_name, avatar_url, google_sub
      FROM users
      ORDER BY display_name ASC, id ASC
    `,
  );

  return result.rows.map(mapUser).sort(sortUsers);
}

async function listActivitiesWithClient(
  client: PoolClient,
  options: ActivityListOptions,
) {
  const users = await listAllowedUsers(client);
  const query = buildActivityListQuery(users, options, false);
  const result = await client.query<DbActivityRow>(query.sql, query.params);

  return {
    users,
    activities: await hydrateActivitiesWithStatuses(client, users, result.rows),
  };
}

async function getActivityByIdWithClient(client: PoolClient, activityId: number) {
  const users = await listAllowedUsers(client);
  const activityResult = await client.query<DbActivityRow>(
    `
      SELECT id, title, category, season, notes, tip, link
      FROM activities
      WHERE id = $1
      LIMIT 1
    `,
    [activityId],
  );

  const activity = activityResult.rows[0];
  if (!activity) {
    return null;
  }

  const activities = await hydrateActivitiesWithStatuses(client, users, [activity]);

  return {
    users,
    activity: activities[0] ?? null,
  };
}

async function hydrateActivitiesWithStatuses(
  client: PoolClient,
  users: AppUser[],
  activities: DbActivityRow[],
) {
  if (activities.length === 0) {
    return [];
  }

  const ids = activities.map((activity) => activity.id);
  const completionResult = await client.query<{
    activity_id: number;
    user_id: number;
    completed_at: string;
  }>(
    `
      SELECT activity_id, user_id, completed_at::text
      FROM completions
      WHERE activity_id = ANY($1::int[])
    `,
    [ids],
  );

  const completionMap = new Map<string, string>();
  for (const row of completionResult.rows) {
    completionMap.set(`${row.activity_id}:${row.user_id}`, row.completed_at);
  }

  return activities.map((activity) => ({
    ...mapActivity(activity),
    sharedStatuses: users.map((user) => {
      const completedAt = completionMap.get(`${activity.id}:${user.id}`) ?? null;
      return buildSharedStatus(user, completedAt);
    }),
  }));
}

async function pickRandomActivityWithClient(
  client: PoolClient,
  users: AppUser[],
  options: ActivityListOptions,
) {
  const query = buildActivityListQuery(users, options, true);
  const result = await client.query<{ id: number }>(
    `
      ${query.sql}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    query.params,
  );

  const picked = result.rows[0];
  if (!picked) {
    return null;
  }

  const activity = await getActivityByIdWithClient(client, picked.id);
  return activity?.activity ?? null;
}

function buildActivityListQuery(
  users: AppUser[],
  options: ActivityListOptions,
  selectIdOnly: boolean,
) {
  const { category, scope, search, currentUserId } = options;
  const params: Array<number | string> = [currentUserId];
  const fields = selectIdOnly
    ? "SELECT activities.id"
    : `
      SELECT activities.id,
             activities.title,
             activities.category,
             activities.season,
             activities.notes,
             activities.tip,
             activities.link
    `;

  let sql = `
    ${fields}
    FROM activities
    LEFT JOIN completions current_completion
      ON current_completion.activity_id = activities.id
     AND current_completion.user_id = $1
    WHERE 1 = 1
  `;

  if (category) {
    params.push(category);
    sql += ` AND activities.category = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += `
      AND (
        activities.title ILIKE $${params.length}
        OR COALESCE(activities.notes, '') ILIKE $${params.length}
        OR COALESCE(activities.tip, '') ILIKE $${params.length}
      )
    `;
  }

  if (scope === "undone") {
    sql += " AND current_completion.activity_id IS NULL";
  }

  if (!selectIdOnly) {
    sql += " ORDER BY activities.id ASC";
  }

  return {
    sql,
    params,
  };
}

function mapUser(row: DbUserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function mapActivity(row: DbActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    season: row.season,
    notes: row.notes,
    tip: row.tip,
    link: row.link,
  };
}

function buildSharedStatus(
  user: AppUser,
  completedAt: string | null,
): ActivityCompletionStatus {
  return {
    userId: user.id,
    displayName: user.displayName,
    isComplete: completedAt !== null,
    completedAt,
  };
}

function sortUsers(left: AppUser, right: AppUser) {
  const leftIndex = preferredUserOrder.indexOf(left.displayName);
  const rightIndex = preferredUserOrder.indexOf(right.displayName);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return normalizeIndex(leftIndex) - normalizeIndex(rightIndex);
  }

  return left.displayName.localeCompare(right.displayName);
}

function normalizeIndex(value: number) {
  return value === -1 ? Number.MAX_SAFE_INTEGER : value;
}
