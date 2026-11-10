# Build & Production Stage
FROM node:22-alpine

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code source et build (Vite Client + TypeScript Server)
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
