/*
 * --------------------------------------------------------------------------
 * File: sanitize.helper.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Provides a centralised, zero-HTML sanitisation helper used by
 * @Transform decorators in DTOs.  We intentionally strip ALL HTML tags so
 * that free-text fields (customer names, notes, labels, etc.) can never carry
 * XSS payloads into the database or the PDF renderer.
 *
 * sanitizeString   – strip HTML from a single string value, then trim.
 * sanitizeStringArray – map sanitizeString over an array of strings.
 * --------------------------------------------------------------------------
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Shared sanitize-html options: no tags, no attributes, no entities.
 * Any HTML markup is removed entirely rather than escaped.
 */
const STRIP_ALL: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/**
 * Strips all HTML from `value` and trims surrounding whitespace.
 * Returns an empty string for null / undefined inputs.
 */
export function sanitizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return sanitizeHtml(String(value), STRIP_ALL).trim();
}

/**
 * Applies sanitizeString to every element of an array.
 * Non-array values are returned as-is so class-validator can reject them.
 */
export function sanitizeStringArray(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) => sanitizeString(item));
}
