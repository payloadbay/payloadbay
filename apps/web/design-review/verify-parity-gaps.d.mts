import type { Page } from "@playwright/test";

export function verifyParityGaps(page: Page, origin?: string, width?: number): Promise<void>;
