import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';

type ErrorDesc = string | false | undefined;

export interface ApiStandardErrorsOptions {
  badRequest?: ErrorDesc; // string to set description, false to skip
  unauthorized?: ErrorDesc;
  forbidden?: ErrorDesc;
  notFound?: ErrorDesc;
  internal?: ErrorDesc;
}

/**
 * Adds common error responses with a shared error schema and sensible default descriptions.
 * Pass a string to override the description, or false to skip a status entirely.
 */
export function ApiStandardErrors(opts: ApiStandardErrorsOptions = {}) {
  const decs: MethodDecorator[] = [];
  const add = (fn: MethodDecorator | undefined) => fn && decs.push(fn);

  const br = opts.badRequest ?? 'Bad Request.';
  if (br) add(ApiBadRequestResponse({ description: br, type: HttpErrorResponseDto }));

  const un = opts.unauthorized ?? 'Missing or invalid JWT.';
  if (un) add(ApiUnauthorizedResponse({ description: un, type: HttpErrorResponseDto }));

  const fb = opts.forbidden ?? 'User lacks required role.';
  if (fb) add(ApiForbiddenResponse({ description: fb, type: HttpErrorResponseDto }));

  const nf = opts.notFound ?? 'Resource not found.';
  if (nf) add(ApiNotFoundResponse({ description: nf, type: HttpErrorResponseDto }));

  const ie = opts.internal ?? 'Unexpected server error.';
  if (ie) add(ApiInternalServerErrorResponse({ description: ie, type: HttpErrorResponseDto }));

  return applyDecorators(...decs);
}

/**
 * Shortcut for common auth errors only (401, 403, 500) with shared schema.
 */
export function ApiAuthErrors() {
  return applyDecorators(
    ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.', type: HttpErrorResponseDto }),
    ApiForbiddenResponse({ description: 'User lacks required role.', type: HttpErrorResponseDto }),
    ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto }),
  );
}

