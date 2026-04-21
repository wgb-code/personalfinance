/**
 * Testes unitários para InviteCodeDisplay (jsdom)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { InviteCodeDisplay, type InviteCodeDisplayProps } from "../InviteCodeDisplay";

const mockOnRegenerate = vi.fn();

const now = new Date("2026-04-21T10:00:00Z");
const expiresAt = new Date("2026-04-28T10:00:00Z").toISOString();

function renderInviteCodeDisplay(props: Partial<InviteCodeDisplayProps> = {}) {
  const defaultProps: InviteCodeDisplayProps = {
    code: "ABC123",
    expiresAt,
    isOwner: false,
    onRegenerate: mockOnRegenerate,
    isRegenerating: false,
    ...props,
  };

  return render(<InviteCodeDisplay {...defaultProps} />);
}

describe("InviteCodeDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("renderização", () => {
    it("renderiza o título do card", () => {
      renderInviteCodeDisplay();
      expect(screen.getByText("Código de Convite")).toBeInTheDocument();
    });

    it("renderiza o código com formatação correta", () => {
      renderInviteCodeDisplay();
      expect(screen.getByText("ABC123")).toBeInTheDocument();
    });

    it("renderiza a data de expiração formatada", () => {
      renderInviteCodeDisplay();
      expect(screen.getByText(/válido até/i)).toBeInTheDocument();
    });

    it("renderiza expiração relativa", () => {
      renderInviteCodeDisplay();
      expect(screen.getByText(/\(em ~\d+/i)).toBeInTheDocument();
    });
  });

  describe("botão copiar", () => {
    it("renderiza botão de copiar sempre", () => {
      renderInviteCodeDisplay();
      expect(
        screen.getByRole("button", { name: /copiar/i })
      ).toBeInTheDocument();
    });
  });

  describe("botão regenerar", () => {
    it("não mostra botão regenerar quando não é owner", () => {
      renderInviteCodeDisplay({ isOwner: false });
      expect(
        screen.queryByRole("button", { name: /regenerar|novo código/i })
      ).not.toBeInTheDocument();
    });

    it("mostra botão regenerar quando é owner", () => {
      renderInviteCodeDisplay({ isOwner: true });
      expect(
        screen.getByRole("button", { name: /regenerar|novo código/i })
      ).toBeInTheDocument();
    });

    it("não mostra botão regenerar quando onRegenerate não está definido", () => {
      renderInviteCodeDisplay({ isOwner: true, onRegenerate: undefined });
      expect(
        screen.queryByRole("button", { name: /regenerar|novo código/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("acessibilidade", () => {
    it("código tem aria-label descritivo", () => {
      renderInviteCodeDisplay();
      const codeElement = screen.getByLabelText(/código de convite/i);
      expect(codeElement).toBeInTheDocument();
    });
  });
});
