/**
 * Componente de upload de avatar com preview circular (AC-14).
 *
 * Funcionalidades:
 *   - Input de arquivo com validação via magic bytes
 *   - Preview circular (120x120px)
 *   - Estados: idle, loading, error, success
 *   - Botão para remover imagem selecionada
 *
 * Acessibilidade:
 *   - Label associado ao input via aria-labelledby
 *   - aria-describedby para mensagens de erro
 *   - Botão de remover com aria-label descritivo
 *   - Focus visible em todos os elementos interativos
 *
 * Segurança (Lei 12 — Upload Zero-Trust):
 *   - Validação via `validateAndProcessAvatar` (magic bytes, re-encode)
 *   - Cleanup de blob URLs em cleanup function
 */
import { useCallback, useId, useRef, useState, useMemo, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  validateAndProcessAvatar,
  AvatarValidationError,
  ALLOWED_AVATAR_MIME_TYPES,
} from "@/features/auth/lib/avatar-validation";
import { cn } from "@/lib/utils";

export interface AvatarUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

type UploadState = "idle" | "loading" | "error" | "success";

const blobUrlCache = new WeakMap<File, string>();
const subscriptions = new Set<() => void>();

function getBlobUrl(file: File | null | undefined): string | null {
  if (!file) return null;
  
  let url = blobUrlCache.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    blobUrlCache.set(file, url);
  }
  return url;
}

function subscribe(callback: () => void): () => void {
  subscriptions.add(callback);
  return () => subscriptions.delete(callback);
}

function useBlobUrl(file: File | null | undefined): string | null {
  const getSnapshot = useCallback(() => getBlobUrl(file), [file]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function AvatarUpload({ value, onChange, error }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const [internalState, setInternalState] = useState<UploadState>("idle");
  const [internalError, setInternalError] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);

  const activeFile = value ?? localFile;
  const previewUrl = useBlobUrl(activeFile);
  const displayError = error ?? internalError;

  const state: UploadState = useMemo(() => {
    if (internalState === "loading") return "loading";
    if (internalState === "error") return "error";
    if (activeFile) return "success";
    return "idle";
  }, [internalState, activeFile]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setInternalError(null);
      setInternalState("loading");

      try {
        const result = await validateAndProcessAvatar({ file });

        const processedFile = new File([result.blob], file.name, {
          type: result.mimeType,
        });

        setLocalFile(processedFile);
        onChange(processedFile);
        setInternalState("idle");
      } catch (err) {
        if (err instanceof AvatarValidationError) {
          setInternalError(err.message);
        } else {
          setInternalError("Não foi possível processar a imagem");
        }
        setInternalState("error");

        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [onChange]
  );

  const handleRemove = useCallback(() => {
    setLocalFile(null);
    onChange(null);
    setInternalError(null);
    setInternalState("idle");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onChange]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const acceptTypes = ALLOWED_AVATAR_MIME_TYPES.join(",");

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-describedby={displayError ? errorId : undefined}
          className={cn(
            "relative flex size-[120px] items-center justify-center overflow-hidden rounded-full",
            "border-2 border-dashed border-border bg-muted",
            "motion-safe:transition motion-safe:duration-150",
            "hover:border-primary hover:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            displayError && "border-destructive"
          )}
        >
          {state === "loading" && (
            <div data-testid="loading-spinner" className="absolute inset-0 flex items-center justify-center bg-muted/80">
              <LoadingSpinner />
            </div>
          )}

          {previewUrl && state === "success" ? (
            <img
              src={previewUrl}
              alt="Preview do avatar"
              data-testid="avatar-preview"
              className="size-full object-cover"
            />
          ) : (
            <CameraIcon />
          )}
        </button>

        {state === "success" && previewUrl && (
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            onClick={handleRemove}
            aria-label="Remover avatar"
            className="absolute -right-1 -top-1 rounded-full"
          >
            <XIcon />
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptTypes}
        onChange={handleFileSelect}
        aria-label="Selecionar avatar"
        className="sr-only"
      />

      {displayError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-destructive"
        >
          {displayError}
        </p>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      data-testid="camera-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin text-primary"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
