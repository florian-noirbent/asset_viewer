import { FileQuestion } from "lucide-react";

import type { ProvenanceSource } from "../../../../types";
import { SourceErrorState } from "../primitives";
import type { SourceRendererDefinition } from "../types";

export const unsupportedSourceRenderer: SourceRendererDefinition<ProvenanceSource> = {
  Icon: FileQuestion,
  render: () => <SourceErrorState message="This source type is not supported by the viewer." />,
  getTitle: (source) => `Unsupported source: ${source.sourceType}`,
  getShortTitle: (source) => source.sourceType,
  getGroupLabel: () => "Unsupported",
};
