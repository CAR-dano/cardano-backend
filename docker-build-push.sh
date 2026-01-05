#!/bin/bash

# ============================================
# Docker Build & Push Script
# ============================================
# Usage:
#   ./docker-build-push.sh [version]
#   Example: ./docker-build-push.sh v1.0.0
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-your-dockerhub-username}"
IMAGE_NAME="cardano-backend"
VERSION="${1:-latest}"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Docker Build & Push Script${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Login to Docker Hub (if not already logged in)
echo -e "${YELLOW}Checking Docker Hub authentication...${NC}"
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}Please login to Docker Hub:${NC}"
    docker login
fi

# Build the image
echo -e "${GREEN}Building Docker image...${NC}"
echo -e "Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo ""

docker build \
    --platform linux/amd64 \
    --tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} \
    --tag ${DOCKER_USERNAME}/${IMAGE_NAME}:latest \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --progress=plain \
    .

echo ""
echo -e "${GREEN}Build completed successfully!${NC}"
echo ""

# Show image size
echo -e "${YELLOW}Image size:${NC}"
docker images ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
echo ""

# Push to Docker Hub
echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Successfully pushed to Docker Hub!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Image: ${GREEN}${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}${NC}"
echo -e "Latest: ${GREEN}${DOCKER_USERNAME}/${IMAGE_NAME}:latest${NC}"
echo ""
echo -e "${YELLOW}To pull this image:${NC}"
echo -e "docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo ""
