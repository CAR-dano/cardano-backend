# STAGE 1: Build Stage
# This stage is responsible for building the application and generating necessary artifacts.
FROM node:22-alpine AS builder

# Set the working directory inside the container. All subsequent commands will run from this directory.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) to the working directory.
# This allows npm ci to install dependencies before copying the rest of the application code,
# leveraging Docker's layer caching for faster builds.
COPY package*.json ./

# Install build tools required to compile native modules during `npm ci` (node-datachannel, etc.).
# These are installed only in the builder stage so the final image remains lean.
RUN apk add --no-cache \
    build-base \
    python3 \
    cmake \
    git \
    openssl-dev \
    libc6-compat

# Ensure `python` points to `python3` for node-gyp / cmake-js compatibility
RUN ln -sf /usr/bin/python3 /usr/bin/python || true

# Install project dependencies. `npm ci` is used for clean and consistent installations in CI/CD environments.
RUN npm ci

# Copy the rest of the application source code to the working directory.
COPY . .

# Generate Prisma client. This command is necessary to create the Prisma client based on the schema.
RUN npx prisma generate

# Build the application. This typically compiles TypeScript code into JavaScript.
RUN npm run build

# STAGE 2: Production Stage
# This stage creates a lean image for production, containing only the necessary runtime components.

# Use the same base image as the build stage for consistency.
FROM node:22-alpine

# Install necessary packages for Chromium and other dependencies required for PDF generation or similar tasks.
# --no-cache reduces the image size by not storing package index files.
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

# Install OpenSSL and PostgreSQL client libraries, which might be needed for database connections.
RUN apk add --no-cache openssl postgresql-libs

# New Relic removed: monitoring configuration cleaned up

# Set the working directory for the production stage.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for production dependencies.
COPY package*.json ./

# Install only production dependencies to keep the image size minimal.
RUN npm install --only=production

# Copy built application files from the builder stage.
COPY --from=builder /usr/src/app/dist ./dist

# Copy Prisma schema and generated client from the builder stage.
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
# Copy public assets from the builder stage.
COPY --from=builder /usr/src/app/public ./public

# Create necessary directories for runtime
RUN mkdir -p uploads/inspection-photos pdfarchived

# Copy the entrypoint script into the container.
COPY entrypoint.sh .

# Make the entrypoint script executable.
RUN chmod +x entrypoint.sh

# Expose port 3010, indicating that the application listens on this port.
EXPOSE 3010

# Define the entrypoint script that will be executed when the container starts.
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Define the default command to run when the container starts, if no command is specified.
# This runs the compiled main application file.
CMD ["node", "dist/main"]
