FROM node:22-slim AS builder

WORKDIR /app

# Copy only medusa package files first for cached npm install
COPY kodiprint-medusa/package.json kodiprint-medusa/package-lock.json ./

RUN npm install

# Copy the rest of medusa source
COPY kodiprint-medusa/ ./

RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 9000

CMD ["npm", "run", "start"]
