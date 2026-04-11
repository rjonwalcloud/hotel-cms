FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY scripts ./scripts

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start command (will be overridden by docker-compose)
CMD ["npm", "start"]
