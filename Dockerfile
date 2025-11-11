# Use the official lightweight Node.js 20 image as the base
FROM node:20-slim

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy application dependency manifests (package.json and package-lock.json)
# Copying this first allows Docker to cache the npm install step if dependencies haven't changed.
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application code into the container
COPY . .

# Expose the default port (optional but good practice)
EXPOSE 8080

# Define the command to run the application when the container starts
CMD [ "npm", "start" ]
