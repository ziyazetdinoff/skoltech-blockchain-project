FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV HOME=/app/.home

RUN mkdir -p /app/.home /app/data /app/deployments
RUN npm run build

CMD ["npm", "run", "compile"]
