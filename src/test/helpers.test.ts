import { describe, expect, test } from "bun:test";
import { collectionResponse, parseJson, toDate } from "../helpers";

describe("collectionResponse", () => {
  test("default pages from data length", () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = collectionResponse(items, "https://example.com/v2/things");

    expect(result.object).toBe("collection");
    expect(result.total_count).toBe(2);
    expect(result.data).toBe(items);
    expect(result.url).toBe("https://example.com/v2/things");
    expect(result.pages).toEqual({ per_page: 2, next_url: null });
    expect(result.data_updated_at).toBeInstanceOf(Date);
  });

  test("empty data", () => {
    const result = collectionResponse([], "https://example.com/v2/empty");

    expect(result.total_count).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.pages).toEqual({ per_page: 0, next_url: null });
  });

  test("custom pages override", () => {
    const items = [{ id: 1 }];
    const result = collectionResponse(items, "https://example.com/v2/things", {
      per_page: 1,
      next_url: "https://example.com/v2/things?page_after_id=1",
      previous_url: "https://example.com/v2/things?page_before_id=5",
    });

    expect(result.pages).toEqual({
      per_page: 1,
      next_url: "https://example.com/v2/things?page_after_id=1",
      previous_url: "https://example.com/v2/things?page_before_id=5",
    });
  });
});

describe("toDate", () => {
  test("converts epoch to Date", () => {
    const d = toDate(1700000000000);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getTime()).toBe(1700000000000);
  });

  test("returns null for null/undefined", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });
});

describe("parseJson", () => {
  test("parses valid JSON", () => {
    expect(parseJson<number[]>("[1,2,3]", [])).toEqual([1, 2, 3]);
    expect(parseJson('{"a":1}', {})).toEqual({ a: 1 });
  });

  test("returns fallback for null/undefined/empty", () => {
    expect(parseJson(null, [])).toEqual([]);
    expect(parseJson(undefined, "default")).toBe("default");
    expect(parseJson("", [])).toEqual([]);
  });

  test("returns fallback for invalid JSON", () => {
    expect(parseJson("{broken", [])).toEqual([]);
  });
});
