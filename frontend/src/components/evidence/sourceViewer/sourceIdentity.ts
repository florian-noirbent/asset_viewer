import type { ProvenanceSource, SourceViewerTarget } from "../../../types";

export function sourceKey(source: ProvenanceSource): string {
  const quotedSource = source as ProvenanceSource & { document?: string };
  return [source.sourceType, quotedSource.document ?? "", source.quote].join("|");
}

export function withTopLevelSiblingSources(target: SourceViewerTarget): ProvenanceSource {
  if (!("sources" in target.source)) {
    return target.source;
  }

  const nestedKeys = new Set(target.source.sources.map(sourceKey));
  const siblingSources = target.sources.filter((source) => sourceKey(source) !== sourceKey(target.source) && !nestedKeys.has(sourceKey(source)));

  if (siblingSources.length === 0) {
    return target.source;
  }

  return {
    ...target.source,
    sources: [...target.source.sources, ...siblingSources],
  };
}
