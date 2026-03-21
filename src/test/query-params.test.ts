import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  booleanFromString,
  csvArray,
  subjectTypeSchema,
} from "../schemas/constants";

describe("csvArray", () => {
  const numArray = csvArray(z.coerce.number());
  const strArray = csvArray(subjectTypeSchema);

  test("parses comma-separated numbers", () => {
    expect(numArray.parse("1,2,3")).toEqual([1, 2, 3]);
  });

  test("parses single number", () => {
    expect(numArray.parse("42")).toEqual([42]);
  });

  test("coerces string numbers", () => {
    expect(numArray.parse("01,02,10")).toEqual([1, 2, 10]);
  });

  test("parses comma-separated subject types", () => {
    expect(strArray.parse("radical,kanji")).toEqual(["radical", "kanji"]);
  });

  test("parses single subject type", () => {
    expect(strArray.parse("vocabulary")).toEqual(["vocabulary"]);
  });

  test("rejects invalid subject type", () => {
    expect(() => strArray.parse("invalid")).toThrow();
  });

  test("rejects non-numeric for number array", () => {
    expect(() => numArray.parse("abc")).toThrow();
  });
});

describe("booleanFromString", () => {
  test("'true' -> true", () => {
    expect(booleanFromString.parse("true")).toBe(true);
  });

  test("'false' -> false", () => {
    expect(booleanFromString.parse("false")).toBe(false);
  });

  test("'TRUE' -> true (case insensitive)", () => {
    expect(booleanFromString.parse("TRUE")).toBe(true);
  });

  test("'False' -> false (case insensitive)", () => {
    expect(booleanFromString.parse("False")).toBe(false);
  });

  test("passes through boolean values", () => {
    expect(booleanFromString.parse(true)).toBe(true);
    expect(booleanFromString.parse(false)).toBe(false);
  });
});
