import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import { isCellRefInRange, parseXlsxWorkbook } from "./xlsx";

function makeXlsxBuffer(files: Record<string, string>): ArrayBuffer {
  const zipped: Uint8Array = zipSync(Object.fromEntries(Object.entries(files).map(([path, contents]) => [path, strToU8(contents)])));
  return new Uint8Array(zipped).buffer;
}

describe("parseXlsxWorkbook", () => {
  it("parses sheets, shared strings, inline strings, booleans, and merged ranges", () => {
    const workbook = parseXlsxWorkbook(
      makeXlsxBuffer({
        "xl/workbook.xml": `
          <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <sheets><sheet name="Evidence" sheetId="1" r:id="rId1" /></sheets>
          </workbook>
        `,
        "xl/_rels/workbook.xml.rels": `
          <Relationships>
            <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
          </Relationships>
        `,
        "xl/sharedStrings.xml": `
          <sst>
            <si><t>Asset</t></si>
            <si><r><t>Roof</t></r><r><t> Area</t></r></si>
          </sst>
        `,
        "xl/worksheets/sheet1.xml": `
          <worksheet>
            <sheetData>
              <row r="1">
                <c r="A1" t="s"><v>0</v></c>
                <c r="B1" t="inlineStr"><is><t>Status</t></is></c>
              </row>
              <row r="2">
                <c r="A2" t="s"><v>1</v></c>
                <c r="B2"><v>42</v></c>
                <c r="C2" t="b"><v>1</v></c>
              </row>
            </sheetData>
            <mergeCells><mergeCell ref="A1:B1" /></mergeCells>
          </worksheet>
        `,
      }),
    );

    expect(workbook.sheets).toEqual([
      {
        name: "Evidence",
        mergedRanges: ["A1:B1"],
        rows: [
          {
            index: 1,
            cells: [
              { ref: "A1", row: 1, column: 1, value: "Asset" },
              { ref: "B1", row: 1, column: 2, value: "Status" },
            ],
          },
          {
            index: 2,
            cells: [
              { ref: "A2", row: 2, column: 1, value: "Roof Area" },
              { ref: "B2", row: 2, column: 2, value: "42" },
              { ref: "C2", row: 2, column: 3, value: "TRUE" },
            ],
          },
        ],
      },
    ]);
  });
});

describe("isCellRefInRange", () => {
  it("matches cells inside single and multi-cell ranges", () => {
    expect(isCellRefInRange("B2", "A1:C3")).toBe(true);
    expect(isCellRefInRange("D2", "A1:C3")).toBe(false);
    expect(isCellRefInRange("A1", "A1")).toBe(true);
  });
});
