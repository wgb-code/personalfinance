/**
 * `<OnboardingPage />` — página de onboarding com 3 estados (AC-08).
 *
 * Estados:
 *   1. **choice** (default): exibe as 3 opções (criar, entrar, pular).
 *   2. **create**: exibe `CreateHouseholdForm` com botão "Voltar".
 *   3. **join**: exibe `JoinHouseholdForm` com botão "Voltar".
 *
 * Redirect:
 *   - Se `householdId` presente no store, redireciona para `/dashboard`.
 *   - Se `isLoading` (query ainda resolvendo), exibe loading.
 *
 * A11y:
 *   - Cards clicáveis são buttons (não divs com onClick).
 *   - Loading state com `aria-busy="true"` e `role="status"`.
 *   - Navegável 100% por teclado.
 *
 * .impeccable.md:
 *   - Card centralizado, max-width 500px.
 *   - Tokens semânticos, sem gradientes, sem `text-red-*` cru.
 *   - Light mode default.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Home, KeyRound, ChevronRight, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrentHousehold } from "@/features/household/hooks/useCurrentHousehold";
import { useSkipOnboarding } from "@/features/onboarding/hooks/useSkipOnboarding";
import { CreateHouseholdForm } from "./CreateHouseholdForm";
import { JoinHouseholdForm } from "./JoinHouseholdForm";

type OnboardingView = "choice" | "create" | "join";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<OnboardingView>("choice");

  const householdId = useAuthStore((s) => s.householdId);
  const { isLoading } = useCurrentHousehold();
  const { mutate: skip, isPending: isSkipping } = useSkipOnboarding();

  const handleSkip = () => {
    skip({
      onSuccess: () => {
        navigate("/dashboard", { replace: true });
      },
    });
  };

  const handleSuccess = () => {
    navigate("/dashboard", { replace: true });
  };

  if (householdId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center"
      >
        <Loader2 className="size-8 text-muted-foreground motion-safe:animate-spin" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-[500px]">
        <CardHeader>
          <CardTitle>Bem-vindo ao seu controle financeiro</CardTitle>
          <CardDescription>
            {view === "choice"
              ? "Como você gostaria de começar?"
              : view === "create"
              ? "Configure seu household"
              : "Entre em um household existente"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {view === "choice" ? (
            <div className="flex flex-col gap-4">
              <OptionButton
                icon={<Home aria-hidden="true" />}
                title="Criar meu household"
                description="Comece um novo lar para organizar suas finanças"
                onClick={() => setView("create")}
              />

              <OptionButton
                icon={<KeyRound aria-hidden="true" />}
                title="Tenho um código"
                description="Entre em um household existente com um código de convite"
                onClick={() => setView("join")}
              />

              <div className="pt-2 text-center">
                <Button
                  variant="link"
                  onClick={handleSkip}
                  disabled={isSkipping}
                  aria-busy={isSkipping}
                  className="text-muted-foreground"
                >
                  {isSkipping ? (
                    <>
                      <Loader2
                        aria-hidden="true"
                        className="motion-safe:animate-spin"
                      />
                      Configurando...
                    </>
                  ) : (
                    "Pular por enquanto"
                  )}
                </Button>
              </div>
            </div>
          ) : view === "create" ? (
            <CreateHouseholdForm
              onBack={() => setView("choice")}
              onSuccess={handleSuccess}
            />
          ) : (
            <JoinHouseholdForm
              onBack={() => setView("choice")}
              onSuccess={handleSuccess}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

interface OptionButtonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function OptionButton({ icon, title, description, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background">
        {icon}
      </div>
      <div className="flex-1">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="size-5 text-muted-foreground"
      />
    </button>
  );
}
