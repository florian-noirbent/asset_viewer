import type { ProvenanceSource } from "../../../types";
import { unsupportedSourceRenderer } from "./renderers/UnsupportedSourceView";
import { compositeSourceRenderer } from "./renderers/compositeSourceRenderer";
import { csvSourceRenderer } from "./renderers/csvSourceRenderer";
import { excelSourceRenderer } from "./renderers/excelSourceRenderer";
import { pdfSourceRenderer } from "./renderers/pdfSourceRenderer";
import type { SourceRendererDefinition } from "./types";

export function getSourceRenderer(source: ProvenanceSource): SourceRendererDefinition<ProvenanceSource> {
  switch (source.sourceType) {
    case "composite":
      return asGenericRenderer(compositeSourceRenderer);
    case "pdf":
      return asGenericRenderer(pdfSourceRenderer);
    case "csv":
      return asGenericRenderer(csvSourceRenderer);
    case "excel":
      return asGenericRenderer(excelSourceRenderer);
    default:
      return unsupportedSourceRenderer;
  }
}

function asGenericRenderer<TSource extends ProvenanceSource>(renderer: SourceRendererDefinition<TSource>): SourceRendererDefinition<ProvenanceSource> {
  return renderer as unknown as SourceRendererDefinition<ProvenanceSource>;
}
