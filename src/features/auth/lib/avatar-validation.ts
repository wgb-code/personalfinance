/**
 * Validação de avatar — Lei 12 (Upload Zero-Trust).
 *
 * Defesas em camadas (todas client-side; defesa real é server-side via
 * Storage policies + `file_size_limit` do bucket):
 *
 *  1. Magic bytes (whitelist): NUNCA confiar em `file.type` ou extensão,
 *     ambos são input do cliente e podem ser forjados (Lei 1).
 *  2. Limite de tamanho (`MAX_AVATAR_SIZE_BYTES`): Lei 3 (DoS).
 *  3. Re-encode via `<canvas>`: descarta EXIF/metadata e neutraliza
 *     polyglot files (arquivos válidos como JPEG E como HTML/JS).
 *  4. Cleanup explícito de `URL.createObjectURL` em `finally`: previne
 *     memory leak da blob URL viva no documento.
 *
 * Esta função roda 100% no cliente — assume-se que RLS no Storage
 * (`(storage.foldername(name))[1] = auth.uid()::text`) faz a defesa
 * real do path. A camada cliente existe para UX (rejeitar arquivo
 * inválido sem ida ao servidor) e para remover EXIF antes do upload.
 */
import {
  ALLOWED_AVATAR_MIME_TYPES,
  AVATAR_HEADER_BYTES_TO_READ,
  AVATAR_JPEG_QUALITY,
  AVATAR_MAGIC_BYTES,
  AVATAR_VALIDATION_MESSAGES,
  MAX_AVATAR_SIZE_BYTES,
  type AllowedAvatarMimeType,
} from "@/features/auth/lib/constants";

export type AvatarMimeType = AllowedAvatarMimeType;

export type AvatarExtension = "jpg" | "png" | "webp";

export type AvatarValidationErrorCode =
  | "INVALID_TYPE"
  | "TOO_LARGE"
  | "EMPTY_FILE"
  | "READ_FAILED"
  | "PROCESSING_FAILED";

export interface ValidateAndProcessAvatarArgs {
  file: File;
}

export interface ValidateAndProcessAvatarResult {
  blob: Blob;
  mimeType: AvatarMimeType;
  extension: AvatarExtension;
  sizeBytes: number;
}

export interface DetectAvatarMimeTypeArgs {
  file: File;
}

/**
 * Erro tipado da validação de avatar.
 *
 * `code` é a chave estável usada por callers para diferenciar tratamentos
 * (ex.: bloquear botão vs. exibir toast). `message` é a mensagem em
 * pt-BR já pronta para exibir ao usuário.
 */
export class AvatarValidationError extends Error {
  readonly code: AvatarValidationErrorCode;

  constructor(code: AvatarValidationErrorCode, message: string) {
    super(message);
    this.name = "AvatarValidationError";
    this.code = code;
  }
}

const MIME_TO_EXTENSION: Readonly<Record<AvatarMimeType, AvatarExtension>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Lê os primeiros `count` bytes do arquivo via `FileReader`.
 *
 * Não usamos `file.arrayBuffer().slice(0, count)` (que existe em browsers
 * modernos) porque mantemos compatibilidade com o `FileReader`-based
 * pipeline de testes em jsdom — e a leitura via FileReader é a API
 * estável em todos os runtimes alvo.
 */
function readFirstBytes(file: File, count: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (): void => {
      reject(
        new AvatarValidationError(
          "READ_FAILED",
          AVATAR_VALIDATION_MESSAGES.READ_FAILED,
        ),
      );
    };
    reader.onload = (): void => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(
          new AvatarValidationError(
            "READ_FAILED",
            AVATAR_VALIDATION_MESSAGES.READ_FAILED,
          ),
        );
        return;
      }
      resolve(new Uint8Array(result));
    };
    const slice = file.slice(0, count);
    reader.readAsArrayBuffer(slice);
  });
}

