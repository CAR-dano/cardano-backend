import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import puppeteer, { Browser } from 'puppeteer';

// Consider moving these to ConfigService for better management
const PDF_ARCHIVE_PATH = './pdfarchived';
const PDF_PUBLIC_BASE_URL = process.env.PDF_PUBLIC_BASE_URL || '/pdfarchived';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private configService: ConfigService) {
    this.ensureDirectoryExists(PDF_ARCHIVE_PATH).catch(err => {
         this.logger.error(`Failed to ensure PDF archive directory on startup: ${PDF_ARCHIVE_PATH}`, err.stack);
         // Depending on the application's needs, you might want to throw an error here
         // or handle it in a way that prevents the application from starting in an invalid state.
    });
  }

  private async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      this.logger.log(`Directory ensured: ${directoryPath}`);
    } catch (error: any) { // Use 'any' or 'unknown' and then check type
      if (error.code !== 'EEXIST') {
        this.logger.error(`Failed to create directory ${directoryPath}`, error.stack);
        throw new InternalServerErrorException(`Failed to create directory ${directoryPath}`);
      }
    }
  }

  public async generatePdfFromUrl(url: string): Promise<Buffer> {
    let browser: Browser | null = null;
    this.logger.log(`Generating PDF from URL: ${url}`);
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        // executablePath: this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH'), // Optional: if path needs to be configurable
      });
      const page = await browser.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      this.logger.log(`PDF buffer generated successfully from ${url}`);
      return Buffer.from(pdfBuffer); // Ensure it's a Node.js Buffer
    } catch (error: any) {
      this.logger.error(`Failed to generate PDF from URL ${url}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not generate PDF report from URL: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
        this.logger.log(`Puppeteer browser closed for URL: ${url}`);
      }
    }
  }

  public async savePdf(buffer: Buffer, baseFileName: string): Promise<{ filePath: string; publicUrl: string; uniqueFileName: string }> {
    const uniqueFileName = `${baseFileName}-${Date.now()}.pdf`;
    const filePath = path.join(PDF_ARCHIVE_PATH, uniqueFileName);
    // PDF_PUBLIC_BASE_URL should ideally come from ConfigService or be constructed more robustly
    const publicUrl = `${this.configService.get('PDF_PUBLIC_BASE_URL') || PDF_PUBLIC_BASE_URL}/${uniqueFileName}`;

    try {
      // ensureDirectoryExists is called in constructor, but good to have robust error handling here too
      // or call it again if there's a chance the directory could be removed at runtime.
      // await this.ensureDirectoryExists(PDF_ARCHIVE_PATH); // Optional: call again if needed
      await fs.writeFile(filePath, buffer);
      this.logger.log(`PDF saved to: ${filePath}`);
      return { filePath, publicUrl, uniqueFileName };
    } catch (error: any) {
      this.logger.error(`Failed to save PDF to ${filePath}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to save PDF: ${error.message}`);
    }
  }

  public calculatePdfHash(buffer: Buffer): string {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      const pdfHash = hash.digest('hex');
      this.logger.log(`PDF hash calculated: ${pdfHash}`);
      return pdfHash;
    } catch (error: any) {
      this.logger.error(`Failed to calculate PDF hash: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to calculate PDF hash: ${error.message}`);
    }
  }
}
