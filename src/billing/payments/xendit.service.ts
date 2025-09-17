/*
 * --------------------------------------------------------------------------
 * File: payments/xendit.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Lightweight Xendit API client used to create invoices
 * for credit package purchases.
 * --------------------------------------------------------------------------
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../logging/app-logger.service';

/** Input payload for creating Xendit invoice */
interface CreateInvoiceInput {
  external_id: string;
  amount: number;
  payer_email?: string | null;
  description?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  callback_url?: string;
  callback_authentication_token?: string;
}

/** Subset of response fields returned from Xendit */
interface CreateInvoiceResponse {
  id: string;
  invoice_url: string;
}

/**
 * @class XenditService
 * @description Minimal wrapper around Xendit invoices API.
 */
@Injectable()
export class XenditService {
  private readonly apiKey: string | undefined;
  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(XenditService.name);
    this.apiKey = this.config.get<string>('XENDIT_API_KEY');
  }

  /**
   * Authorization and JSON headers for Xendit API requests.
   */
  private get headers() {
    const key = this.apiKey || '';
    const basic = Buffer.from(`${key}:`).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  /**
   * Creates a new Xendit invoice for the given input.
   * Logs error details on failure and throws a generic error with status code.
   *
   * @param input Invoice fields including external_id, amount, and optional metadata
   * @returns Minimal response including invoice id and payment URL
   */
  async createInvoice(
    input: CreateInvoiceInput,
  ): Promise<CreateInvoiceResponse> {
    const url = 'https://api.xendit.co/v2/invoices';
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Xendit createInvoice failed: ${res.status} ${text}`);
      throw new Error(`Xendit error: ${res.status}`);
    }
    const data: any = await res.json();
    return { id: data.id, invoice_url: data.invoice_url };
  }
}
