FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Install ALL dependencies (dev needed for medusa build)
RUN npm install

COPY . ./

# Build Medusa (needs typescript, swc, vite from devDeps)
RUN npm run build

# Remove dev dependencies after build to slim down image
RUN npm prune --omit=dev

EXPOSE 9000

CMD ["npm", "run", "start"]
