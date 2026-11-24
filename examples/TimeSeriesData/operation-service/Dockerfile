FROM node:24-alpine
WORKDIR /app
COPY package.json server.ts initialize.ts operation.json ./
USER node
EXPOSE 8080
CMD ["node", "server.ts"]
