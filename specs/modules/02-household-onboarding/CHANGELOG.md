# Changelog — 02-household-onboarding

**Período**: 2026-04-21 (1 dia)
**Branch**: feat/02-household-onboarding
**Scorecard**: A

## Entregue

### Critérios de Aceite (28 ACs)
- AC-01/02: Criar household com validação de nome
- AC-03/04/05: Invite code (geração CSPRNG, regeneração, expiração 48h)
- AC-06/07/08: Join via código (válido, inválido, já em household)
- AC-09: Skip onboarding (household "Meu Lar")
- AC-10: Lista de membros com roles e status
- AC-11/12: Leave/Remove com soft delete
- AC-13/14: Store integration + redirect correto
- AC-15/16/17: Audit trail (join, leave, remove)
- AC-18/19: Visualização de audit (owner only)
- AC-20/21: Re-entry preservando histórico
- AC-22: Join concorrente no mesmo código
- AC-23/24: Rate-limit 5/min com reset
- AC-25/26: Owner delete (bloqueio e cascade)
- AC-27: Clipboard copy com fallback
- AC-28: Compat com usuários do módulo 01

### Componentes UI (14)
- OnboardingPage, CreateHouseholdForm, JoinHouseholdForm
- InviteCodeDisplay, CopyCodeButton, RegenerateCodeButton
- MembersList, MemberRow, LeaveHouseholdButton
- AuditHistory, AuditRow

### Hooks (12)
- useCreateHousehold, useJoinHousehold, useSkipOnboarding
- useCurrentHousehold, useHouseholdMembers
- useRegenerateInviteCode, useLeaveHousehold, useRemoveMember
- useHouseholdAudit

### Migrations
- `20260421000001_households_and_members.sql` (757 linhas)
  - Tabelas: households, household_members, household_member_audit, join_rate_limits
  - RPCs: create_household, join_household, regenerate_invite_code, leave_household, remove_member, get_current_household
  - Helper: get_user_household_id() para RLS de módulos futuros
- `20260421000002_fix_pgcrypto.sql` (48 linhas)
  - Fix para extensions.gen_random_bytes() em produção

### Testes
- 530 testes unitários (196 novos neste módulo)
- 5 E2E specs (create, join, skip, invalid-code, already-in-household)

## Cobertura
- Statements 77.12% | Branches 70.17% | Functions 66.15% | Lines 77.04%
- Módulos específicos (onboarding + household): >85%

## Decisões Importantes

1. **Fonte de verdade do householdId**: `household_members` com índice parcial único, não `user_profiles` (sem denormalização)
2. **Audit trail imutável**: INSERTs apenas via RPCs SECURITY DEFINER
3. **CSPRNG para invite code**: `extensions.gen_random_bytes()` em vez de `random()`
4. **Setter controlado**: `setHouseholdId()` no store, nunca `setState` direto
5. **Lei 9 aplicada**: Código inválido vs expirado = mesma mensagem

## Postergado para Módulos Futuros
- Transferência de ownership → módulo futuro
- Convite por email → módulo de notificações
- Rate-limit por IP → módulo de segurança avançada
- Edição do nome do household → módulo 14 (settings)
