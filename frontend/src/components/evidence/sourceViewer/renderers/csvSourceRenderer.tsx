import { FileSearch } from "lucide-react";

import type { CsvProvenanceSource } from "../../../../types";
import type { SourceRendererDefinition } from "../types";
import { CsvSourceView } from "./CsvSourceView";

export const csvSourceRenderer: SourceRendererDefinition<CsvProvenanceSource> = {
  Icon: FileSearch,
  render: ({ source }) => <CsvSourceView source={source} />,
  getTitle: (source) => `${source.document} - row ${source.row}, ${source.column}`,
  getShortTitle: (source) => `CSV row ${source.row}`,
  getGroupLabel: () => "CSV",
};
