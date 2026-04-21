import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

interface RateLimitCountdownProps {
  /** Segundos iniciais do countdown */
  seconds: number;
  /** Callback chamado quando o countdown chega a 0 */
  onExpire: () => void;
}

/**
 * `<RateLimitCountdown />` — exibe countdown regressivo para rate limit (AC-07).
 *
 * Usado no `LoginForm` quando o Supabase retorna 429. O botão "Entrar"
 * fica desabilitado enquanto o countdown está ativo. Após expirar, chama
 * `onExpire` para que o form volte ao estado normal.
 *
 * Princípios respeitados:
 *   - Lei 9 (Exposição mínima): mostra apenas tempo restante, sem detalhes técnicos.
 *   - Lei 10 (Output sanitization): nenhum dangerouslySetInnerHTML.
 *   - a11y: role="status" + aria-live="polite" para screen readers.
 */
export function RateLimitCountdown({
  seconds,
  onExpire,
}: RateLimitCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpireRef.current();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [remaining]);

  const plural = remaining === 1 ? "segundo" : "segundos";

  return (
    <Alert variant="destructive" role="status" aria-live="polite">
      <Clock aria-hidden="true" />
      <AlertDescription>
        Aguarde {remaining} {plural} para tentar novamente.
      </AlertDescription>
    </Alert>
  );
}
