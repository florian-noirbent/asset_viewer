import { Calculator } from "lucide-react";

import type { CompositeProvenanceSource } from "../../../../types";
import type { SourceRendererDefinition } from "../types";
import { CompositeSourceView } from "./CompositeSourceView";

export const compositeSourceRenderer: SourceRendererDefinition<CompositeProvenanceSource> = {
  Icon: Calculator,
  render: ({ source, onOpenSource }) => <CompositeSourceView source={source} onOpenSource={onOpenSource} />,
  getTitle: () => "Calculation",
  getShortTitle: () => "Calculation",
  getGroupLabel: () => "Calculations",
};
