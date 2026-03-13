/**
 * @fileoverview Shared OpenAPI document holder.
 *
 * Extracted from main.ts so that other modules (e.g. ScalarDocsController)
 * can read the generated OpenAPI document WITHOUT importing main.ts — which
 * has side-effects (the bootstrap() call at module level).
 */

import { OpenAPIObject } from '@nestjs/swagger';

let openApiDocument: OpenAPIObject | null = null;

/**
 * Store the generated OpenAPI document so it can be retrieved later.
 */
export function setOpenApiDocument(doc: OpenAPIObject): void {
  openApiDocument = doc;
}

/**
 * Retrieves the generated OpenAPI document.
 *
 * @returns The OpenAPI document object or null if not yet generated.
 */
export function getOpenApiDocument(): OpenAPIObject | null {
  return openApiDocument;
}
