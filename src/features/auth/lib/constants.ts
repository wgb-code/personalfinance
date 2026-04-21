/**
 * Constantes compartilhadas pela camada de autenticação.
 *
 * Centralizar limites e mensagens evita "vibes coding" e garante consistência
 * entre schemas Zod, mensagens de UI e auditorias de segurança (Leis 3, 9 e 12).
 *
 * Referências:
 * - RFC 5321 §4.5.3.1.3 — limite prático do address path para email.
 * - bcrypt — entradas além de 72 bytes são silenciosamente truncadas.
 * - Lei 3 (DoS Prevention) e Lei 12 (Upload Zero-Trust) em
 *   `specs/modules/01-auth-and-session/security.md`.
 */

export const EMAIL_MAX_LENGTH = 254;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const FULL_NAME_MIN_LENGTH = 1;
export const FULL_NAME_MAX_LENGTH = 100;

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedAvatarMimeType = (typeof ALLOWED_AVATAR_MIME_TYPES)[number];

/**
 * Mensagens de validação em pt-BR usadas pelos schemas de autenticação.
 *
 * Mantidas como `as const` para evitar string mágica e permitir asserts
 * exatos nos testes (`expect(issue.message).toBe(AUTH_MESSAGES.X)`).
 *
 * As mensagens são propositalmente genéricas e neutras — Lei 9 (Exposição
 * Mínima): não revelam internals do Supabase nem inferências sobre estado
 * do servidor.
 */
