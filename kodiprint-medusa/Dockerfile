FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . ./

RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 9000

CMD ["npm", "run", "start"]
