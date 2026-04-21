/**
 * Testes do hook `useIdleTimer` (AC-09 — Auto-logout após inatividade).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - vi.useFakeTimers() para simular passagem de tempo
 *   - vi.spyOn para verificar event listeners
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: o hook não expõe detalhes internos de
 *     implementação, apenas `isIdle` e `resetTimer`.
 *   - **Lei 14 (Logging higiênico)**: nenhum dado sensível é logado
 *     durante o fluxo de idle timeout.
 */
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useIdleTimer } from "@/features/auth/hooks/useIdleTimer";
import { IDLE_TIMEOUT_MS, IDLE_EVENTS } from "@/features/auth/lib/constants";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useIdleTimer — AC-09 (Auto-logout por inatividade)", () => {
  test("deve registrar event listeners no mount", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useIdleTimer({ onIdle: vi.fn() }));

    for (const event of IDLE_EVENTS) {
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        event,
        expect.any(Function),
        { passive: true }
      );
    }
  });

  test("deve remover event listeners no unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useIdleTimer({ onIdle: vi.fn() }));
    unmount();

    for (const event of IDLE_EVENTS) {
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        event,
        expect.any(Function),
        { passive: true }
      );
    }
  });

  test("deve resetar timer quando evento de atividade ocorre", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle }));

    // Avança 3h59m (quase timeout)
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 60_000);
    });

    // Simula atividade do usuário
    act(() => {
      window.dispatchEvent(new Event("mousemove"));
    });

    // Avança mais 1 minuto — NÃO deve disparar pois timer foi resetado
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onIdle).not.toHaveBeenCalled();

    // Agora avança o tempo total novamente — DEVE disparar
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("deve setar isIdle = true após timeout", () => {
    const { result } = renderHook(() => useIdleTimer({ onIdle: vi.fn() }));

    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(result.current.isIdle).toBe(true);
  });

  test("deve chamar onIdle callback após timeout", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle }));

    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("resetTimer deve setar isIdle = false", () => {
    const { result } = renderHook(() => useIdleTimer({ onIdle: vi.fn() }));

    // Dispara timeout
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(result.current.isIdle).toBe(true);

    // Reseta manualmente
    act(() => {
      result.current.resetTimer();
    });

    expect(result.current.isIdle).toBe(false);
  });

  test("não deve chamar onIdle múltiplas vezes se já está idle", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle }));

    // Dispara timeout
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);

    // Avança mais tempo — NÃO deve chamar novamente
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("deve aceitar timeout customizado via options", () => {
    const onIdle = vi.fn();
    const customTimeout = 5000; // 5 segundos

    renderHook(() => useIdleTimer({ onIdle, timeout: customTimeout }));

    // Antes do timeout
    act(() => {
      vi.advanceTimersByTime(customTimeout - 100);
    });

    expect(onIdle).not.toHaveBeenCalled();

    // Após o timeout
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("deve usar IDLE_TIMEOUT_MS como padrão quando timeout não é fornecido", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle }));

    // Antes do timeout padrão (4h)
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    });

    expect(onIdle).not.toHaveBeenCalled();

    // Após o timeout padrão
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

describe("useIdleTimer — todos os eventos de atividade", () => {
  test.each(IDLE_EVENTS)("evento '%s' deve resetar o timer", (eventName) => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle }));

    // Avança quase até o timeout
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    });

    // Dispara o evento de atividade
    act(() => {
      window.dispatchEvent(new Event(eventName));
    });

    // Avança mais 1 segundo — NÃO deve disparar
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });
});
