/**
 * Testes unitários para MemberRow (jsdom)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MemberRow, type MemberRowProps, type MemberRowMember } from "../MemberRow";

const baseMember: MemberRowMember = {
  id: "m-1",
  fullName: "João Silva",
  userId: "u-1",
  role: "member",
  joinedAt: "2026-01-15T10:00:00Z",
  leftAt: null,
  isActive: true,
  avatarUrl: null,
};

const mockOnRemove = vi.fn();

function renderMemberRow(props: Partial<MemberRowProps> = {}) {
  const defaultProps: MemberRowProps = {
    member: baseMember,
    currentUserId: "u-owner",
    isCurrentUserOwner: true,
    onRemove: mockOnRemove,
    ...props,
  };

  return render(
    <table>
      <tbody>
        <MemberRow {...defaultProps} />
      </tbody>
    </table>
  );
}

describe("MemberRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("renderização básica", () => {
    it("renderiza o nome do membro", () => {
      renderMemberRow();
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    it("renderiza iniciais no avatar fallback", () => {
      renderMemberRow();
      expect(screen.getByText("JS")).toBeInTheDocument();
    });

    it("renderiza badge de role Member", () => {
      renderMemberRow();
      expect(screen.getByText("Member")).toBeInTheDocument();
    });

    it("renderiza badge de status Ativo", () => {
      renderMemberRow();
      expect(screen.getByText("Ativo")).toBeInTheDocument();
    });
  });

  describe("getInitials", () => {
    it("retorna iniciais para nome composto", () => {
      renderMemberRow({ member: { ...baseMember, fullName: "Maria Santos" } });
      expect(screen.getByText("MS")).toBeInTheDocument();
    });

    it("retorna primeiras 2 letras para nome único", () => {
      renderMemberRow({ member: { ...baseMember, fullName: "Admin" } });
      expect(screen.getByText("AD")).toBeInTheDocument();
    });

    it("lida com múltiplos nomes", () => {
      renderMemberRow({
        member: { ...baseMember, fullName: "João Pedro Santos" },
      });
      expect(screen.getByText("JS")).toBeInTheDocument();
    });
  });

  describe("role badge", () => {
    it("mostra Owner para role owner", () => {
      renderMemberRow({ member: { ...baseMember, role: "owner" } });
      expect(screen.getByText("Owner")).toBeInTheDocument();
    });

    it("mostra Member para role member", () => {
      renderMemberRow({ member: { ...baseMember, role: "member" } });
      expect(screen.getByText("Member")).toBeInTheDocument();
    });
  });

  describe("status badge", () => {
    it("mostra Ativo quando isActive é true", () => {
      renderMemberRow({ member: { ...baseMember, isActive: true } });
      expect(screen.getByText("Ativo")).toBeInTheDocument();
    });

    it("mostra Inativo quando isActive é false", () => {
      renderMemberRow({ member: { ...baseMember, isActive: false } });
      expect(screen.getByText("Inativo")).toBeInTheDocument();
    });

    it("deriva status de leftAt quando isActive não definido", () => {
      const memberWithoutIsActive = { ...baseMember };
      delete (memberWithoutIsActive as Record<string, unknown>).isActive;
      renderMemberRow({
        member: {
          ...memberWithoutIsActive,
          leftAt: "2026-03-20T12:00:00Z",
        } as MemberRowMember,
      });
      expect(screen.getByText("Inativo")).toBeInTheDocument();
    });
  });

  describe("botão Remover", () => {
    it("mostra botão quando owner visualiza member ativo", () => {
      renderMemberRow({
        isCurrentUserOwner: true,
        member: { ...baseMember, role: "member", isActive: true },
      });
      expect(
        screen.getByRole("button", { name: /remover/i })
      ).toBeInTheDocument();
    });

    it("não mostra botão quando não é owner", () => {
      renderMemberRow({ isCurrentUserOwner: false });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("não mostra botão para member inativo", () => {
      renderMemberRow({ member: { ...baseMember, isActive: false } });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("não mostra botão para o próprio owner", () => {
      renderMemberRow({
        member: { ...baseMember, role: "owner" },
      });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("não mostra botão para si mesmo", () => {
      renderMemberRow({
        currentUserId: "u-1",
        member: { ...baseMember, userId: "u-1" },
      });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("chama onRemove ao clicar", async () => {
      const user = userEvent.setup();
      renderMemberRow();

      await user.click(screen.getByRole("button", { name: /remover/i }));

      expect(mockOnRemove).toHaveBeenCalledWith(baseMember);
    });
  });

  describe("avatar", () => {
    it("renderiza avatar com fallback quando avatarUrl não carrega", () => {
      renderMemberRow({
        member: { ...baseMember, avatarUrl: "https://example.com/avatar.jpg" },
      });
      const avatarFallback = screen.getByText("JS");
      expect(avatarFallback).toBeInTheDocument();
    });
  });
});
