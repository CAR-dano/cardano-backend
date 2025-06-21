# STAGE 1: Build Stage
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build


# STAGE 2: Production Stage

FROM node:22-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gcompat \
    udev \
    xvfb

RUN apk add --no-cache openssl postgresql-libs

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./dist

COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

EXPOSE 3010

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

CMD ["node", "dist/main"]