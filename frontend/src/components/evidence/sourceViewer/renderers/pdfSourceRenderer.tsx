import { FileText } from "lucide-react";

import type { PdfProvenanceSource } from "../../../../types";
import type { SourceRendererDefinition } from "../types";
import { PdfSourceView } from "./PdfSourceView";

export const pdfSourceRenderer: SourceRendererDefinition<PdfProvenanceSource> = {
  Icon: FileText,
  render: ({ source }) => <PdfSourceView source={source} />,
  getTitle: (source) => `${source.document} - page ${source.page}`,
  getShortTitle: (source) => `PDF p.${source.page}`,
  getGroupLabel: () => "PDF",
};
