/**
 * Testes unitários para MembersList (jsdom)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MembersList, type MembersListProps } from "../MembersList";

const mockMembers = [
  {
    id: "m-1",
    fullName: "João Silva",
    userId: "u-1",
    role: "owner" as const,
    joinedAt: "2026-01-15T10:00:00Z",
    leftAt: null,
    isActive: true,
    avatarUrl: null,
  },
  {
    id: "m-2",
    fullName: "Maria Santos",
    userId: "u-2",
    role: "member" as const,
    joinedAt: "2026-02-20T15:30:00Z",
    leftAt: null,
    isActive: true,
    avatarUrl: null,
  },
  {
    id: "m-3",
    fullName: "Pedro Costa",
    userId: "u-3",
    role: "member" as const,
    joinedAt: "2026-03-10T09:00:00Z",
    leftAt: "2026-03-20T12:00:00Z",
    isActive: false,
    avatarUrl: null,
  },
];

const mockOnRemoveMember = vi.fn();

function renderMembersList(props: Partial<MembersListProps> = {}) {
  const defaultProps: MembersListProps = {
    members: mockMembers,
    currentUserId: "u-1",
    isCurrentUserOwner: true,
    onRemoveMember: mockOnRemoveMember,
    isRemoving: false,
    ...props,
  };

  return render(<MembersList {...defaultProps} />);
}

describe("MembersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("renderização", () => {
    it("renderiza o título do card", () => {
      renderMembersList();
      expect(screen.getByText("Membros do Household")).toBeInTheDocument();
    });

    it("renderiza os cabeçalhos da tabela", () => {
      renderMembersList();
      expect(screen.getByText("Nome")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Desde")).toBeInTheDocument();
      expect(screen.getByText("Ações")).toBeInTheDocument();
    });

    it("renderiza todos os membros", () => {
      renderMembersList();
      expect(screen.getByText("João Silva")).toBeInTheDocument();
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
      expect(screen.getByText("Pedro Costa")).toBeInTheDocument();
    });

    it("renderiza badges de role corretamente", () => {
      renderMembersList();
      expect(screen.getByText("Owner")).toBeInTheDocument();
      expect(screen.getAllByText("Member")).toHaveLength(2);
    });

    it("renderiza badges de status corretamente", () => {
      renderMembersList();
      expect(screen.getAllByText("Ativo")).toHaveLength(2);
      expect(screen.getByText("Inativo")).toBeInTheDocument();
    });
  });

  describe("botão Remover", () => {
    it("mostra botão Remover apenas para members ativos quando é owner", () => {
      renderMembersList();
      const removeButtons = screen.getAllByRole("button", { name: /remover/i });
      expect(removeButtons).toHaveLength(1);
    });

    it("não mostra botão Remover para members inativos", () => {
      renderMembersList({
        members: [mockMembers[2]],
      });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("não mostra botão Remover quando não é owner", () => {
      renderMembersList({ isCurrentUserOwner: false });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });

    it("não mostra botão Remover para o próprio owner", () => {
      renderMembersList({
        members: [mockMembers[0]],
      });
      expect(
        screen.queryByRole("button", { name: /remover/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("modal de confirmação", () => {
    it("abre modal ao clicar em Remover", async () => {
      const user = userEvent.setup();
      renderMembersList();

      await user.click(screen.getByRole("button", { name: /remover/i }));

      await waitFor(() => {
        expect(screen.getByText("Remover membro?")).toBeInTheDocument();
      });
    });

    it("mostra nome do membro no modal", async () => {
      const user = userEvent.setup();
      renderMembersList();

      await user.click(screen.getByRole("button", { name: /remover/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/maria santos perderá acesso/i)
        ).toBeInTheDocument();
      });
    });

    it("chama onRemoveMember ao confirmar", async () => {
      mockOnRemoveMember.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderMembersList();

      await user.click(screen.getByRole("button", { name: /remover/i }));
      
      await waitFor(() => {
        expect(screen.getByText("Remover membro?")).toBeInTheDocument();
      });

      const confirmButton = screen.getAllByRole("button", { name: /^remover$/i });
      await user.click(confirmButton[confirmButton.length - 1]);

      await waitFor(() => {
        expect(mockOnRemoveMember).toHaveBeenCalledWith(mockMembers[1]);
      });
    });

    it("fecha modal ao cancelar", async () => {
      const user = userEvent.setup();
      renderMembersList();

      await user.click(screen.getByRole("button", { name: /remover/i }));
      
      await waitFor(() => {
        expect(screen.getByText("Remover membro?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /cancelar/i }));

      await waitFor(() => {
        expect(
          screen.queryByText("Remover membro?")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("estado de loading", () => {
    it("desabilita botões durante isRemoving", async () => {
      const user = userEvent.setup();
      renderMembersList({ isRemoving: true });

      await user.click(screen.getByRole("button", { name: /remover/i }));
      
      await waitFor(() => {
        expect(screen.getByText("Remover membro?")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancelar/i });
      expect(cancelButton).toBeDisabled();
    });
  });
});
