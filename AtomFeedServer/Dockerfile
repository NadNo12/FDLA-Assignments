FROM oven/bun:1.0.11
WORKDIR /app

COPY --from=node:18 /usr/local/bin/node /usr/local/bin/node

COPY package.json ./
COPY bun.lockb ./

RUN bun install

COPY src ./src
COPY prisma ./prisma

RUN bunx prisma generate

EXPOSE 3000
CMD ["bun", "run", "--watch", "src/main.ts"]
