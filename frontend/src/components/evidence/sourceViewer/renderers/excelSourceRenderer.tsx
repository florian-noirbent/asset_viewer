import { FileSpreadsheet } from "lucide-react";

import type { SourceRendererDefinition } from "../types";
import { ExcelSourceView, type ExcelProvenanceSource } from "./ExcelSourceView";

export const excelSourceRenderer: SourceRendererDefinition<ExcelProvenanceSource> = {
  Icon: FileSpreadsheet,
  render: ({ source }) => <ExcelSourceView source={source} />,
  getTitle: (source) => {
    if ("cell" in source) return `${source.document} - ${source.sheet}!${source.cell}`;
    return `${source.document} - ${source.sheet}!${source.range}`;
  },
  getShortTitle: (source) => {
    if ("cell" in source) return `${source.sheet}!${source.cell}`;
    return `${source.sheet}!${source.range}`;
  },
  getGroupLabel: () => "EXCEL",
};
