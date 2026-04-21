import "@testing-library/jest-dom/vitest";

/**
 * Setup do Vitest browser-mode (Playwright provider).
 * Componentes rodam em Chromium real — não precisa de jsdom.
 *
 * MSW pode ser ativado por suite específica via `worker.start()`.
 * Mantemos setup mínimo aqui para não impactar performance.
 */