function matchesMagicBytes(
  actual: Uint8Array,
  expected: readonly number[],
  offset = 0,
): boolean {
  if (actual.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (actual[offset + i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Detecta o MIME type real lendo os magic bytes do arquivo.
 *
 * Lei 12: ignora `file.type` e extensão (input do cliente). A whitelist
 * é EXATAMENTE `ALLOWED_AVATAR_MIME_TYPES` — qualquer outro formato
 * (GIF, BMP, AVI, PDF, EXE, etc.) lança `INVALID_TYPE`.
 */
export async function detectAvatarMimeType(
  args: DetectAvatarMimeTypeArgs,
): Promise<AvatarMimeType> {
  const { file } = args;
  const header = await readFirstBytes(file, AVATAR_HEADER_BYTES_TO_READ);

  if (matchesMagicBytes(header, AVATAR_MAGIC_BYTES.JPEG, 0)) {
    return "image/jpeg";
  }
  if (matchesMagicBytes(header, AVATAR_MAGIC_BYTES.PNG, 0)) {
    return "image/png";
  }
  if (
    matchesMagicBytes(header, AVATAR_MAGIC_BYTES.WEBP_RIFF, 0) &&
    matchesMagicBytes(header, AVATAR_MAGIC_BYTES.WEBP_FORMAT, 8)
  ) {
    return "image/webp";
  }

  throw new AvatarValidationError(
    "INVALID_TYPE",
    AVATAR_VALIDATION_MESSAGES.INVALID_TYPE,
  );
}

/**
 * Carrega `file` em um `HTMLImageElement` via blob URL.
 *
 * Cleanup da URL é responsabilidade do CALLER (via `finally`) — assim
 * `validateAndProcessAvatar` consegue garantir revoke mesmo quando a
 * imagem falha a carregar.
 */
function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = (): void => resolve(image);
    image.onerror = (): void => {
      reject(
        new AvatarValidationError(
          "PROCESSING_FAILED",
          AVATAR_VALIDATION_MESSAGES.PROCESSING_FAILED,
        ),
      );
    };
    image.src = objectUrl;
  });
}

/**
 * Re-encoda a imagem via canvas, retornando um Blob limpo.
 *
 * O canvas decodifica os pixels e re-escreve o container do zero —
 * todos os chunks auxiliares (EXIF APP1, XMP, ICC profiles, payloads
 * embutidos em polyglot files) são descartados nesse processo.
 *
 * Trade-off: o output PODE ser maior que o input (re-encode lossy
 * com qualidade alta + ausência de compressão otimizada do encoder
 * original). Aceitável para avatares pequenos; medir em produção
 * antes de qualquer otimização.
 */
function reEncodeViaCanvas(
  image: HTMLImageElement,
  mimeType: AvatarMimeType,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(
        new AvatarValidationError(
          "PROCESSING_FAILED",
          AVATAR_VALIDATION_MESSAGES.PROCESSING_FAILED,
        ),
      );
      return;
    }
    ctx.drawImage(image, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new AvatarValidationError(
              "PROCESSING_FAILED",
              AVATAR_VALIDATION_MESSAGES.PROCESSING_FAILED,
            ),
          );
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

/**
 * Valida e processa um arquivo de avatar.
 *
 * Ordem de validação (rejeitar barato primeiro):
 *   1. `file.size === 0` → `EMPTY_FILE`
 *   2. `file.size > MAX_AVATAR_SIZE_BYTES` → `TOO_LARGE`
 *   3. `detectAvatarMimeType` (lê magic bytes) → `INVALID_TYPE` se falhar
 *   4. Re-encode via canvas → retorna blob processado
 *
 * Decisão: o MIME do output é o MESMO do input (JPEG→JPEG, PNG→PNG,
 * WebP→WebP). Manter o formato evita surpresas com transparência (PNG
 * convertido em JPEG perde alpha) e mantém previsibilidade do upload.
 *
 * Garantia: `URL.revokeObjectURL` é chamado em `finally` — qualquer
 * blob URL criada é liberada mesmo em caminho de erro (Lei 14:
 * higiene de recursos).
 */
export async function validateAndProcessAvatar(
  args: ValidateAndProcessAvatarArgs,
): Promise<ValidateAndProcessAvatarResult> {
  const { file } = args;

  if (file.size === 0) {
    throw new AvatarValidationError(
      "EMPTY_FILE",
      AVATAR_VALIDATION_MESSAGES.EMPTY_FILE,
    );
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new AvatarValidationError(
      "TOO_LARGE",
      AVATAR_VALIDATION_MESSAGES.TOO_LARGE,
    );
  }

  const mimeType = await detectAvatarMimeType({ file });

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const blob = await reEncodeViaCanvas(
      image,
      mimeType,
      AVATAR_JPEG_QUALITY,
    );
    return {
      blob,
      mimeType,
      extension: MIME_TO_EXTENSION[mimeType],
      sizeBytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Re-export da whitelist para callers que precisem da fonte de verdade
// (ex.: schema Zod do AC-02 e UI do AvatarUpload).
export { ALLOWED_AVATAR_MIME_TYPES };
