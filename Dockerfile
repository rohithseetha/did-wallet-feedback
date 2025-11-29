# Use Node.js LTS version
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (production only)
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Cloud Run uses PORT environment variable
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD [ "npm", "start" ]