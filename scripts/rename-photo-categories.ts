/*
 * One-off script to rename photo categories from English to Indonesian.
 * Run with: npx ts-node scripts/rename-photo-categories.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mappings: Array<{ from: string; to: string }> = [
    { from: 'exterior', to: 'Eksterior Tambahan' },
    { from: 'interior', to: 'Interior Tambahan' },
    { from: 'general', to: 'General Wajib' },
    { from: 'engine', to: 'Mesin Tambahan' },
    { from: 'chassis', to: 'Kaki-kaki Tambahan' },
    { from: 'tools', to: 'Alat-alat Tambahan' },
    { from: 'documents', to: 'Foto Dokumen' },
    { from: 'document', to: 'Foto Dokumen' },
    { from: 'General', to: 'General Wajib' }, // for legacy default value
  ];

  const results: Array<{ from: string; to: string; count: number }> = [];

  for (const { from, to } of mappings) {
    const res = await prisma.photo.updateMany({
      where: {
        category: {
          equals: from,
          mode: 'insensitive',
        },
      },
      data: { category: to },
    });
    results.push({ from, to, count: res.count });
  }

  console.table(results);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

