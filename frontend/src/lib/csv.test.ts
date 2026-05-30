import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses comma-separated rows", () => {
    expect(parseCsv("name,value\nroof,12")).toEqual([
      ["name", "value"],
      ["roof", "12"],
    ]);
  });

  it("parses quoted commas, escaped quotes, and CRLF newlines", () => {
    expect(parseCsv('"name","notes"\r\n"roof","needs, ""urgent"" review"')).toEqual([
      ["name", "notes"],
      ["roof", 'needs, "urgent" review'],
    ]);
  });
});
