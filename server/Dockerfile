FROM node:22-alpine AS base
WORKDIR /app

# install deps
COPY package*.json ./
RUN npm ci --omit=dev

# copy source
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4001
CMD ["node","src/server.js"]
