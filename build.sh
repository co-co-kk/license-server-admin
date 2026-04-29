#!/bin/bash
# build.sh - Build Docker image locally and save to tar for upload

set -e

IMAGE_NAME="license-server-admin"
IMAGE_TAG="latest"
TAR_FILE="${IMAGE_NAME}.tar"

echo "=== Step 1: Building Docker image ==="
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo ""
echo "=== Step 2: Saving image to ${TAR_FILE} ==="
docker save "${IMAGE_NAME}:${IMAGE_TAG}" -o "${TAR_FILE}"

echo ""
echo "=== Done ==="
echo "Image saved to: $(pwd)/${TAR_FILE}"
echo ""
echo "Upload to server with:"
echo "  scp ${TAR_FILE} user@your-server:/tmp/"
echo ""
echo "Then run deploy.sh on the server."
