FROM node:20-alpine

# Baileys butuh git saat npm install
RUN apk add --no-cache git

WORKDIR /app

COPY package.json ./
RUN npm install --production --ignore-scripts

COPY index.js ./
RUN mkdir -p auth_info_baileys

EXPOSE 5000
CMD ["node", "index.js"]