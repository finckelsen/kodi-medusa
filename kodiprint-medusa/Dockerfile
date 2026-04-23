FROM node:22-slim

WORKDIR /app

# Copy only package.json (no lockfile — forces npm to resolve
# all optional platform-specific deps correctly for linux)
COPY package.json ./

RUN npm install

COPY . ./

# Build Medusa (backend + admin dashboard)
RUN npm run build

EXPOSE 9000

CMD ["sh", "-c", "./node_modules/.bin/medusa db:migrate 2>&1 && ./node_modules/.bin/medusa start"]
