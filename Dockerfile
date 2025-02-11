# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm and copy lockfiles
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# TODO find a way to reuse builds from host / the ci pipeline
# TODO namely the node_modules, dist and pnpm store
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

# Copy dist (built code) and node_modules from builder
COPY --from=builder /app/dist/ ./dist
COPY --from=builder /app/node_modules/ ./node_modules

# By default we use 8080, but this can be overridden by setting the PORT environment variable.
ENV PORT=8080
# Optional parameters for connecting to a already running chord node
# TODO This is currently not fully passed to the application as it is and needs to be fixes in the index.ts
# They are optional and can be set to empty strings
# TODO Evaluate if this is the best way to pass the optional parameters
ENV PEER_HOST=''
ENV PEER_PORT=''

# TODO Check that PEEK_HOST and PEEK_PORT are either both set or both empty
# If they are set, the application will try to connect to the peer node

# Expose the main port so Docker knows it’s intended to be accessible.
EXPOSE ${PORT}

# We pass PORT as the first argument
# Pass the optional parameters as the second and third argument
CMD ["sh", "-c", "node dist/index.js \"$PORT\" \"$HOST\" \"$EXTRA_PORT\""]
