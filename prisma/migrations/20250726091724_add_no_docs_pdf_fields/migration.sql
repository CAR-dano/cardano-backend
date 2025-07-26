-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "ipfs_pdf_no_docs" VARCHAR(255),
ADD COLUMN     "pdf_file_hash_no_docs" VARCHAR(255),
ADD COLUMN     "url_pdf_no_docs" VARCHAR(255);
