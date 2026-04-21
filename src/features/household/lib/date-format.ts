/**
 * Utilitários de formatação de datas para household (RN-34.1).
 *
 * Todas as datas são armazenadas em UTC (timestamptz) e exibidas
 * em timezone local do navegador usando `Intl.DateTimeFormat('pt-BR', ...)`.
 */

const LOCALE = "pt-BR";
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}

/**
 * Formata data no padrão curto: "dd/MM às HH:mm".
 * Omite ano quando o evento ocorreu no ano corrente.
 *
 * @example formatShortDate('2026-04-15T14:30:00Z') // "15/04 às 14:30"
 */
export function formatShortDate(dateString: string): string {
  const date = toDate(dateString);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TIMEZONE,
  });

  const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });

  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

/**
 * Formata data completa: "dd/MM/yyyy às HH:mm".
 *
 * @example formatFullDate('2026-04-15T14:30:00Z') // "15/04/2026 às 14:30"
 */
export function formatFullDate(dateString: string): string {
  const date = toDate(dateString);

  const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIMEZONE,
  });

  const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });

  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

/**
 * Formata expiração relativa: "(em ~Xh)" ou "(em ~Xmin)".
 *
 * @example formatRelativeExpiry('2026-04-23T14:30:00Z') // "(em ~47h)"
 */
export function formatRelativeExpiry(dateString: string): string {
  const date = toDate(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "(expirado)";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours >= 1) {
    return `(em ~${diffHours}h)`;
  }

  return `(em ~${diffMinutes}min)`;
}

/**
 * Formata apenas a data curta sem hora: "dd/MM/yyyy".
 *
 * @example formatDateOnly('2026-04-15T14:30:00Z') // "15/04/2026"
 */
export function formatDateOnly(dateString: string): string {
  const date = toDate(dateString);

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
}

/**
 * Formata data para exibição em "Desde dd/MM/yyyy".
 * Alias para formatDateOnly para compatibilidade.
 */
export function formatJoinedDate(dateString: string): string {
  return formatDateOnly(dateString);
}
