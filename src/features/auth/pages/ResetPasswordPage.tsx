import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

/**
 * `<ResetPasswordPage />` — shell de página para `/reset-password` (AC-12).
 *
 * Decisões de layout:
 *
 * 1. **Por que `fixed inset-0`?**
 *    O CSS legado em `src/index.css` define `#root { width: 1126px; ... }`
 *    com `border-inline: 1px solid var(--border)` — ótimo para landing
 *    pages do template Vite, terrível para uma tela de auth que precisa
 *    ser full-bleed centralizada. Usar `fixed inset-0` posiciona o
 *    container relativo ao viewport, "escapando" o constraint do `#root`
 *    sem precisar mexer em CSS global (o que afetaria outras telas).
 *    `overflow-y-auto` garante que o card seja scrollável em viewports
 *    muito baixos (ex.: zoom 200% por usuários com baixa visão — WCAG 1.4.4).
 *
 * 2. **Por que `<title>` declarativo do React 19?**
 *    React 19 promove tags de metadata para o `<head>` automaticamente.
 *    Isso evita o `useEffect` clássico (que causa flash do título antigo
 *    no histórico) e mantém o componente síncrono — bom para SSR futuro
 *    e melhor para screen readers (anunciam o título da página ao navegar).
 *
 * 3. **Tom visual** (.impeccable.md — "Calm. Clear. Honest."):
 *    - Background liso `bg-background` (sem gradientes neon).
 *    - Espaçamento generoso (`p-6 sm:p-10`).
 *    - Light mode default (sem classe `dark` aqui).
 *    - O único "toque de cor" é o token `text-primary` no wordmark
 *      sutil acima do card — opcional, mas dá identidade sem agressão.
 */
export function ResetPasswordPage() {
  return (
    <>
      <title>{AUTH_MESSAGES.RESET_PASSWORD_PAGE_TITLE}</title>
      <main
        className="fixed inset-0 grid place-items-center overflow-y-auto bg-background p-6 sm:p-10"
        aria-labelledby="reset-password-heading"
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <p
            id="reset-password-heading"
            className="text-primary text-base font-medium tracking-tight"
          >
            Organizador Financeiro
          </p>
          <ResetPasswordForm />
        </div>
      </main>
    </>
  );
}
