/*
 * --------------------------------------------------------------------------
 * File: inspection-pdf.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for PDF generation, storage, and hashing.
 * Manages a concurrent PDF generation queue with circuit breaker pattern.
 * Extracted from InspectionsService to follow Single Responsibility Principle.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IpfsService } from '../ipfs/ipfs.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import puppeteer, { Browser } from 'puppeteer';

const PDF_ARCHIVE_PATH = './pdfarchived';

class PdfGenerationQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private readonly maxConcurrent: number;
  private totalProcessed = 0;
  private totalErrors = 0;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 8;
  private circuitBreakerOpenUntil = 0;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  get stats() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      consecutiveErrors: this.consecutiveErrors,
      circuitBreakerOpen: Date.now() < this.circuitBreakerOpenUntil,
    };
  }

  private isCircuitBreakerOpen(): boolean {
    return Date.now() < this.circuitBreakerOpenUntil;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    if (this.isCircuitBreakerOpen()) {
      throw new Error(
        'PDF generation circuit breaker is open due to consecutive failures. Please try again later.',
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          this.totalProcessed++;
          this.consecutiveErrors = 0;
          resolve(result);
        } catch (error) {
          this.totalErrors++;
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            this.circuitBreakerOpenUntil = Date.now() + 300000;
          }
          reject(error as Error);
        }
      });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    this.running++;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        this.running--;
        void this.processQueue();
      }
    }
  }
}

@Injectable()
export class InspectionPdfService {
  private readonly logger = new Logger(InspectionPdfService.name);
  private readonly pdfQueue = new PdfGenerationQueue(5);

  constructor(
    private readonly config: ConfigService,
    private readonly ipfsService: IpfsService,
  ) {
    void this.ensureDirectoryExists(PDF_ARCHIVE_PATH);
  }

  /**
   * Returns the current queue statistics.
   */
  getQueueStats() {
    return this.pdfQueue.stats;
  }

  /**
   * Helper method to sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper with exponential backoff.
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    operationName: string = 'operation',
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (attempt === maxRetries) {
          this.logger.error(
            `${operationName} failed after ${maxRetries} attempts: ${errorMessage}`,
          );
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        this.logger.warn(
          `${operationName} failed on attempt ${attempt}/${maxRetries}: ${errorMessage}. Retrying in ${delay}ms...`,
        );

        await this.sleep(delay);
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries} attempts`);
  }

  /**
   * Helper to ensure directory exists.
   * @param directoryPath The path to the directory.
   */
  async ensureDirectoryExists(directoryPath: string) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      this.logger.log(`Directory ensured: ${directoryPath}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        this.logger.error(
          `Failed to create directory ${directoryPath}`,
          (error as Error).stack,
        );
        // Depending on severity, you might want to throw an error here
      }
    }
  }

  /**
   * Generates PDF from a frontend URL using Puppeteer.
   * @param url The URL of the frontend page to render.
   * @param token Optional JWT token to include in headers.
   * @returns A Buffer containing the generated PDF data.
   */
  async generatePdfFromUrl(
    url: string,
    token: string | null, // Accept the token
  ): Promise<Buffer> {
    let browser: Browser | null = null;
    this.logger.log(`Generating PDF from URL: ${url}`);

    // Add a random delay to help with concurrent requests (adaptive based on queue size)
    const currentQueueStats = this.pdfQueue.stats;
    let delayMultiplier = 1000; // Base 1 second

    if (currentQueueStats.queueLength > 15) {
      delayMultiplier = 5000; // 0-5s for very large bulk (10+ inspections)
    } else if (currentQueueStats.queueLength > 8) {
      delayMultiplier = 3000; // 0-3s for large bulk (5-10 inspections)
    } else if (currentQueueStats.queueLength > 3) {
      delayMultiplier = 2000; // 0-2s for medium bulk (3-5 inspections)
    }

    const randomDelay = Math.random() * delayMultiplier;
    await this.sleep(randomDelay);

    this.logger.debug(
      `Applied ${Math.round(randomDelay)}ms delay for queue size ${currentQueueStats.queueLength}`,
    );

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-features=TranslateUI',
          '--disable-sync',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
        ],
        executablePath: '/usr/bin/chromium-browser',
        timeout: 60000, // 1 minute timeout for browser launch
        protocolTimeout: 600000, // 10 minutes timeout for protocol operations
      });

      const page = await browser.newPage();

      // Set proper viewport for web content (maintain original layout)
      await page.setViewport({
        width: 1200, // Standard desktop width
        height: 1600, // Sufficient height for content
        deviceScaleFactor: 1,
      });

      // Get compression level from environment
      const compressionLevel = this.config.get<string>('PDF_COMPRESSION_LEVEL', 'low');
      const enableOptimization = compressionLevel !== 'none';

      // Only apply optimizations if compression is enabled
      if (enableOptimization) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          const requestUrl = req.url();

          // Only block truly unnecessary resources, KEEP images and fonts
          if (
            requestUrl.includes('analytics') ||
            requestUrl.includes('tracking') ||
            requestUrl.includes('ads') ||
            requestUrl.includes('facebook.com') ||
            requestUrl.includes('google-analytics') ||
            requestUrl.includes('googletag') ||
            requestUrl.includes('doubleclick') ||
            resourceType === 'websocket' ||
            resourceType === 'eventsource'
          ) {
            void req.abort();
          } else {
            // Allow all other resources including images, fonts, stylesheets
            void req.continue();
          }
        });
      }

      if (token) {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        await page.setExtraHTTPHeaders(headers);
        this.logger.debug(
          'Added Authorization header to Puppeteer navigation.',
        );
      }

      this.logger.log(`Navigating to ${url}`);

      // Use different wait strategies based on network conditions
      let waitUntil: 'load' | 'networkidle0' | 'networkidle2' = 'networkidle0';

      try {
        await page.goto(url, {
          waitUntil,
          timeout: 600000, // Increased to 10 minutes for better reliability
        });
      } catch (navigationError: unknown) {
        // If networkidle0 fails, try with networkidle2
        const errorMsg =
          navigationError instanceof Error
            ? navigationError.message
            : 'Unknown error';
        this.logger.warn(
          `Navigation with ${waitUntil} failed (${errorMsg}), trying with 'networkidle2' strategy`,
        );
        waitUntil = 'networkidle2';
        await page.goto(url, {
          waitUntil,
          timeout: 600000,
        });
      }

      await page.waitForSelector('#glosarium', {
        visible: true,
        timeout: 600000, // Increased to 10 minutes for better reliability
      });

      // Wait for images to load
      this.logger.log('Waiting for images to load...');
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', reject);
              // Fallback timeout for individual images
              setTimeout(resolve, 10000); // 10 seconds max per image
            });
          }),
        );
      });

      // Additional wait to ensure everything is rendered
      await this.sleep(2000); // 2 second buffer
      this.logger.log('All images loaded, proceeding with PDF generation...');

      // Only apply CSS optimizations if compression is enabled
      if (enableOptimization) {
        await page.addStyleTag({
          content: `
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              /* Keep images intact and visible */
              img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                page-break-inside: avoid !important;
              }
              /* Only remove heavy decorative elements that don't affect content */
              .shadow:not(.inspection-shadow), .drop-shadow:not(.inspection-shadow) {
                box-shadow: none !important;
                filter: none !important;
              }
            }
          `,
        });

        // Very light optimization - only remove truly unnecessary elements
        await page.evaluate(() => {
          // Remove only video elements that are clearly not part of inspection
          const heavyElements = document.querySelectorAll(
            'video:not([data-inspection]):not([class*="inspection"])',
          );
          heavyElements.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        });
      }

      this.logger.log(`Generating PDF with ${compressionLevel} compression...`);

      // Use conservative scale values to maintain layout quality
      let scale = 1.0; // Default: no scaling for best quality

      switch (compressionLevel) {
        case 'high':
          scale = 0.85; // Modest reduction
          break;
        case 'medium':
          scale = 0.9; // Light reduction
          break;
        case 'low':
        case 'none':
          scale = 1.0; // No scaling
          break;
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm',
        },
        scale,
        omitBackground: false,
        timeout: 600000, // Increased to 10 minutes for better reliability
        tagged: compressionLevel === 'none', // Only tag for highest quality
      });

      const sizeInMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      this.logger.log(`PDF generated successfully from ${url}`);
      this.logger.log(
        `PDF size: ${sizeInMB} MB (compression: ${compressionLevel})`,
      );

      return Buffer.from(pdfBuffer);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to generate PDF from URL ${url}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${errorMessage}`,
      );
    } finally {
      if (browser) {
        await browser.close(); // Pastikan browser SELALU ditutup
        this.logger.log(`Puppeteer browser closed for URL: ${url}`);
      }
    }
  }

  /**
   * Generates, saves, and hashes a PDF from a given URL.
   * @param url The URL to generate the PDF from.
   * @param baseFileName The unique filename for the PDF.
   * @param token The JWT token for authentication.
   * @returns An object with the public URL, IPFS CID, and hash of the PDF.
   */
  async generateAndSavePdf(
    url: string,
    baseFileName: string,
    token: string | null,
  ): Promise<{ pdfPublicUrl: string; pdfCid: string; pdfHashString: string }> {
    const queueStats = this.pdfQueue.stats;
    this.logger.log(
      `Adding PDF generation to queue for ${baseFileName}. Queue status: ${queueStats.running}/${queueStats.queueLength + queueStats.running} (running/total)`,
    );

    // Log special warning for very large bulk operations
    if (queueStats.queueLength > 15) {
      this.logger.warn(
        `Very large bulk operation detected! ${queueStats.queueLength} PDFs queued. Estimated completion time: ${Math.ceil((queueStats.queueLength / 5) * 3)} minutes`,
      );
    }

    // Use queue to limit concurrent PDF generations
    return this.pdfQueue.add(async () => {
      this.logger.log(`Starting PDF generation for ${baseFileName}`);

      // Use retry mechanism for PDF generation
      const pdfBuffer = await this.retryWithBackoff(
        () => this.generatePdfFromUrl(url, token),
        3, // max retries
        2000, // base delay 2 seconds
        `PDF generation for ${baseFileName}`,
      );

      const pdfCid = await this.ipfsService.add(pdfBuffer);
      const pdfFilePath = path.join(PDF_ARCHIVE_PATH, baseFileName);
      await fs.writeFile(pdfFilePath, pdfBuffer);
      this.logger.log(`PDF report saved to: ${pdfFilePath}`);

      const hash = crypto.createHash('sha256');
      hash.update(pdfBuffer);
      const pdfHashString = hash.digest('hex');
      this.logger.log(
        `PDF hash calculated for ${baseFileName}: ${pdfHashString}`,
      );

      const pdfBaseUrl = this.config.get<string>('PDF_PUBLIC_BASE_URL', '/pdfarchived');
      const pdfPublicUrl = `${pdfBaseUrl}/${baseFileName}`;

      const finalStats = this.pdfQueue.stats;
      this.logger.log(
        `PDF generation completed for ${baseFileName}. Queue stats: processed=${finalStats.totalProcessed}, errors=${finalStats.totalErrors}`,
      );

      return { pdfPublicUrl, pdfCid, pdfHashString };
    });
  }
}
