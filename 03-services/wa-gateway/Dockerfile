FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
RUN mkdir -p sessions
EXPOSE 5000
CMD ["node", "src/index.js"]
