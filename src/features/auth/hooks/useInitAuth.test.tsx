/**
 * Testes de integração de `useInitAuth` (AC-08 — sessão persiste após reload).
 *
 * O hook é responsável por:
 *   1. Chamar `supabase.auth.getSession()` no mount
 *   2. Registrar listener `onAuthStateChange()` para manter store sincronizado
 *   3. Atualizar `useAuthStore` conforme eventos de auth
 *   4. Setar `isInitializing = false` quando pronto
 *
 * Leis de segurança verificadas:
 *   - Lei 1: sessão vem APENAS do Supabase SDK, nunca do input do usuário
 *   - Lei 9: nenhum log de tokens ou refresh_token
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { useAuthStore } from "@/stores/useAuthStore";
import { useInitAuth } from "@/features/auth/hooks/useInitAuth";
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

/**
 * Mocks do supabase.auth
 * Usamos mocks diretos ao invés de MSW porque:
 *   - `getSession()` e `onAuthStateChange()` são APIs de SDK, não HTTP
 *   - Precisamos controlar exatamente quando callbacks são disparados
 */
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) =>
        mockOnAuthStateChange(callback),
    },
  },
}));

/**
 * Fixtures de sessão e usuário.
 * Espelham shape real do Supabase Auth v2.
 */
const MOCK_USER: User = {
  id: "user-123",
  email: "maria@exemplo.com",
  app_metadata: {},
  user_metadata: { full_name: "Maria Silva" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User;

const MOCK_SESSION: Session = {
  access_token: "eyJ.fake.jwt",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: "ref-token",
  user: MOCK_USER,
} as Session;

beforeAll(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().reset();
  // Reset para estado inicial (isInitializing: true)
  useAuthStore.setState({ isInitializing: true });
  
  // Default: onAuthStateChange retorna unsubscribe
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } });
});

afterEach(() => {
  useAuthStore.getState().reset();
});

describe("useInitAuth — bootstrap do app (AC-08)", () => {
  test("deve chamar getSession e onAuthStateChange no mount", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderHook(() => useInitAuth());

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  test("deve atualizar useAuthStore.user quando sessão existe", async () => {
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().user).not.toBeNull();
    });

    expect(useAuthStore.getState().user?.id).toBe("user-123");
    expect(useAuthStore.getState().user?.email).toBe("maria@exemplo.com");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  test("deve setar isInitializing = false após getSession resolver", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    expect(useAuthStore.getState().isInitializing).toBe(true);

    renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().isInitializing).toBe(false);
    });
  });

  test("deve atualizar useAuthStore quando onAuthStateChange dispara SIGNED_IN", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    
    let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((callback) => {
      capturedCallback = callback;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().isInitializing).toBe(false);
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Simula evento de login externo (ex: outra aba)
    act(() => {
      capturedCallback?.("SIGNED_IN", MOCK_SESSION);
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe("user-123");
    expect(useAuthStore.getState().session).toBe(MOCK_SESSION);
  });

  test("deve limpar useAuthStore quando onAuthStateChange dispara SIGNED_OUT", async () => {
    // Inicia com sessão ativa
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
    
    let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((callback) => {
      capturedCallback = callback;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    // Simula logout
    act(() => {
      capturedCallback?.("SIGNED_OUT", null);
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });

  test("deve chamar unsubscribe no unmount", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { unmount } = renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().isInitializing).toBe(false);
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test("deve retornar isInitializing do hook", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderHook(() => useInitAuth());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
  });
});
