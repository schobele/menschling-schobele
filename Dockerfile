FROM oven/bun:1 AS base

# Install Node.js (required by Claude CLI), git, ssh, cron
RUN apt-get update && apt-get install -y \
    curl \
    git \
    openssh-client \
    cron \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally via npm
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Link mensch CLI
RUN bun link

# Make scripts executable
RUN chmod +x scripts/entrypoint.sh scripts/shutdown.sh scripts/auto-commit.sh

EXPOSE 3200

ENTRYPOINT ["scripts/entrypoint.sh"]
