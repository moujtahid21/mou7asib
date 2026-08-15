import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";

describe("parseCsv", () => {
  it("splits a simple comma-separated file into headers and rows", () => {
    const result = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with embedded commas, newlines and doubled quotes", () => {
    const result = parseCsv('a,b\n"hello, world","line1\nline2"\n"say ""hi""",plain\n');
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["hello, world", "line1\nline2"],
      ['say "hi"', "plain"],
    ]);
  });

  it("strips a leading BOM", () => {
    const result = parseCsv("﻿a,b\n1,2\n");
    expect(result.headers).toEqual(["a", "b"]);
  });

  it("normalizes CRLF line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("returns an empty result for an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });

  it("handles a file with no trailing newline", () => {
    const result = parseCsv("a,b\n1,2");
    expect(result.rows).toEqual([["1", "2"]]);
  });
});
