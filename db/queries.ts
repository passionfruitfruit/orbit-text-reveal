export interface D1ResultRow {
  [key: string]: unknown;
}

export async function firstOrNull<T extends D1ResultRow>(statement: D1PreparedStatement): Promise<T | null> {
  return (await statement.first<T>()) ?? null;
}

export async function allRows<T extends D1ResultRow>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}
