/**
 * Feature: Household
 *
 * Hooks e componentes para gerenciamento de household (módulo 02).
 */

// Components
export { InviteCodeDisplay } from "./components/InviteCodeDisplay";
export type { InviteCodeDisplayProps } from "./components/InviteCodeDisplay";

export { CopyCodeButton } from "./components/CopyCodeButton";
export type { CopyCodeButtonProps } from "./components/CopyCodeButton";

export { RegenerateCodeButton } from "./components/RegenerateCodeButton";
export type { RegenerateCodeButtonProps } from "./components/RegenerateCodeButton";

export { MembersList } from "./components/MembersList";
export type { MembersListProps } from "./components/MembersList";

export { MemberRow } from "./components/MemberRow";
export type { MemberRowProps, MemberRowMember } from "./components/MemberRow";

export { LeaveHouseholdButton } from "./components/LeaveHouseholdButton";
export type { LeaveHouseholdButtonProps } from "./components/LeaveHouseholdButton";

export { AuditHistory } from "./components/AuditHistory";
export type { AuditHistoryProps } from "./components/AuditHistory";

export { AuditRow } from "./components/AuditRow";
export type { AuditRowProps } from "./components/AuditRow";

// Hooks
export { useCurrentHousehold } from "./hooks/useCurrentHousehold";
export type { CurrentHouseholdResponse } from "./hooks/useCurrentHousehold";

export { useHouseholdMembers } from "./hooks/useHouseholdMembers";
export type { HouseholdMember } from "./hooks/useHouseholdMembers";

export { useRegenerateInviteCode } from "./hooks/useRegenerateInviteCode";
export type { RegenerateInviteCodeResponse } from "./hooks/useRegenerateInviteCode";

export { useLeaveHousehold } from "./hooks/useLeaveHousehold";

export { useRemoveMember } from "./hooks/useRemoveMember";
export type { RemoveMemberInput } from "./hooks/useRemoveMember";

export { useHouseholdAudit } from "./hooks/useHouseholdAudit";
export type { AuditEntry } from "./hooks/useHouseholdAudit";

// Lib
export {
  clearHouseholdQueries,
  invalidateHouseholdMemberQueries,
} from "./lib/query-helpers";

export { mapHouseholdError } from "./lib/household-errors";

export { HOUSEHOLD_MESSAGES } from "./lib/household-constants";

export {
  formatShortDate,
  formatFullDate,
  formatRelativeExpiry,
  formatDateOnly,
  formatJoinedDate,
} from "./lib/date-format";

export { formatAuditDescription } from "./lib/audit-utils";
export type { AuditAction } from "./lib/audit-utils";
