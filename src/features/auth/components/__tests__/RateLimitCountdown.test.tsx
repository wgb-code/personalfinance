/**
 * Testes do componente `RateLimitCountdown` (AC-07 — Login bloqueado após múltiplas tentativas).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - vi.useFakeTimers para controle do tempo
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: countdown não exibe detalhes técnicos,
 *     apenas tempo restante user-friendly em pt-BR.
 *   - **Lei 10 (Output sanitization)**: nenhum dangerouslySetInnerHTML.
 */
import { render, screen, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { RateLimitCountdown } from "@/features/auth/components/RateLimitCountdown";

describe("RateLimitCountdown — AC-07 (Login bloqueado após múltiplas tentativas)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test("deve exibir contador regressivo com segundos restantes", async () => {
    render(<RateLimitCountdown seconds={60} onExpire={vi.fn()} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/60/)).toBeInTheDocument();
      expect(screen.getByText(/segundos/i)).toBeInTheDocument();
    });
  });

  test("deve atualizar a cada segundo", () => {
    render(<RateLimitCountdown seconds={60} onExpire={vi.fn()} />);

    expect(screen.getByText(/60/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/59/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/58/)).toBeInTheDocument();
  });

  test("deve chamar onExpire quando chegar a 0", () => {
    const onExpire = vi.fn();
    render(<RateLimitCountdown seconds={3} onExpire={onExpire} />);

    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test("deve parar quando unmount", () => {
    const onExpire = vi.fn();
    const { unmount } = render(
      <RateLimitCountdown seconds={60} onExpire={onExpire} />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onExpire).not.toHaveBeenCalled();
  });

  test("deve exibir mensagem pt-BR sobre aguardar", async () => {
    render(<RateLimitCountdown seconds={30} onExpire={vi.fn()} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/aguarde/i)).toBeInTheDocument();
    });
  });

  test("deve ter role de status para acessibilidade", async () => {
    render(<RateLimitCountdown seconds={60} onExpire={vi.fn()} />);

    await vi.waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  test("deve ter aria-live para anunciar atualizações", async () => {
    render(<RateLimitCountdown seconds={60} onExpire={vi.fn()} />);

    await vi.waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });
  });

  test("deve usar plural corretamente (1 segundo vs N segundos)", async () => {
    render(<RateLimitCountdown seconds={2} onExpire={vi.fn()} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/2 segundos/i)).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/1 segundo[^s]/i)).toBeInTheDocument();
    });
  });
});
