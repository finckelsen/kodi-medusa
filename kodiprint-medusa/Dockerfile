FROM node:22-slim

WORKDIR /app

# Copy only package.json (no lockfile — forces npm to resolve
# all optional platform-specific deps correctly for linux)
COPY package.json ./

RUN npm install

COPY . ./

# Build Medusa
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

EXPOSE 9000

CMD ["npm", "run", "start"]
