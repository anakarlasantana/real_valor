FROM node:20-alpine AS base

# Install required build tools and dependencies
RUN apk add --no-cache libc6-compat python3 make g++ git curl

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable && corepack prepare yarn@3.2.1 --activate

# Copy dependency specifications
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install dependencies
RUN yarn install

# Copy application source code
COPY . .

# Expose Medusa port
EXPOSE 9000

# Entrypoint script will handle migrations and starting the server
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["yarn", "dev"]
