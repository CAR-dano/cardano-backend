# Dockerfile

# --- Stage 1: Builder ---
# Use a Node.js version that matches your development environment
FROM node:20-alpine AS builder

# Set working directory inside the image
WORKDIR /usr/src/app

# Install OS dependencies needed for Prisma (like openssl) if using alpine
# RUN apk add --no-cache openssl

# Copy package files and install dependencies (including devDependencies)
COPY package*.json ./
# Use npm ci for clean installs based on lock file
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client (important step before build)
# This ensures the client matching the schema is available for the build
RUN npx prisma generate

# Copy the rest of the application source code
COPY . .

# Build the NestJS application
RUN npm run build

# Install only production dependencies in a separate directory for the final stage
# Prune devDependencies after build
RUN npm prune --production

# --- Stage 2: Runner ---
# Use a smaller Node.js image for the final application
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install OS dependencies needed *at runtime* for Prisma/PostgreSQL Client (like openssl)
# If you encounter runtime errors related to shared libraries, add them here.
RUN apk add --no-cache openssl libpq # libpq is needed for postgresql connection

# Copy necessary files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./package.json

# --- Entrypoint Script (Handles Migration) ---
# Copy an entrypoint script (create this file next)
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose the port the application will run on (defined in .env later)
# Defaulting to 3000, but this is mainly informational for Docker
EXPOSE 3000

# Set the entrypoint script to run when the container starts
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default command (passed to entrypoint script) - start the Node app
CMD ["node", "dist/main"]