#!/bin/bash

# Check required environment variables
if [ -z "$APP" ]; then
  echo "[ERROR] APP environment variable is not set"
  exit 1
fi

if [ -z "$TAG" ]; then
  echo "[ERROR] TAG environment variable is not set"
  exit 1
fi

if [ -z "$TEMP_PORT" ]; then
  echo "[ERROR] TEMP_PORT environment variable is not set"
  exit 1
fi

if [ -z "$HOSTPORT" ]; then
  echo "[ERROR] HOSTPORT environment variable is not set"
  exit 1
fi

if [ -z "$CONTAINERPORT" ]; then
  echo "[ERROR] CONTAINERPORT environment variable is not set"
  exit 1
fi

echo "[INFO] Using image: $APP:$TAG"
echo "[INFO] Temp port: $TEMP_PORT, Host port: $HOSTPORT, Container port: $CONTAINERPORT"

# Error handling function
handle_error() {
  local error_message="$1"
  local exit_code="${2:-1}"

  echo "[ERROR] $error_message"

  # Cleanup any temporary containers/images on failure
  echo "[INFO] Performing cleanup due to failure..."
  docker rm -f ${TAG}-new 2>/dev/null || true
  docker rmi $APP:$TAG-new 2>/dev/null || true

  return $exit_code
}

# Function to run container
run_container() {
  local container_name=$1
  local host_port=$2
  local container_port=$3
  local image_tag=$4

  echo "[INFO] Running container ${container_name} on port ${host_port}..."

  if ! docker run -d --name ${container_name} \
    -p ${host_port}:${container_port} \
    --restart unless-stopped \
    ${image_tag}; then
    handle_error "Failed to run container ${container_name}"
    return 1
  fi

  return 0
}

# 1. Pull latest image
echo "[INFO] Pulling latest image..."
if ! docker pull $APP:$TAG; then
  echo "[ERROR] Failed to pull image $APP:$TAG"
  exit 1
fi

# 2. Retag the new image
echo "[INFO] Retagging image as $TAG-new..."
if ! docker tag $APP:$TAG $APP:$TAG-new; then
  handle_error "Failed to tag image $APP:$TAG as $APP:$TAG-new"
  exit 1
fi

# Remove the pulled tag to avoid clutter
docker rmi $APP:$TAG || true

# 3. Run new container on temp port
echo "[INFO] Starting new container on temp port..."
if ! run_container "${TAG}-new" "${TEMP_PORT}" "${CONTAINERPORT}" "$APP:$TAG-new"; then
  handle_error "Failed to start new container on temp port"
  exit 1
fi

# 4. Health check on temp port
echo "[INFO] Checking health on temp port ${TEMP_PORT}..."
for i in {1..10}; do
  if curl -fs http://localhost:${TEMP_PORT}/health > /dev/null; then
    echo "[SUCCESS] New container is healthy!"

    # Stop old current container if exists
    if [ "$(docker ps -aq -f name=${TAG}-current)" ]; then
      echo "[INFO] Stopping old container..."
      docker stop ${TAG}-current || true
      if [ "$(docker ps -aq -f name=${TAG}-old)" ]; then
        docker rm ${TAG}-old || true
      fi
      docker rename ${TAG}-current ${TAG}-old || true
      docker rmi $APP:$TAG-old || true
    fi

    # Switch new container to production port
    echo "[INFO] Switching new container to production port ${HOSTPORT}..."
    if ! docker stop ${TAG}-new; then
      handle_error "Failed to stop temporary container ${TAG}-new"
      exit 1
    fi

    if ! run_container "${TAG}-current" "${HOSTPORT}" "${CONTAINERPORT}" "$APP:$TAG-new"; then
      handle_error "Failed to start production container on port ${HOSTPORT}"
      # Try to restart the old container if it exists
      if [ "$(docker ps -aq -f name=${TAG}-old)" ]; then
        echo "[INFO] Attempting to restart previous container..."
        docker start ${TAG}-old || true
      fi
      exit 1
    fi

    docker rm ${TAG}-new || true

    if ! docker tag $APP:$TAG-new $APP:$TAG-current; then
      echo "[WARN] Failed to tag image as current, but container is running"
    fi

    # Clean up
    docker rmi $APP:$TAG-new || true
    echo "[SUCCESS] Deployment completed successfully!"
    exit 0
  fi
  echo "[WAIT] Retry in 3s..."
  sleep 3
done

# 5. Rollback if failed
handle_error "New container failed health check after 10 attempts. Rolling back..."
exit 1
