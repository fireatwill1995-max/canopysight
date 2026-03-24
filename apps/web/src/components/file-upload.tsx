"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { trpc } from "@/lib/trpc/client";

interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  previewUrl?: string;
  error?: string;
  fileId?: string;
  key?: string;
}

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  siteId?: string;
  deviceId?: string;
  onUploadComplete?: (files: { name: string; url: string; fileId: string }[]) => void;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export function FileUpload({
  accept = "image/*,video/*",
  maxSizeMB = 100,
  maxFiles = 20,
  siteId,
  deviceId,
  onUploadComplete,
}: FileUploadProps) {
  const { addToast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const createUploadUrl = trpc.file.createUploadUrl.useMutation();
  const confirmUpload = trpc.file.confirmUpload.useMutation();

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return `"${file.name}" is not a supported file type.`;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `"${file.name}" exceeds the ${maxSizeMB}MB limit.`;
      }
      return null;
    },
    [maxSizeMB]
  );

  const uploadFile = useCallback(
    async (entry: UploadedFile) => {
      const updateFile = (id: string, updates: Partial<UploadedFile>) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
      };

      updateFile(entry.id, { status: "uploading", progress: 5 });

      try {
        // Step 1: Get presigned upload URL from the API
        const { fileId, uploadUrl, key } = await createUploadUrl.mutateAsync({
          filename: entry.file.name,
          contentType: entry.file.type,
          siteId,
          deviceId,
        });

        updateFile(entry.id, { fileId, key, progress: 15 });

        // Step 2: Upload file to R2 using XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              // Map upload progress to 15-85% of total progress
              const pct = 15 + (e.loaded / e.total) * 70;
              updateFile(entry.id, { progress: Math.round(pct) });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", entry.file.type);
          xhr.send(entry.file);
        });

        updateFile(entry.id, { progress: 90 });

        // Step 3: Confirm upload with the API
        await confirmUpload.mutateAsync({
          fileId,
          key,
          filename: entry.file.name,
          contentType: entry.file.type,
          size: entry.file.size,
          siteId,
          deviceId,
        });

        updateFile(entry.id, { progress: 100, status: "complete" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        updateFile(entry.id, { status: "error", error: message });
        addToast({
          type: "error",
          title: `Failed to upload ${entry.file.name}`,
          description: message,
        });
      }
    },
    [createUploadUrl, confirmUpload, siteId, deviceId, addToast]
  );

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const arr = Array.from(newFiles);
      if (files.length + arr.length > maxFiles) {
        addToast({ type: "error", title: "Too many files", description: `Maximum ${maxFiles} files allowed.` });
        return;
      }

      const entries: UploadedFile[] = [];
      for (const file of arr) {
        const error = validateFile(file);
        if (error) {
          addToast({ type: "error", title: "Invalid file", description: error });
          continue;
        }

        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        entries.push({
          id: crypto.randomUUID(),
          file,
          progress: 0,
          status: "pending",
          previewUrl,
        });
      }

      setFiles((prev) => [...prev, ...entries]);

      // Start uploading each file
      for (const entry of entries) {
        uploadFile(entry);
      }
    },
    [files.length, maxFiles, validateFile, addToast, uploadFile]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        }`}
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="font-medium text-foreground mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-muted-foreground">
          Images and video up to {maxSizeMB}MB each (max {maxFiles} files)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="relative group border border-border rounded-lg overflow-hidden bg-card"
            >
              {/* Thumbnail */}
              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.file.name}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-muted">
                  <span className="text-3xl">🎬</span>
                </div>
              )}

              {/* Progress overlay */}
              {f.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-3/4">
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <p className="text-white text-xs text-center mt-1">
                      {Math.round(f.progress)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Error overlay */}
              {f.status === "error" && (
                <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                  <div className="text-center px-2">
                    <span className="text-2xl">⚠️</span>
                    <p className="text-white text-xs mt-1 line-clamp-2">{f.error || "Upload failed"}</p>
                  </div>
                </div>
              )}

              {/* Complete indicator */}
              {f.status === "complete" && (
                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  ✓
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.id);
                }}
                className="absolute top-1 left-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>

              {/* File name */}
              <div className="px-2 py-1">
                <p className="text-xs text-foreground truncate">{f.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(f.file.size / (1024 * 1024)).toFixed(1)}MB
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && files.every((f) => f.status === "complete") && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              onUploadComplete?.(
                files.map((f) => ({ name: f.file.name, url: f.previewUrl ?? "", fileId: f.fileId ?? f.id }))
              );
              addToast({ type: "success", title: "Upload complete", description: `${files.length} files uploaded.` });
            }}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
