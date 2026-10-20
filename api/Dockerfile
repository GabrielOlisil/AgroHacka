# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Força NODE_ENV=development no build para garantir que devDependencies (@nestjs/cli, typescript) sejam instaladas
ENV NODE_ENV=development

# Instala openssl para o Prisma Client
RUN apk add --no-cache openssl

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

RUN npm install --include=dev

COPY src ./src/

RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime de Produção
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Executa migração do schema e inicia a API
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && node dist/main.js"]
