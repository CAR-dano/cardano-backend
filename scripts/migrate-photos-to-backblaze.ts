import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BackblazeService } from '../src/backblaze/backblaze.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';

interface MigrationOptions {
  dryRun: boolean;
  resume: boolean;
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
}

function parseArgs(argv: string[]): MigrationOptions {
  return {
    dryRun: argv.includes('--dry-run'),
    resume: argv.includes('--resume'),
  };
}

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    default:
      return 'b2/x-auto';
  }
}

async function ensureFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const logger = new Logger('PhotoMigration');
  const options = parseArgs(process.argv.slice(2));

  logger.log(`Starting photo migration with options: ${JSON.stringify(options)}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const backblaze = app.get(BackblazeService);

  if (!backblaze.isConfigured()) {
    throw new Error('Backblaze credentials are not configured.');
  }

  const photos = await prisma.photo.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const result: MigrationResult = {
    total: photos.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const photo of photos) {
    if (photo.backblazeFileId && options.resume) {
      result.skipped += 1;
      logger.log(`Skipping photo ${photo.id}, already migrated.`);
      continue;
    }

    const relativePath = photo.path?.startsWith('inspection-photos')
      ? photo.path
      : path.join('inspection-photos', photo.path ?? '');
    const absolutePath = path.join('./uploads', relativePath);

    const fileExists = await ensureFileExists(absolutePath);
    if (!fileExists) {
      logger.warn(`Local file for photo ${photo.id} not found at ${absolutePath}. Skipping.`);
      result.skipped += 1;
      continue;
    }

    try {
      if (options.dryRun) {
        logger.log(`Dry run: would migrate photo ${photo.id} from ${absolutePath}.`);
        result.migrated += 1;
        continue;
      }

      const buffer = await fs.readFile(absolutePath);
      const storageKey = `inspection-photos/migrated/${photo.inspectionId}/${photo.id}${path.extname(absolutePath)}`;
      const uploadResult = await backblaze.uploadPhotoBuffer(
        buffer,
        storageKey,
        detectContentType(absolutePath),
      );

      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          path: storageKey,
          publicUrl: uploadResult.publicUrl,
          backblazeFileId: uploadResult.fileId,
          backblazeFileName: uploadResult.fileName,
        },
      });

      logger.log(`Migrated photo ${photo.id} to Backblaze (${uploadResult.fileName}).`);
      result.migrated += 1;
    } catch (error) {
      logger.error(
        `Failed to migrate photo ${photo.id}: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      result.failed += 1;
    }
  }

  logger.log(`Migration complete: ${JSON.stringify(result)}`);
  await app.close();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', error);
  process.exit(1);
});
