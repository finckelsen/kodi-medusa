FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --omit=dev

COPY . ./

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start"]
