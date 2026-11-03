import type { Page } from "@playwright/test";

export function verifyCatalogInteractions(page: Page, origin?: string): Promise<{ findings: Array<{ name: string; message: string }>; errors: string[] }>;
