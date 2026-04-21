/**
 * Testes do componente `AvatarUpload` (AC-14 — Upload de avatar).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 12 (Upload Zero-Trust)**: valida via `validateAndProcessAvatar`
 *     que rejeita arquivos inválidos antes de chamar `onChange`.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockValidateAndProcessAvatar } = vi.hoisted(() => ({
  mockValidateAndProcessAvatar: vi.fn(),
}));

vi.mock("@/features/auth/lib/avatar-validation", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/auth/lib/avatar-validation")
  >();
  return {
    ...actual,
    validateAndProcessAvatar: mockValidateAndProcessAvatar,
  };
});

import { AvatarUpload } from "@/features/auth/components/AvatarUpload";
import {
  AvatarValidationError,
  type ValidateAndProcessAvatarResult,
} from "@/features/auth/lib/avatar-validation";

function createMockFile(
  name = "avatar.jpg",
  type = "image/jpeg",
  size = 1024
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function createMockBlob(size = 512): Blob {
  const content = new Uint8Array(size);
  return new Blob([content], { type: "image/jpeg" });
}

describe("AvatarUpload — AC-14 (Upload de avatar)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deve exibir ícone de câmera quando vazio", () => {
    render(<AvatarUpload onChange={vi.fn()} />);

    expect(screen.getByTestId("camera-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-preview")).not.toBeInTheDocument();
  });

  test("deve exibir preview quando arquivo válido selecionado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mockFile = createMockFile();
    const mockResult: ValidateAndProcessAvatarResult = {
      blob: createMockBlob(),
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 512,
    };

    mockValidateAndProcessAvatar.mockResolvedValueOnce(mockResult);

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, mockFile);

    await waitFor(() => {
      expect(screen.getByTestId("avatar-preview")).toBeInTheDocument();
    });
  });

  test("deve chamar onChange com File processado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mockFile = createMockFile();
    const mockBlob = createMockBlob();
    const mockResult: ValidateAndProcessAvatarResult = {
      blob: mockBlob,
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 512,
    };

    mockValidateAndProcessAvatar.mockResolvedValueOnce(mockResult);

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, mockFile);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
      const calledFile = onChange.mock.calls[0][0];
      expect(calledFile).toBeInstanceOf(File);
      expect(calledFile.name).toBe("avatar.jpg");
    });
  });

  test("deve exibir erro quando arquivo inválido", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mockFile = createMockFile("fake-image.jpg", "image/jpeg");

    mockValidateAndProcessAvatar.mockRejectedValueOnce(
      new AvatarValidationError("INVALID_TYPE", "Arquivo não é uma imagem válida")
    );

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, mockFile);

    await waitFor(
      () => {
        expect(
          screen.getByText("Arquivo não é uma imagem válida")
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  test("deve chamar onChange(null) ao remover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mockFile = createMockFile();
    const mockResult: ValidateAndProcessAvatarResult = {
      blob: createMockBlob(),
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 512,
    };

    mockValidateAndProcessAvatar.mockResolvedValueOnce(mockResult);

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, mockFile);

    await waitFor(() => {
      expect(screen.getByTestId("avatar-preview")).toBeInTheDocument();
    });

    onChange.mockClear();

    const removeButton = screen.getByRole("button", { name: "Remover avatar" });
    await user.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId("avatar-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("camera-icon")).toBeInTheDocument();
  });

  test("deve exibir loading durante processamento", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mockFile = createMockFile();

    let resolveValidation: (value: ValidateAndProcessAvatarResult) => void;
    const validationPromise = new Promise<ValidateAndProcessAvatarResult>(
      (resolve) => {
        resolveValidation = resolve;
      }
    );

    mockValidateAndProcessAvatar.mockReturnValueOnce(validationPromise);

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, mockFile);

    await waitFor(() => {
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    resolveValidation!({
      blob: createMockBlob(),
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 512,
    });

    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
    });
  });

  test("deve exibir erro externo via prop error", () => {
    render(
      <AvatarUpload onChange={vi.fn()} error="Erro de upload no servidor" />
    );

    expect(screen.getByText("Erro de upload no servidor")).toBeInTheDocument();
  });

  test("deve ter input com accept correto", () => {
    render(<AvatarUpload onChange={vi.fn()} />);

    const input = screen.getByLabelText("Selecionar avatar");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  });

  test("deve ter botão de upload acessível via teclado", () => {
    render(<AvatarUpload onChange={vi.fn()} />);

    const uploadArea = screen.getByRole("button");
    expect(uploadArea).toBeInTheDocument();
    expect(uploadArea).toHaveAttribute("type", "button");
  });

  test("deve limpar erro interno ao selecionar novo arquivo válido", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    mockValidateAndProcessAvatar.mockRejectedValueOnce(
      new AvatarValidationError("INVALID_TYPE", "Arquivo não é uma imagem válida")
    );

    render(<AvatarUpload onChange={onChange} />);

    const input = screen.getByLabelText("Selecionar avatar");
    await user.upload(input, createMockFile("fake-image.jpg", "image/jpeg"));

    await waitFor(() => {
      expect(
        screen.getByText("Arquivo não é uma imagem válida")
      ).toBeInTheDocument();
    });

    const mockResult: ValidateAndProcessAvatarResult = {
      blob: createMockBlob(),
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 512,
    };
    mockValidateAndProcessAvatar.mockResolvedValueOnce(mockResult);

    await user.upload(input, createMockFile());

    await waitFor(() => {
      expect(
        screen.queryByText("Arquivo não é uma imagem válida")
      ).not.toBeInTheDocument();
    });
  });
});