export const AUTH_MESSAGES = {
  EMAIL_INVALID: "Informe um email válido",
  EMAIL_TOO_LONG: "Email muito longo",
  EMAIL_REQUIRED: "Email é obrigatório",
  PASSWORD_TOO_SHORT: "Senha deve ter ao menos 8 caracteres",
  PASSWORD_TOO_LONG: "Senha não pode ter mais de 72 caracteres",
  PASSWORD_WEAK: "Senha deve conter ao menos uma letra e um número",
  PASSWORD_REQUIRED: "Senha é obrigatória",
  PASSWORD_MISMATCH: "As senhas não conferem",
  FULL_NAME_REQUIRED: "Nome é obrigatório",
  FULL_NAME_TOO_LONG: "Nome não pode ter mais de 100 caracteres",
  AVATAR_INVALID_TYPE: "Arquivo não é uma imagem válida",
  AVATAR_TOO_LARGE: "Avatar deve ter no máximo 2MB",

  /**
   * Mensagem ÚNICA e neutra para qualquer falha de credencial no login
   * (AC-06 + Lei 9 — Exposição Mínima). Usada indistintamente para:
   *   - email inexistente,
   *   - senha incorreta,
   *   - email não confirmado.
   *
   * Diferenciar essas situações no UI permitiria enumeração de contas
   * (atacante descobre quais emails têm cadastro). NUNCA mude esse texto
   * sem revisar `auth-errors.ts` e seus testes de invariância.
   */
  INVALID_CREDENTIALS: "Email ou senha incorretos",

  /**
   * AC-07 — Rate limit do Supabase Auth (HTTP 429 ou
   * "email rate limit exceeded"). Mensagem propositadamente vaga
   * sobre "alguns minutos" porque a janela real do Supabase varia
   * por endpoint e versão.
   */
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",

  /**
   * AC-01 — Tentativa de cadastro com email já existente. Aqui PODEMOS
   * revelar a colisão porque a ação parte do próprio dono do email
   * (não é enumeração por terceiro). Mesmo assim, mantemos linguagem
   * neutra para evitar fingerprinting do backend.
   */
  EMAIL_ALREADY_REGISTERED: "Já existe uma conta com este email",

  /**
   * AC-12 — Reset de senha rejeitado pelo Supabase por força insuficiente
   * (servidor pode ser mais estrito que o schema do cliente; defesa em
   * profundidade — Lei 1).
   */
  WEAK_PASSWORD: "Senha não atende aos requisitos mínimos.",

  /**
   * Falha de rede / fetch quebrado. Mensagem é acionável (pede que o
   * usuário verifique a internet) sem revelar host, status ou stack.
   */
  NETWORK_ERROR: "Falha de conexão. Verifique sua internet e tente novamente.",

  /**
   * Fallback para qualquer erro não classificado. NUNCA expor `error.message`
   * cru — ele pode vazar nomes de tabela, hints de constraint do Postgres,
   * ou detalhes do JWT (Lei 9 + Lei 14).
   */
  UNEXPECTED_ERROR: "Não foi possível concluir a operação. Tente novamente.",

  /**
   * Microcopy de UI da tela de login (AC-05). Centralizada aqui para
   * evitar string mágica nos componentes (anti-vibe coding) e permitir
   * que testes assertem o texto exato com `toBe`.
   *
   * Tom: "Calm. Clear. Honest." (.impeccable.md). Sem urgência, sem
   * exclamações, sem terminologia técnica ("autenticar", "endpoint").
   */
  LOGIN_TITLE: "Entrar",
  LOGIN_SUBTITLE: "Acesse sua conta para continuar.",
  LOGIN_SUBMIT: "Entrar",
  LOGIN_SUBMITTING: "Entrando…",
  LOGIN_EMAIL_LABEL: "Email",
  LOGIN_EMAIL_PLACEHOLDER: "voce@exemplo.com",
  LOGIN_PASSWORD_LABEL: "Senha",
  LOGIN_PASSWORD_PLACEHOLDER: "Sua senha",
  LOGIN_FORGOT_PASSWORD_LINK: "Esqueci minha senha",
  LOGIN_GO_TO_REGISTER: "Criar conta",
  LOGIN_PAGE_TITLE: "Entrar — Organizador Financeiro",

  /**
   * Microcopy de UI da tela de cadastro (AC-01). Centralizada aqui para
   * evitar string mágica nos componentes (anti-vibe coding) e permitir
   * que testes assertem o texto exato com `toBe`.
   */
  REGISTER_TITLE: "Criar conta",
  REGISTER_SUBTITLE: "Preencha os dados abaixo para começar.",
  REGISTER_SUBMIT: "Criar conta",
  REGISTER_SUBMITTING: "Criando conta…",
  REGISTER_EMAIL_LABEL: "Email",
  REGISTER_EMAIL_PLACEHOLDER: "voce@exemplo.com",
  REGISTER_PASSWORD_LABEL: "Senha",
  REGISTER_PASSWORD_PLACEHOLDER: "Sua senha",
  REGISTER_PASSWORD_CONFIRM_LABEL: "Confirmar senha",
  REGISTER_PASSWORD_CONFIRM_PLACEHOLDER: "Repita a senha",
  REGISTER_FULL_NAME_LABEL: "Nome completo",
  REGISTER_FULL_NAME_PLACEHOLDER: "Seu nome",
  REGISTER_AVATAR_LABEL: "Foto de perfil",
  REGISTER_AVATAR_HINT: "Opcional — JPEG, PNG ou WebP, até 2MB",
  REGISTER_GO_TO_LOGIN: "Já tenho conta",
  REGISTER_PAGE_TITLE: "Criar conta — Organizador Financeiro",

  /**
   * Microcopy do modal de sessão expirada (AC-09 — Auto-logout por inatividade).
   */
  SESSION_EXPIRED_TITLE: "Sessão expirada",
  SESSION_EXPIRED_MESSAGE: "Sua sessão expirou por inatividade",
  SESSION_EXPIRED_BUTTON: "OK",

  /**
   * Microcopy do toggle "mostrar/ocultar senha" no `<Field>` reutilizável.
   * Os textos VIRAM `aria-label` (não há texto visível), portanto precisam
   * ser auto-suficientes fora de contexto visual (a11y).
   */
  PASSWORD_SHOW: "Mostrar senha",
  PASSWORD_HIDE: "Ocultar senha",

  /**
   * Microcopy de UI da tela de "Esqueci minha senha" (AC-11).
   *
   * `FORGOT_PASSWORD_SUCCESS` é propositadamente genérica (Lei 9):
   * NUNCA revela se o email existe ou não no sistema, evitando
   * enumeração de contas.
   */
  FORGOT_PASSWORD_TITLE: "Recuperar senha",
  FORGOT_PASSWORD_SUBTITLE: "Informe seu email para receber as instruções.",
  FORGOT_PASSWORD_SUBMIT: "Enviar instruções",
  FORGOT_PASSWORD_SUBMITTING: "Enviando…",
  FORGOT_PASSWORD_EMAIL_LABEL: "Email",
  FORGOT_PASSWORD_EMAIL_PLACEHOLDER: "voce@exemplo.com",
  FORGOT_PASSWORD_SUCCESS:
    "Se o email existir, enviamos as instruções de recuperação.",
  FORGOT_PASSWORD_GO_TO_LOGIN: "Voltar para login",
  FORGOT_PASSWORD_PAGE_TITLE: "Recuperar senha — Organizador Financeiro",

  /**
   * Microcopy de UI da tela de "Redefinir senha" (AC-12).
   */
  RESET_PASSWORD_TITLE: "Redefinir senha",
  RESET_PASSWORD_SUBTITLE: "Escolha uma nova senha para sua conta.",
  RESET_PASSWORD_SUBMIT: "Salvar nova senha",
  RESET_PASSWORD_SUBMITTING: "Salvando…",
  RESET_PASSWORD_NEW_LABEL: "Nova senha",
  RESET_PASSWORD_NEW_PLACEHOLDER: "Sua nova senha",
  RESET_PASSWORD_CONFIRM_LABEL: "Confirmar nova senha",
  RESET_PASSWORD_CONFIRM_PLACEHOLDER: "Repita a nova senha",
  RESET_PASSWORD_SUCCESS: "Senha alterada com sucesso!",
  RESET_PASSWORD_GO_TO_LOGIN: "Ir para login",
  RESET_PASSWORD_PAGE_TITLE: "Redefinir senha — Organizador Financeiro",
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;

/**
 * Magic bytes (assinaturas binárias) das imagens aceitas pelo avatar.
 *
 * Lei 12 — Upload Zero-Trust: file.type e extensão são INPUT do cliente
 * e podem ser forjados. A única forma confiável de identificar o tipo
 * real é ler os primeiros bytes do arquivo.
 *
 * - JPEG: `FF D8 FF` no offset 0 cobre JFIF, EXIF e SPIFF (variantes mais
 *   comuns). Os 3 bytes são suficientes; o 4º byte muda por variante.
 * - PNG: assinatura completa de 8 bytes — fixa pela RFC 2083.
 * - WebP: contêiner RIFF — `RIFF` no offset 0 + `WEBP` no offset 8.
 *   Os 4 bytes intermediários (offsets 4-7) carregam o tamanho do
 *   payload e variam por arquivo, então NÃO são checados.
 */
export const AVATAR_MAGIC_BYTES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46],
  WEBP_FORMAT: [0x57, 0x45, 0x42, 0x50],
} as const;

