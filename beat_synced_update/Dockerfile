FROM node:18

# Install ffmpeg for video processing
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# Create app folder
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the files
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
