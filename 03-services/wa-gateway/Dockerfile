FROM node:20-alpine
WORKDIR /app
# git dibutuhkan npm untuk dependency libsignal (git+https dari Baileys)
RUN apk add --no-cache git
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
RUN mkdir -p sessions
EXPOSE 5000
CMD ["node", "src/index.js"]