/**
 * Quantos bytes ler do início do arquivo para detecção de tipo.
 *
 * 12 bytes cobrem o pior caso (WebP, que precisa do offset 8 + 4 bytes
 * do marker `WEBP`). Ler mais é desperdício; ler menos quebra a
 * detecção do WebP.
 */
export const AVATAR_HEADER_BYTES_TO_READ = 12;

/**
 * Mensagens de validação de avatar em pt-BR.
 *
 * INVALID_TYPE e TOO_LARGE reusam `AUTH_MESSAGES` (mesmo texto exibido
 * pelo schema Zod do AC-02) — manter sincronizado garante que o usuário
 * vê a mesma mensagem independente de qual camada rejeitou o arquivo.
 */
export const AVATAR_VALIDATION_MESSAGES = {
  INVALID_TYPE: AUTH_MESSAGES.AVATAR_INVALID_TYPE,
  TOO_LARGE: AUTH_MESSAGES.AVATAR_TOO_LARGE,
  EMPTY_FILE: "Arquivo vazio",
  READ_FAILED: "Não foi possível ler o arquivo",
  PROCESSING_FAILED: "Não foi possível processar a imagem",
} as const;

/**
 * Qualidade do re-encode JPEG (0..1). Ignorada para PNG (lossless) e
 * usada também para WebP (lossy por padrão no canvas).
 *
 * 0.92 é o sweet-spot entre fidelidade visual e tamanho — valor
 * recomendado pela MDN para fotos. Reduzir abaixo de 0.85 introduz
 * artefatos visíveis em rostos (caso típico de avatar).
 */
export const AVATAR_JPEG_QUALITY = 0.92;

/**
 * Mensagens / constantes de navegação pós-autenticação (RN-18, RN-19).
 *
 * `DEFAULT_REDIRECT` é o destino seguro quando `?redirectTo=` é
 * inválido ou ausente. Usar `/` como fallback é deliberadamente
 * conservador — o roteador decide se redireciona para `/dashboard`
 * ou `/onboarding` a partir de `/`. Mudar este valor aqui propaga
 * para todas as telas de auth (login, register, reset, magic link).
 *
 * `MAX_REDIRECT_LENGTH` é defesa contra Lei 3 (DoS): payloads de
 * `?redirectTo=` ridiculamente longos consumiriam CPU em
 * `decodeURIComponent`/regex sem retorno. 2048 cobre qualquer URL
 * interna razoável (Chrome historicamente limita URLs em 2083).
 *
 * `REDIRECT_LOG_MESSAGE` é a única string que chega a `console.warn`
 * quando descartamos um redirect — Lei 14 (Logging Higiênico):
 * NUNCA logar o valor cru do redirect inválido (ex.: token vazado).
 */
export const DEFAULT_REDIRECT = "/" as const;

export const MAX_REDIRECT_LENGTH = 2048;

/**
 * Tempo de inatividade antes do auto-logout (AC-09).
 *
 * 4 horas é um balanço entre segurança (sessão não fica aberta
 * indefinidamente) e UX (usuário não é deslogado se sair para almoçar).
 *
 * Para testes, use a prop `timeout` do `useIdleTimer` para encurtar.
 */
export const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Eventos que resetam o timer de inatividade (AC-09).
 *
 * Lista derivada de padrões de detecção de atividade em apps financeiros:
 *   - `mousemove`, `keydown`, `click`: interações primárias
 *   - `scroll`, `touchstart`: interações mobile/touch
 *   - `focus`: retorno de outra aba/janela
 *
 * NOTA: `mousedown` e `mouseup` são redundantes com `click` e omitidos
 * para evitar re-renders desnecessários. `wheel` é um subset de `scroll`.
 */
export const IDLE_EVENTS = [
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "focus",
] as const;

export type IdleEvent = (typeof IDLE_EVENTS)[number];

export const REDIRECT_MESSAGES = {
  DISCARDED: "redirect descartado",
} as const;

/**
 * Tempo de espera após rate limit (AC-07).
 *
 * O Supabase usa janelas variáveis por endpoint, mas o fallback comum
 * é 60 segundos. Exibimos este countdown para UX, independente da
 * janela real do servidor.
 */
export const RATE_LIMIT_COUNTDOWN_SECONDS = 60;
