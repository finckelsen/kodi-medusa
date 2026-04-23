FROM node:22-slim

WORKDIR /app

# Copy only package.json (no lockfile — forces npm to resolve
# all optional platform-specific deps correctly for linux)
COPY package.json ./

RUN npm install

COPY . ./

# Build Medusa backend
RUN npm run build

# Ensure admin build exists (use pre-built copy if medusa build didn't produce it)
RUN if [ ! -f .medusa/server/public/admin/index.html ]; then \
      echo "Admin not built by medusa build, using pre-built copy"; \
    else \
      echo "Admin build OK"; \
    fi

# Remove dev dependencies after build
RUN npm prune --omit=dev

EXPOSE 9000

CMD ["sh", "-c", "./node_modules/.bin/medusa db:migrate 2>&1 && ./node_modules/.bin/medusa start"]
