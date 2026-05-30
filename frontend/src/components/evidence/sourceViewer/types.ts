import type { ComponentType, ReactNode } from "react";

import type { ProvenanceSource } from "../../../types";

export type OpenSourceHandler = (source: ProvenanceSource) => void;

export type SourceRendererProps<TSource extends ProvenanceSource = ProvenanceSource> = {
  source: TSource;
  onOpenSource: OpenSourceHandler;
};

export type SourceRendererDefinition<TSource extends ProvenanceSource = ProvenanceSource> = {
  Icon: ComponentType<{ className?: string }>;
  render: (props: SourceRendererProps<TSource>) => ReactNode;
  getTitle: (source: TSource) => string;
  getShortTitle: (source: TSource) => string;
  getGroupLabel: (source: TSource) => string;
};
