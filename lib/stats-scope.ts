/** Users with stats_excluded stay in the directory. Aggregates skip them. */

export function sqlUserCountsInStats(userAlias = "u"): string {
  return `${userAlias}.stats_excluded IS NOT TRUE`;
}

/** userIdExpr is a column on the outer query, such as user_id or t.user_id. */
export function sqlRowCountsInStats(userIdExpr: string): string {
  return `EXISTS (
    SELECT 1 FROM users _su
    WHERE _su.id = ${userIdExpr}
      AND _su.stats_excluded IS NOT TRUE
  )`;
}
