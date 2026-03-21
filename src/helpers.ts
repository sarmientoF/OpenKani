export const toDate = (v: number | null | undefined): Date | null =>
  v != null ? new Date(v) : null;

/** Compute the most recent dataUpdatedAt from a list of rows. */
export function maxDataUpdatedAt(
  rows: { dataUpdatedAt?: number | null }[],
): Date | null {
  let max: number | null = null;
  for (const r of rows) {
    const t = r.dataUpdatedAt;
    if (t != null && (max == null || t > max)) max = t;
  }
  return max != null ? new Date(max) : null;
}

/** Extract base URL up to /v2 from a full request URL */
export function getBaseUrl(reqUrl: string): string {
  const i = reqUrl.indexOf("/v2");
  return i !== -1 ? reqUrl.slice(0, i + 3) : reqUrl;
}

export const parseJson = <T>(v: string | null | undefined, fallback: T): T => {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

export function collectionResponse<T>(
  data: T[],
  url: string,
  pages?: {
    per_page: number;
    next_url: string | null;
    previous_url?: string | null;
  },
  dataUpdatedAt?: Date | null,
  totalCount?: number,
) {
  return {
    object: "collection" as const,
    total_count: totalCount ?? data.length,
    data_updated_at: dataUpdatedAt ?? (data.length > 0 ? new Date() : null),
    data,
    pages: pages ?? { per_page: data.length, next_url: null },
    url,
  };
}
