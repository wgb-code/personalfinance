import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { useAuthStore } from "../useAuthStore";

const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as User;

const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: mockUser,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

describe("useAuthStore", () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.reset();
    });
  });

  describe("estado inicial", () => {
    it("deve ter sessão nula e isInitializing true no boot", () => {
      useAuthStore.setState({
        session: null,
        user: null,
        householdId: null,
        isAuthenticated: false,
        isInitializing: true,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.householdId).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isInitializing).toBe(true);
    });
  });

  describe("setSession", () => {
    it("deve popular sessão, user e isAuthenticated quando recebe sessão válida", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isInitializing).toBe(false);
    });

    it("deve limpar sessão quando recebe null", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
      });

      act(() => {
        result.current.setSession(null);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isInitializing).toBe(false);
    });
  });

  describe("reset", () => {
    it("deve limpar toda a sessão e marcar init como concluído", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.householdId).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isInitializing).toBe(false);
    });
  });

  describe("setHouseholdId", () => {
    it("deve atualizar apenas householdId quando chamado com UUID válido", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
        result.current.setHouseholdId("123e4567-e89b-12d3-a456-426614174000");
      });

      expect(result.current.householdId).toBe(
        "123e4567-e89b-12d3-a456-426614174000"
      );
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("deve limpar apenas householdId quando chamado com null", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
        result.current.setHouseholdId("some-uuid");
      });

      act(() => {
        result.current.setHouseholdId(null);
      });

      expect(result.current.householdId).toBeNull();
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("deve ser limpo quando reset() é chamado", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession(mockSession);
        result.current.setHouseholdId("some-uuid");
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.householdId).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
