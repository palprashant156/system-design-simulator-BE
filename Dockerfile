# --- Build Stage ---
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace/package configuration
COPY package.json pnpm-workspace.yaml* .npmrc* ./

# Copy source and prisma schemas
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.build.json tsconfig.json nest-cli.json ./

# Install dependencies (including devDependencies for building)
RUN pnpm install --no-frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Build the NestJS application
RUN pnpm run build

# Remove development dependencies to keep production image light
RUN pnpm prune --prod

# --- Production Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

ENV NODE_ENV=production

# Copy production package.json and configuration files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose backend port (NestJS bootstrap port)
EXPOSE 3000

# Start command
CMD ["pnpm", "run", "start:prod"]
