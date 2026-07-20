FROM node:18-alpine

WORKDIR /app

# Copy only the pre-built bundle
COPY artifacts/discord-bot/dist/index.js ./index.js

EXPOSE 8080

CMD ["node", "index.js"]
