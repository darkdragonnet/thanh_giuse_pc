FROM node:20-alpine

# Install dependencies required for sharp on alpine if needed (libvips/vips-tools)
RUN apk add --no-cache vips-dev build-base python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p uploads/temp

EXPOSE 3000

CMD ["node", "src/app.js"]
