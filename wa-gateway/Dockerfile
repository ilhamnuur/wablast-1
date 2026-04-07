FROM node:20-alpine

# Install OS dependencies (ffmpeg is useful if handling video/audio media in Baileys)
RUN apk add --no-cache ffmpeg tzdata

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose Backend API port
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]
