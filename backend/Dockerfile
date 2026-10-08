FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source code
COPY src ./src

# Environment
ENV NODE_ENV=production

EXPOSE 3001

# Backend uses ESM (type: module in package.json)
CMD ["node", "src/server.js"]