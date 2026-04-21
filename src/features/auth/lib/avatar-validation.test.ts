/**
 * Testes do módulo de validação de avatar (AC-14 / Lei 12).
 *
 * Estratégia de mock em jsdom:
 * - jsdom NÃO implementa `Image.onload` real nem `HTMLCanvasElement.toBlob`.
 * - Mockamos `Image` (via `vi.stubGlobal`) e `HTMLCanvasElement.prototype`
 *   (via `vi.spyOn`) para manter a função sob teste 100% determinística.
 * - `URL.createObjectURL` / `URL.revokeObjectURL` são spy-ados para
 *   verificar cleanup.
 * - `FileReader` e `Blob` são suportados nativamente pelo jsdom.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import {
  AVATAR_VALIDATION_MESSAGES,
  MAX_AVATAR_SIZE_BYTES,
} from "@/features/auth/lib/constants";
import {
  AvatarValidationError,
  detectAvatarMimeType,
  validateAndProcessAvatar,
} from "@/features/auth/lib/avatar-validation";

// ---------------------------------------------------------------------------
// Fixtures de bytes (headers reais ou plausíveis)
// ---------------------------------------------------------------------------

const VALID_JPEG_HEADER = [
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
];
const VALID_PNG_HEADER = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
];
const VALID_WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];
const EXE_HEADER = [
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
];
const PDF_HEADER = [
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00,
];
const GIF_HEADER = [
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];
// RIFF correto no offset 0, formato AVI (não WebP) no offset 8
const RIFF_AVI_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MakeFileOptions {
  bytes: number[] | Uint8Array;
  mime: string;
  /** Força tamanho do arquivo (padding com 0x00 ao final). */
  sizeBytes?: number;
  name?: string;
}

function makeFile(opts: MakeFileOptions): File {
  const data =
    opts.bytes instanceof Uint8Array ? opts.bytes : new Uint8Array(opts.bytes);
  const targetSize =
    opts.sizeBytes !== undefined && opts.sizeBytes > data.length
      ? opts.sizeBytes
      : data.length;
  // Construir um ArrayBuffer concreto evita o conflito ArrayBufferLike vs
  // ArrayBuffer do TS 5.7+ no construtor de Blob/File.
  const buffer = new ArrayBuffer(targetSize);
  new Uint8Array(buffer).set(data);
  return new File([buffer], opts.name ?? "test", { type: opts.mime });
}

interface CanvasMockOptions {
  /** Se `null`, simula `toBlob(cb)` recebendo `null` (re-encode falhou). */
  toBlobReturns?: Blob | null;
  /** Se `true`, dispara `image.onerror` no setter de `src`. */
  imageFails?: boolean;
}

interface CanvasMockHandles {
  toBlobSpy: MockInstance<HTMLCanvasElement["toBlob"]>;
  createObjectURLSpy: MockInstance<typeof URL.createObjectURL>;
  revokeObjectURLSpy: MockInstance<typeof URL.revokeObjectURL>;
}

/**
 * Mocka `Image`, `URL.createObjectURL/revokeObjectURL`, `canvas.getContext`
 * e `canvas.toBlob`. Retorna spies úteis para asserts.
 */
function setupCanvasMocks(opts: CanvasMockOptions = {}): CanvasMockHandles {
  const createObjectURLSpy = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:mock-url");
  const revokeObjectURLSpy = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 100;
    height = 100;
    set src(_value: string) {
      queueMicrotask(() => {
        if (opts.imageFails) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);

  const defaultBlob = new Blob([new Uint8Array([0xff, 0xd8])], {
    type: "image/jpeg",
  });
  const blobResult: Blob | null =
    opts.toBlobReturns === undefined ? defaultBlob : opts.toBlobReturns;

  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      mimeType?: string,
    ) {
      // Repassa mimeType como `type` do blob default para asserts realistas.
      const responseBlob =
        blobResult && mimeType
          ? new Blob([blobResult], { type: mimeType })
          : blobResult;
      callback(responseBlob);
    });

  // jsdom retorna `null` em getContext('2d'); fornecemos um stub mínimo.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (() => ({ drawImage: vi.fn() })) as any,
  );

  return { toBlobSpy, createObjectURLSpy, revokeObjectURLSpy };
}

