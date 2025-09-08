#!/bin/sh
# entrypoint.sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Run Prisma migrations
echo "Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

# Check if migration command was successful
if [ $? -ne 0 ]; then
  echo "Prisma migration failed. Exiting."
  exit 1 # Exit with error code if migration fails
fi

echo "Prisma migrations applied successfully."

# Execute the CMD passed to the docker run/compose command (e.g., "node dist/main")
exec "$@"
