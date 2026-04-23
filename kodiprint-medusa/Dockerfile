FROM node:22-slim

WORKDIR /app

# Copy only package.json (no lockfile — forces npm to resolve
# all optional platform-specific deps correctly for linux)
COPY package.json ./

RUN npm install

COPY . ./

# Build Medusa (backend + admin dashboard)
RUN npm run build

# medusa build puts admin in .medusa/server/public/admin/
# but medusa start looks for it in ./public/admin/
RUN cp -r .medusa/server/public/admin ./public/admin

EXPOSE 9000

CMD ["sh", "-c", "./node_modules/.bin/medusa db:migrate 2>&1 && ./node_modules/.bin/medusa start"]
