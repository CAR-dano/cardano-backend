/*
  Warnings:

  - A unique constraint covering the columns `[pin]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "users_pin_key" ON "users"("pin");
