FROM oven/bun:1.0.7
WORKDIR /app

COPY --from=node:18 /usr/local/bin/node /usr/local/bin/node

COPY package.json ./
COPY bun.lockb ./
COPY src ./

RUN bun install

RUN bunx prisma generate

RUN rm -rf /usr/local/bin/node

EXPOSE 3000
CMD ["bun", "run", "--watch", "main.ts"]
