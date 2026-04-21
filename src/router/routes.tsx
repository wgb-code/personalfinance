/* eslint-disable react-refresh/only-export-components --
 * Este arquivo intencionalmente exporta `appRouter` (não-componente)
 * convivendo com componentes de placeholder co-localizados. A perda
 * de Fast Refresh é aceitável porque os placeholders são triviais e
 * serão substituídos por componentes reais (em arquivos próprios) à
 * medida que cada AC do módulo 01 for entregue.
 */
/**
 * Configuração centralizada de rotas — destrava AC-13 e serve de
 * andaime para os ACs subsequentes do módulo 01.
 *
 * Por que `createBrowserRouter` (data router API) em vez do
 * `<BrowserRouter>` clássico?
 *   - Permite definir rotas como dado (mais simples de testar).
 *   - Habilita futuros `loader`/`action` quando precisarmos pré-carregar
 *     dados do household sem flicker (AC-04 e adiante).
 *
 * Rotas atuais são SHELLS — placeholders de uma linha. Cada AC futuro
 * substitui o `element` correspondente pelo componente real. Manter
 * todas as rotas declaradas desde já evita NPM hell de "rota nova ⇒
 * mexer em 3 arquivos" e dá ao `<ProtectedRoute />` algo concreto para
 * encapsular nos testes/E2E.
 */
import { createBrowserRouter } from "react-router-dom";

import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";

function HomePlaceholder() {
  // TODO(AC-04): redirecionar para /dashboard ou /onboarding com base
  // em useAuthStore.householdId.
  return (
    <main>
      <h1>Início</h1>
    </main>
  );
}

function DashboardPlaceholder() {
  // TODO(modulo 10): substituir por <DashboardPage /> real.
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}

function OnboardingPlaceholder() {
  // TODO(modulo 02): substituir por <OnboardingFlow /> real.
  return (
    <main>
      <h1>Onboarding</h1>
    </main>
  );
}

function BillsListPlaceholder() {
  // TODO(modulo 04): substituir por <BillsListPage /> real.
  return (
    <main>
      <h1>Contas fixas</h1>
    </main>
  );
}

function BillDetailPlaceholder() {
  // TODO(modulo 04): substituir por <BillDetailPage /> real.
  return (
    <main>
      <h1>Detalhe da conta</h1>
    </main>
  );
}

function NotFoundPlaceholder() {
  return (
    <main>
      <h1>Página não encontrada</h1>
    </main>
  );
}

export const appRouter = createBrowserRouter([
  {
    element: <AuthBootstrap />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/", element: <HomePlaceholder /> },
          { path: "/dashboard", element: <DashboardPlaceholder /> },
          { path: "/onboarding", element: <OnboardingPlaceholder /> },
          { path: "/bills", element: <BillsListPlaceholder /> },
          { path: "/bills/:id", element: <BillDetailPlaceholder /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPlaceholder /> },
]);
