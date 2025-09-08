import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

interface CreateInvoiceResponse {
  id: string;
  invoice_url: string;
}

@Injectable()
export class XenditService {
  private readonly logger = new Logger(XenditService.name);
  private readonly apiKey: string | undefined;
  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('XENDIT_API_KEY');
  }

  private get headers() {
    const key = this.apiKey || '';
    const basic = Buffer.from(`${key}:`).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResponse> {
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

