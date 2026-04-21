/**
 * Testes de integração de `useRegister` (AC-01 — Cadastro com dados válidos).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - Mock do módulo `@/lib/supabase` para interceptar `signUp` e `storage.upload`
 *   - QueryClientProvider isolado por teste (sem retry, sem cache leak)
 *   - Mock de `react-router-dom` via `vi.mock`
 *
 * Por que mockar `supabase` diretamente em vez de MSW?
 *   O Supabase SDK usa vários endpoints e headers internos. Mockar os métodos
 *   `signUp` e `storage.from().upload()` é mais robusto e menos acoplado à
 *   implementação interna do SDK.
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 1 (Never trust client)**: input validado via schema antes de signUp.
 *   - **Lei 2 (Mass Assignment)**: apenas `email`, `password` e `full_name` no metadata.
 *   - **Lei 9 (Exposição mínima)**: erros mapeados para pt-BR via `mapAuthError`.
 *   - **Lei 14 (Logging higiênico)**: ZERO console.* nos testes e no hook.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { useRegister } from "@/features/auth/hooks/useRegister";
import { useAuthStore } from "@/stores/useAuthStore";
import type { RegisterInput } from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

const mockNavigate = vi.fn();
const mockSignUp = vi.fn();
const mockStorageUpload = vi.fn();
const mockValidateAndProcessAvatar = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: (params: unknown) => mockSignUp(params),
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: Blob, options?: unknown) =>
          mockStorageUpload(bucket, path, file, options),
      }),
    },
  },
}));

vi.mock("@/features/auth/lib/avatar-validation", () => ({
  validateAndProcessAvatar: (args: { file: File }) =>
    mockValidateAndProcessAvatar(args),
}));

const validInput: RegisterInput = {
  email: "maria@exemplo.com",
  password: "Senha123",
  passwordConfirmation: "Senha123",
  fullName: "Maria Silva",
};

const mockUser = {
  id: "user-123",
  email: "maria@exemplo.com",
  app_metadata: {},
  user_metadata: { full_name: "Maria Silva" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
};

const mockSession = {
  access_token: "fake-access-token",
  refresh_token: "fake-refresh-token",
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: "bearer",
  user: mockUser,
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockSignUp.mockClear();
  mockStorageUpload.mockClear();
  mockValidateAndProcessAvatar.mockClear();
  useAuthStore.getState().reset();

  mockSignUp.mockResolvedValue({
    data: { user: mockUser, session: mockSession },
    error: null,
  });

  mockStorageUpload.mockResolvedValue({
    data: { path: "avatars/user-123.jpg" },
    error: null,
  });

  mockValidateAndProcessAvatar.mockResolvedValue({
    blob: new Blob(["processed-image"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    extension: "jpg",
    sizeBytes: 1024,
  });
});

afterEach(() => {
  useAuthStore.getState().reset();
});

function renderWithProviders<TResult>(callback: () => TResult) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );

  return { ...renderHook(callback, { wrapper }), queryClient: testQueryClient };
}

describe("useRegister — AC-01 (Cadastro com dados válidos)", () => {
  test("deve chamar signUp com email, password e full_name no metadata", async () => {
    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "maria@exemplo.com",
      password: "Senha123",
      options: {
        data: { full_name: "Maria Silva" },
      },
    });
  });

  test("deve fazer upload do avatar após signUp bem-sucedido", async () => {
    const mockFile = new File(["fake-image-content"], "avatar.jpg", {
      type: "image/jpeg",
    });

    const inputWithAvatar: RegisterInput = {
      ...validInput,
      avatar: mockFile,
    };

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(inputWithAvatar);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "avatars",
      expect.stringMatching(/^user-123\/.+\.jpg$/),
      expect.any(Blob),
      { contentType: "image/jpeg", upsert: true }
    );
  });

  test("deve navegar para /onboarding após sucesso", async () => {
    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });

  test("deve retornar isPending durante mutation", async () => {
    mockSignUp.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { user: mockUser, session: mockSession },
                error: null,
              }),
            100
          )
        )
    );

    const { result } = renderWithProviders(() => useRegister());

    act(() => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  test("deve retornar error quando signUp falha", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED
    );
  });

  test("não deve fazer upload de avatar se não fornecido", async () => {
    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe("useRegister — sincronização de estado", () => {
  test("deve popular useAuthStore.session após sucesso", async () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().session).toBe(mockSession);
    expect(useAuthStore.getState().user).toBe(mockUser);
  });
});

describe("useRegister — validação defensiva (Lei 1)", () => {
  test("deve rejeitar input inválido sem chamar signUp", async () => {
    const invalidInput = {
      email: "invalido",
      password: "123",
      passwordConfirmation: "456",
      fullName: "",
    } as RegisterInput;

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(invalidInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(result.current.error?.message).toBe(AUTH_MESSAGES.UNEXPECTED_ERROR);
  });
});

describe("useRegister — mapeamento de erros (Lei 9)", () => {
  test("deve mapear rate limit para mensagem pt-BR", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Rate limit exceeded", status: 429 },
    });

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.RATE_LIMITED);
  });

  test("deve mapear erro de rede para mensagem pt-BR", async () => {
    mockSignUp.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderWithProviders(() => useRegister());

    await act(async () => {
      result.current.mutate(validInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.NETWORK_ERROR);
  });
});
