import { useEffect, useState } from "react";

import type { CsvProvenanceSource } from "../../../../types";
import { parseCsv } from "../../../../lib/csv";
import { loadCachedText } from "../../../../lib/documentCache";
import { SourceErrorState, SourceLoadingState, SourceTableView, type SourceTableSheet } from "../primitives";

export function CsvSourceView({ source }: { source: CsvProvenanceSource }) {
  const [sheet, setSheet] = useState<SourceTableSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSheet(null);
    setError(null);

    loadCachedText(source.url, source.refreshUrl)
      .then((text) => {
        if (!cancelled) setSheet(csvRowsToSheet(parseCsv(text)));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load CSV");
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) return <SourceErrorState message={error} />;
  if (!sheet) return <SourceLoadingState label="Loading CSV" />;

  const sourceColumn = source.column.toLowerCase();
  const headerColumn = sheet.rows[0]?.cells.find((cell) => cell.value.toLowerCase() === sourceColumn);

  return (
    <SourceTableView
      sheet={sheet}
      isHighlighted={(cell) => {
        const columnRef = columnNumberToLetters(cell.column);
        return Number(source.row) === cell.row && (columnRef === source.column.toUpperCase() || cell.column === headerColumn?.column);
      }}
    />
  );
}

function csvRowsToSheet(rows: string[][]): SourceTableSheet {
  return {
    name: "CSV",
    rows: rows.map((row, rowIndex) => ({
      index: rowIndex + 1,
      cells: row.map((value, columnIndex) => ({
        ref: `${columnNumberToLetters(columnIndex + 1)}${rowIndex + 1}`,
        row: rowIndex + 1,
        column: columnIndex + 1,
        value,
      })),
    })),
  };
}

function columnNumberToLetters(columnNumber: number): string {
  let value = columnNumber;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}
