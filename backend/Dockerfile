# Stage 1: Build binaries and download dependencies
FROM node:20-bookworm-slim AS builder

# Install curl, wget, ca-certificates, and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    git \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Install Gitleaks
RUN GITLEAKS_VERSION="8.18.2" && \
    ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then ARCH_NAME="x64"; else ARCH_NAME="arm64"; fi && \
    wget https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${ARCH_NAME}.tar.gz -O gitleaks.tar.gz && \
    tar -xzf gitleaks.tar.gz && \
    mv gitleaks /usr/local/bin/gitleaks && \
    rm gitleaks.tar.gz

# Install Trivy
RUN TRIVY_VERSION="0.49.1" && \
    ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then ARCH_NAME="64bit"; else ARCH_NAME="ARM64"; fi && \
    wget https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${ARCH_NAME}.tar.gz -O trivy.tar.gz && \
    tar -xzf trivy.tar.gz && \
    mv trivy /usr/local/bin/trivy && \
    rm trivy.tar.gz

# Stage 2: Final Runtime Image
FROM node:20-bookworm-slim

# Install system dependencies (git is needed by simple-git, python3/pip-audit for python adapter fallbacks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install pip-audit globally or in a global system space
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir pip-audit

# Copy binaries from the builder stage
COPY --from=builder /usr/local/bin/gitleaks /usr/local/bin/gitleaks
COPY --from=builder /usr/local/bin/trivy /usr/local/bin/trivy

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source code
COPY . .

# Expose port and configure start command
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

# Ensure sqlite databases write to a persistent/writable location if mounted, but fall back to local data/ folder
CMD ["node", "src/index.js"]
