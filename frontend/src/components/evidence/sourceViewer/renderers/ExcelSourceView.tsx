import { useEffect, useState } from "react";

import type { ExcelCellProvenanceSource, ExcelRangeProvenanceSource } from "../../../../types";
import { loadCachedArrayBuffer } from "../../../../lib/documentCache";
import { isCellRefInRange, parseXlsxWorkbook, type XlsxSheet } from "../../../../lib/xlsx";
import { SourceErrorState, SourceLoadingState, SourceTableView } from "../primitives";

export type ExcelProvenanceSource = ExcelCellProvenanceSource | ExcelRangeProvenanceSource;

export function ExcelSourceView({ source }: { source: ExcelProvenanceSource }) {
  const [sheets, setSheets] = useState<XlsxSheet[] | null>(null);
  const [activeSheetName, setActiveSheetName] = useState(source.sheet);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setError(null);
    setActiveSheetName(source.sheet);

    loadCachedArrayBuffer(source.url, source.refreshUrl)
      .then((buffer) => {
        if (!cancelled) setSheets(parseXlsxWorkbook(buffer).sheets);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load Excel workbook");
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) return <SourceErrorState message={error} />;
  if (!sheets) return <SourceLoadingState label="Loading workbook" />;

  const activeSheet = sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-line bg-canopy-cream p-2">
        {sheets.map((sheet) => (
          <button
            key={sheet.name}
            className={`rounded-md px-3 py-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-moss ${sheet.name === activeSheet.name ? "bg-moss text-white" : "bg-white text-canopy-fern hover:bg-canopy-mint hover:text-moss"}`}
            onClick={() => setActiveSheetName(sheet.name)}
            type="button"
          >
            {sheet.name}
          </button>
        ))}
      </div>
      <SourceTableView
        sheet={activeSheet}
        isHighlighted={(cell) => {
          if ("cell" in source) return cell.ref.toUpperCase() === source.cell.toUpperCase();
          return isCellRefInRange(cell.ref.toUpperCase(), source.range.toUpperCase());
        }}
      />
    </div>
  );
}
