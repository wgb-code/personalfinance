/**
 * Modal de sessão expirada por inatividade (AC-09).
 *
 * Exibido quando o `useIdleTimer` detecta inatividade prolongada.
 * Ao clicar em "OK", o componente pai deve chamar `useLogout().logout()`.
 *
 * Acessibilidade:
 *   - role="dialog" + aria-modal="true" para leitores de tela
 *   - aria-labelledby aponta para o título
 *   - Botão OK é o único foco interativo
 *
 * Defesas de segurança:
 *   - **Lei 9 (Exposição mínima)**: mensagem genérica, sem detalhes técnicos.
 */
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { cn } from "@/lib/utils";

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionExpiredModal({
  isOpen,
  onClose,
}: SessionExpiredModalProps) {
  const titleId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        data-testid="modal-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "animate-in fade-in-0"
        )}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border border-border bg-background p-6 shadow-lg",
          "animate-in fade-in-0 zoom-in-95"
        )}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold text-foreground"
        >
          {AUTH_MESSAGES.SESSION_EXPIRED_TITLE}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {AUTH_MESSAGES.SESSION_EXPIRED_MESSAGE}
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>{AUTH_MESSAGES.SESSION_EXPIRED_BUTTON}</Button>
        </div>
      </div>
    </>
  );
}
