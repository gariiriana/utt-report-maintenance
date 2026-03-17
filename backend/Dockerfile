FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Expose Vite port
EXPOSE 5173

# Run Vite with --host to allow access from outside the container
CMD ["npm", "run", "dev", "--", "--host"]
