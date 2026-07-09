# Use official Node.js image as the base
FROM node:20-slim

# Install LibreOffice and standard fonts for high-quality document conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-dejavu \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose port (Render/Railway will use PORT env var, fallback to 3001 in index.js)
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]
