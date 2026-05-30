import { strFromU8, unzipSync } from "fflate";

export type XlsxCell = {
  ref: string;
  row: number;
  column: number;
  value: string;
};

export type XlsxRow = {
  index: number;
  cells: XlsxCell[];
};

export type XlsxSheet = {
  name: string;
  rows: XlsxRow[];
  mergedRanges: string[];
};

export type XlsxWorkbook = {
  sheets: XlsxSheet[];
};

type WorkbookSheet = {
  name: string;
  relationshipId: string;
};

export function parseXlsxWorkbook(buffer: ArrayBuffer): XlsxWorkbook {
  const files: Record<string, Uint8Array> = unzipSync(new Uint8Array(buffer));
  const workbook = parseWorkbookXml(readZipText(files, "xl/workbook.xml"));
  const relationships = parseWorkbookRelationships(readZipText(files, "xl/_rels/workbook.xml.rels"));
  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);

  return {
    sheets: workbook.flatMap((sheet) => {
      const target = relationships.get(sheet.relationshipId);

      if (!target) {
        return [];
      }

      const worksheetPath = normalizeWorkbookTarget(target);
      const worksheetXml = readZipText(files, worksheetPath);
      return [parseWorksheetXml(sheet.name, worksheetXml, sharedStrings)];
    }),
  };
}

export function isCellRefInRange(cellRef: string, rangeRef: string): boolean {
  const [startRef, endRef = startRef] = rangeRef.split(":");
  const cell = parseCellRef(cellRef);
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);

  return (
    cell.row >= Math.min(start.row, end.row) &&
    cell.row <= Math.max(start.row, end.row) &&
    cell.column >= Math.min(start.column, end.column) &&
    cell.column <= Math.max(start.column, end.column)
  );
}

function parseWorkbookXml(workbookXml: string): WorkbookSheet[] {
  const document = parseXml(workbookXml);
  return Array.from(document.getElementsByTagName("sheet")).map((sheet) => ({
    name: sheet.getAttribute("name") ?? "",
    relationshipId: sheet.getAttribute("r:id") ?? "",
  }));
}

function parseWorkbookRelationships(relationshipsXml: string): Map<string, string> {
  const document = parseXml(relationshipsXml);
  const relationships = new Map<string, string>();

  for (const relationship of Array.from(document.getElementsByTagName("Relationship"))) {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");

    if (id && target) {
      relationships.set(id, target);
    }
  }

  return relationships;
}

function parseSharedStrings(sharedStringsFile?: Uint8Array): string[] {
  if (!sharedStringsFile) {
    return [];
  }

  const document = parseXml(strFromU8(sharedStringsFile));
  return Array.from(document.getElementsByTagName("si")).map((sharedString) =>
    Array.from(sharedString.getElementsByTagName("t"))
      .map((textNode) => textNode.textContent ?? "")
      .join(""),
  );
}

function parseWorksheetXml(name: string, worksheetXml: string, sharedStrings: string[]): XlsxSheet {
  const document = parseXml(worksheetXml);
  const rows = Array.from(document.getElementsByTagName("row")).map((rowElement) => {
    const fallbackRowIndex = Number(rowElement.getAttribute("r") ?? "0");
    const cells = Array.from(rowElement.getElementsByTagName("c")).map((cellElement) => parseWorksheetCell(cellElement, fallbackRowIndex, sharedStrings));

    return {
      index: fallbackRowIndex,
      cells,
    };
  });

  const mergedRanges = Array.from(document.getElementsByTagName("mergeCell"))
    .map((mergeCell) => mergeCell.getAttribute("ref"))
    .filter((rangeRef): rangeRef is string => Boolean(rangeRef));

  return { name, rows, mergedRanges };
}

function parseWorksheetCell(cellElement: Element, fallbackRowIndex: number, sharedStrings: string[]): XlsxCell {
  const ref = cellElement.getAttribute("r") ?? "";
  const coordinates = ref ? parseCellRef(ref) : { row: fallbackRowIndex, column: 0 };
  const type = cellElement.getAttribute("t");
  const rawValue = cellElement.getElementsByTagName("v")[0]?.textContent ?? "";

  return {
    ref,
    row: coordinates.row,
    column: coordinates.column,
    value: readCellValue(cellElement, type, rawValue, sharedStrings),
  };
}

function readCellValue(cellElement: Element, type: string | null, rawValue: string, sharedStrings: string[]): string {
  if (type === "s") {
    return sharedStrings[Number(rawValue)] ?? "";
  }

  if (type === "inlineStr") {
    return Array.from(cellElement.getElementsByTagName("t"))
      .map((textNode) => textNode.textContent ?? "")
      .join("");
  }

  if (type === "b") {
    return rawValue === "1" ? "TRUE" : "FALSE";
  }

  return rawValue;
}

function parseCellRef(cellRef: string): { row: number; column: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(cellRef);

  if (!match) {
    return { row: 0, column: 0 };
  }

  return {
    row: Number(match[2]),
    column: columnLettersToNumber(match[1]),
  };
}

function columnLettersToNumber(columnLetters: string): number {
  return columnLetters
    .toUpperCase()
    .split("")
    .reduce((column, letter) => column * 26 + letter.charCodeAt(0) - 64, 0);
}

function normalizeWorkbookTarget(target: string): string {
  if (target.startsWith("/")) {
    return target.slice(1);
  }

  if (target.startsWith("xl/")) {
    return target;
  }

  return `xl/${target}`;
}

function readZipText(files: Record<string, Uint8Array>, path: string): string {
  const file = files[path];

  if (!file) {
    throw new Error(`XLSX file is missing ${path}`);
  }

  return strFromU8(file);
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}
