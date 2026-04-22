FROM node:22-slim

WORKDIR /app

# Copy only package.json (no lockfile — forces npm to resolve
# all optional platform-specific deps correctly for linux)
COPY package.json ./

RUN npm install

COPY . ./

# Build Medusa (backend + admin dashboard)
RUN npm run build 2>&1 | tail -30

# Debug: show what was built
RUN echo "=== Build output ===" && \
    ls -la .medusa/ 2>/dev/null || echo "No .medusa dir" && \
    ls -la .medusa/server/public/admin/ 2>/dev/null || echo "No admin build found" && \
    find .medusa -name "index.html" 2>/dev/null || echo "No index.html anywhere in .medusa"

# Remove dev dependencies after build
RUN npm prune --omit=dev

EXPOSE 9000

CMD ["sh", "-c", "./node_modules/.bin/medusa db:migrate 2>&1 && ./node_modules/.bin/medusa start"]