function restoreCanvasMocks(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

// ---------------------------------------------------------------------------
// Suite: detectAvatarMimeType
// ---------------------------------------------------------------------------

describe("detectAvatarMimeType", () => {
  test("SPEC-AC14: detecta JPEG por magic bytes FF D8 FF", async () => {
    const file = makeFile({ bytes: VALID_JPEG_HEADER, mime: "image/jpeg" });
    await expect(detectAvatarMimeType({ file })).resolves.toBe(
      "image/jpeg",
    );
  });

  test("SPEC-AC14: detecta PNG por magic bytes (8 bytes)", async () => {
    const file = makeFile({ bytes: VALID_PNG_HEADER, mime: "image/png" });
    await expect(detectAvatarMimeType({ file })).resolves.toBe(
      "image/png",
    );
  });

  test("SPEC-AC14: detecta WebP por RIFF + WEBP em offset 8", async () => {
    const file = makeFile({ bytes: VALID_WEBP_HEADER, mime: "image/webp" });
    await expect(detectAvatarMimeType({ file })).resolves.toBe(
      "image/webp",
    );
  });

  test("SECURITY-12: rejeita EXE renomeado mesmo com mime image/jpeg", async () => {
    const file = makeFile({
      bytes: EXE_HEADER,
      mime: "image/jpeg",
      name: "avatar.jpg",
    });
    await expect(detectAvatarMimeType({ file })).rejects.toBeInstanceOf(
      AvatarValidationError,
    );
    await expect(detectAvatarMimeType({ file })).rejects.toMatchObject({
      code: "INVALID_TYPE",
      message: AVATAR_VALIDATION_MESSAGES.INVALID_TYPE,
    });
  });

  test("SECURITY-12: rejeita PDF disfarçado de image/png", async () => {
    const file = makeFile({ bytes: PDF_HEADER, mime: "image/png" });
    await expect(detectAvatarMimeType({ file })).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  test("SECURITY-12: rejeita GIF (fora da whitelist do MVP)", async () => {
    const file = makeFile({ bytes: GIF_HEADER, mime: "image/gif" });
    await expect(detectAvatarMimeType({ file })).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  test("SECURITY-12: rejeita arquivo com header insuficiente (2 bytes)", async () => {
    const file = makeFile({ bytes: [0xff, 0xd8], mime: "image/jpeg" });
    await expect(detectAvatarMimeType({ file })).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  test("SECURITY-12: WebP com RIFF correto mas formato AVI no offset 8 → rejeita", async () => {
    const file = makeFile({ bytes: RIFF_AVI_HEADER, mime: "image/webp" });
    await expect(detectAvatarMimeType({ file })).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: validateAndProcessAvatar
// ---------------------------------------------------------------------------

describe("validateAndProcessAvatar", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    restoreCanvasMocks();
  });

  test("SPEC-AC14: rejeita arquivo vazio com EMPTY_FILE", async () => {
    const file = makeFile({ bytes: [], mime: "image/jpeg" });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "EMPTY_FILE",
      message: AVATAR_VALIDATION_MESSAGES.EMPTY_FILE,
    });
  });

  test("SPEC-AC14: rejeita arquivo > 2MB com TOO_LARGE", async () => {
    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: MAX_AVATAR_SIZE_BYTES + 1024,
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "TOO_LARGE",
      message: AVATAR_VALIDATION_MESSAGES.TOO_LARGE,
    });
  });

  test("SECURITY-12: EXE renomeado para .jpg (1MB) → INVALID_TYPE", async () => {
    const file = makeFile({
      bytes: EXE_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1 * 1024 * 1024,
      name: "avatar.jpg",
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  test("SPEC-AC14: JPEG válido 1MB → blob processado image/jpeg, ext jpg", async () => {
    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1 * 1024 * 1024,
    });
    const result = await validateAndProcessAvatar({ file });

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.sizeBytes).toBe(result.blob.size);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  test("SPEC-AC14: PNG válido → ext png", async () => {
    const file = makeFile({
      bytes: VALID_PNG_HEADER,
      mime: "image/png",
      sizeBytes: 1 * 1024 * 1024,
    });
    const result = await validateAndProcessAvatar({ file });

    expect(result.mimeType).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.blob.type).toBe("image/png");
  });

  test("SPEC-AC14: WebP válido → ext webp", async () => {
    const file = makeFile({
      bytes: VALID_WEBP_HEADER,
      mime: "image/webp",
      sizeBytes: 1 * 1024 * 1024,
    });
    const result = await validateAndProcessAvatar({ file });

    expect(result.mimeType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.blob.type).toBe("image/webp");
  });

  test("SPEC-AC14: Image.onerror → PROCESSING_FAILED", async () => {
    restoreCanvasMocks();
    setupCanvasMocks({ imageFails: true });

    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1024,
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
      message: AVATAR_VALIDATION_MESSAGES.PROCESSING_FAILED,
    });
  });

  test("SPEC-AC14: canvas.toBlob retorna null → PROCESSING_FAILED", async () => {
    restoreCanvasMocks();
    setupCanvasMocks({ toBlobReturns: null });

    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1024,
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
    });
  });

  test("SPEC-AC14: URL.revokeObjectURL é chamado no caminho de sucesso", async () => {
    restoreCanvasMocks();
    const handles = setupCanvasMocks();

    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1024,
    });
    await validateAndProcessAvatar({ file });

    expect(handles.createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(handles.revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  test("SECURITY-12: URL.revokeObjectURL é chamado MESMO em caso de erro (cleanup)", async () => {
    restoreCanvasMocks();
    const handles = setupCanvasMocks({ imageFails: true });

    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/jpeg",
      sizeBytes: 1024,
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toBeInstanceOf(AvatarValidationError);

    expect(handles.createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(handles.revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  test("SECURITY-12: toBlob é chamado com mime detectado pelos magic bytes (não pelo file.type)", async () => {
    restoreCanvasMocks();
    const handles = setupCanvasMocks();

    // file.type MENTE: diz ser PNG, mas magic bytes são JPEG.
    const file = makeFile({
      bytes: VALID_JPEG_HEADER,
      mime: "image/png",
      sizeBytes: 1024,
      name: "avatar.png",
    });
    const result = await validateAndProcessAvatar({ file });

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    // toBlob recebeu image/jpeg, não image/png
    expect(handles.toBlobSpy).toHaveBeenCalledWith(
      expect.any(Function),
      "image/jpeg",
      expect.any(Number),
    );
  });

  test("SECURITY-12: polyglot JPEG+HTML é APROVADO pelos magic bytes e neutralizado pelo re-encode", async () => {
    restoreCanvasMocks();
    const handles = setupCanvasMocks();

    // Header JPEG válido seguido de payload HTML que seria perigoso se servido
    // como text/html. O re-encode via canvas descarta tudo após o decode da
    // imagem, neutralizando o payload.
    const htmlPayload = new TextEncoder().encode(
      "<script>alert('pwned')</script>",
    );
    const polyglotBytes = new Uint8Array([
      ...VALID_JPEG_HEADER,
      ...htmlPayload,
    ]);
    const file = makeFile({
      bytes: polyglotBytes,
      mime: "image/jpeg",
      name: "polyglot.jpg",
    });
    const result = await validateAndProcessAvatar({ file });

    expect(result.mimeType).toBe("image/jpeg");
    // O blob retornado vem do canvas (re-encodado) — NÃO contém o payload HTML.
    expect(handles.toBlobSpy).toHaveBeenCalledTimes(1);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe("image/jpeg");
  });

  test("SECURITY-12: EXE com extensão .png e file.type image/png → INVALID_TYPE", async () => {
    const file = makeFile({
      bytes: EXE_HEADER,
      mime: "image/png",
      sizeBytes: 1024,
      name: "avatar.png",
    });
    await expect(
      validateAndProcessAvatar({ file }),
    ).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: AvatarValidationError
// ---------------------------------------------------------------------------

describe("AvatarValidationError", () => {
  test("expõe `code` readonly e `name` correto", () => {
    const err = new AvatarValidationError("EMPTY_FILE", "Arquivo vazio");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AvatarValidationError);
    expect(err.code).toBe("EMPTY_FILE");
    expect(err.message).toBe("Arquivo vazio");
    expect(err.name).toBe("AvatarValidationError");
  });
});
