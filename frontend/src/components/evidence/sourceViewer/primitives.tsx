import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export type SourceStatusTone = "loading" | "success" | "warning" | "error";

export function SourceLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-canopy-fern">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SourceErrorState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "border-b border-line px-4 py-2" : "h-full justify-center p-4"} bg-red-50 text-sm text-red-700`}>
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

export function SourceStatusMessage({ tone, message, icon }: { tone: SourceStatusTone; message: string; icon?: ReactNode }) {
  const toneClassName = tone === "warning" ? "bg-[#fff5df] text-[#8b5b20]" : tone === "error" ? "bg-red-50 text-red-700" : "bg-canopy-mint text-moss";

  return (
    <div className={`flex items-center gap-2 border-b border-line px-4 py-2 text-sm ${toneClassName}`}>
      {icon ?? (tone === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : tone === "error" ? <AlertCircle className="h-4 w-4" /> : null)}
      {message}
    </div>
  );
}

export type SourceTableCell = {
  ref: string;
  row: number;
  column: number;
  value: string;
};

export type SourceTableRow = {
  index: number;
  cells: SourceTableCell[];
};

export type SourceTableSheet = {
  name: string;
  rows: SourceTableRow[];
};

export function SourceTableView({ sheet, isHighlighted }: { sheet: SourceTableSheet; isHighlighted: (cell: SourceTableCell) => boolean }) {
  return (
    <div className="h-full overflow-auto p-4">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <tbody>
          {sheet.rows.map((row) => (
            <tr key={`${sheet.name}-${row.index}`}>
              <th className="sticky left-0 z-10 border-b border-r border-line bg-canopy-cream px-2 py-1 text-right text-xs font-semibold text-canopy-fern">{row.index}</th>
              {row.cells.map((cell) => (
                <td
                  key={cell.ref}
                  className={`min-w-28 max-w-72 border-b border-r border-line px-2 py-1 align-top transition ${isHighlighted(cell) ? "bg-canopy-mint font-semibold text-moss ring-2 ring-inset ring-moss" : "bg-white text-canopy-ink"}`}
                  title={cell.ref}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
