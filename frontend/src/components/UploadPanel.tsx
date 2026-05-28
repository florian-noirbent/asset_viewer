import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";

import { uploadAsset } from "../api";
import type { UploadedAsset, UploadItem } from "../types";

type UploadPanelProps = {
  onUploaded?: (asset: UploadedAsset) => void;
};

export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setQueue((current) => [...files.map(createUploadItem), ...current]);
  };

  const updateQueueItem = (id: string, patch: Partial<UploadItem>) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const runUpload = async (item: UploadItem) => {
    updateQueueItem(item.id, { status: "uploading", error: undefined });

    try {
      const asset = await uploadAsset(item.file);
      updateQueueItem(item.id, { status: "uploaded", asset });
      onUploaded?.(asset);
    } catch (error) {
      updateQueueItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  };

  const uploadQueued = async () => {
    const queued = queue.filter((item) => item.status === "queued" || item.status === "error");
    for (const item of queued) {
      await runUpload(item);
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <details className="rounded-lg border border-line bg-white shadow-panel">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-moss">
        Upload source files
      </summary>
      <div className="space-y-4 border-t border-line p-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Select or drop files to upload"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition ${
            isDragging ? "border-moss bg-emerald-50" : "border-line hover:border-moss"
          }`}
        >
          <Upload className="mb-3 h-7 w-7 text-moss" />
          <div className="font-medium">Drop PDF or source files here</div>
          <div className="mt-1 text-sm text-slate-500">Files are uploaded through the API into MinIO.</div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" />
          Select files
        </button>
        <input ref={inputRef} aria-label="Upload files" className="hidden" type="file" multiple onChange={onFileInput} />

        <div className="rounded-md border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Upload Queue</h2>
            <button
              type="button"
              onClick={uploadQueued}
              disabled={!queue.some((item) => item.status === "queued" || item.status === "error")}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              Upload queued
            </button>
          </div>
          <div className="divide-y divide-line">
            {queue.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No files selected yet.</div>
            ) : (
              queue.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.file.name}</div>
                    <div className="text-xs text-slate-500">{formatBytes(item.file.size)}</div>
                    {item.error ? <div className="mt-1 max-w-xl break-words text-xs text-red-600">{item.error}</div> : null}
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function createUploadItem(file: File): UploadItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    status: "queued",
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function StatusBadge({ status }: { status: UploadItem["status"] }) {
  const styles = {
    queued: "bg-slate-100 text-slate-600",
    uploading: "bg-blue-50 text-blue-700",
    uploaded: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-700",
  };
  const icons = {
    queued: <FileText className="h-3.5 w-3.5" />,
    uploading: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    uploaded: <CheckCircle2 className="h-3.5 w-3.5" />,
    error: <AlertCircle className="h-3.5 w-3.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
}
