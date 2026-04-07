FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["npm", "start"]
