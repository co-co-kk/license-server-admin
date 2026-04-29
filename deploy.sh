#!/bin/bash
# deploy.sh - Load Docker image and start container on the server
# Upload this file and the .tar to the server, then run: bash deploy.sh

set -e

IMAGE_NAME="license-server-admin"
IMAGE_TAG="latest"
TAR_FILE="${IMAGE_NAME}.tar"
CONTAINER_NAME="license-server-admin"
HOST_PORT=20838
CONTAINER_PORT=3000
# Directory for SQLite data persistence (adjust as needed)
DATA_DIR="/opt/license-server/data"

echo "=== Step 1: Stopping existing container ==="
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

echo ""
echo "=== Step 2: Loading Docker image ==="
docker load -i "${TAR_FILE}"

echo ""
echo "=== Step 3: Creating data directory ==="
mkdir -p "${DATA_DIR}"

echo ""
echo "=== Step 4: Starting container ==="
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${DATA_DIR}:/app/data" \
  -e NODE_ENV=production \
  -e HMAC_SECRET="change-me-to-a-real-secret" \
  --restart unless-stopped \
  "${IMAGE_NAME}:${IMAGE_TAG}"

echo ""
echo "=== Done ==="
echo "Container: ${CONTAINER_NAME}"
echo "Access:    http://<server-ip>:${HOST_PORT}"
echo ""
echo "Check logs:  docker logs -f ${CONTAINER_NAME}"
echo "Check status: docker ps | grep ${CONTAINER_NAME}"
