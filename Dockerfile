FROM node:latest AS builder

RUN apt-get update && \
    apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:latest

RUN apt-get update && \
    apt-get install -y ffmpeg

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN npm install --only=production

EXPOSE 5000

CMD ["node", "dist/server.js"]
