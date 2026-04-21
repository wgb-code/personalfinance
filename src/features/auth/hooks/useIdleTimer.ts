/**
 * `useIdleTimer` — hook para detecção de inatividade do usuário (AC-09).
 *
 * Monitora eventos de atividade (mouse, teclado, scroll, touch, click, focus)
 * e dispara callback `onIdle` após período configurável de inatividade.
 *
 * Fluxo:
 *   1. Registra listeners para todos os eventos em `IDLE_EVENTS`
 *   2. Cada evento reseta o timer interno
 *   3. Quando timeout expira sem atividade, seta `isIdle = true` e chama `onIdle`
 *   4. Cleanup automático no unmount remove todos os listeners
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: hook não expõe detalhes internos,
 *     apenas `isIdle` e `resetTimer`.
 *   - **Lei 14 (Logging higiênico)**: nenhum dado sensível é logado.
 *
 * Uso típico:
 * ```tsx
 * const { isIdle } = useIdleTimer({
 *   onIdle: () => setShowSessionExpiredModal(true),
 * });
 * ```
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { IDLE_TIMEOUT_MS, IDLE_EVENTS } from "@/features/auth/lib/constants";

export interface UseIdleTimerOptions {
  onIdle: () => void;
  timeout?: number;
}

export interface UseIdleTimerReturn {
  isIdle: boolean;
  resetTimer: () => void;
}

export function useIdleTimer(options: UseIdleTimerOptions): UseIdleTimerReturn {
  const { onIdle, timeout = IDLE_TIMEOUT_MS } = options;

  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
        onIdle();
      }
    }, timeout);
  }, [clearTimer, onIdle, timeout]);

  const resetTimer = useCallback(() => {
    isIdleRef.current = false;
    setIsIdle(false);
    startTimer();
  }, [startTimer]);

  const handleActivity = useCallback(() => {
    if (!isIdleRef.current) {
      startTimer();
    }
  }, [startTimer]);

  useEffect(() => {
    startTimer();

    const listenerOptions = { passive: true };

    for (const event of IDLE_EVENTS) {
      window.addEventListener(event, handleActivity, listenerOptions);
    }

    return () => {
      clearTimer();
      for (const event of IDLE_EVENTS) {
        window.removeEventListener(event, handleActivity, listenerOptions);
      }
    };
  }, [startTimer, handleActivity, clearTimer]);

  return { isIdle, resetTimer };
}
