# Use the official lightweight Node.js 20 image as the base
FROM node:20-slim

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy application dependency manifests (package.json and package-lock.json)
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application code into the container
# This copies your fixed app.cjs file
COPY . .

# Expose the default port (optional but good practice)
EXPOSE 8080

# Define the command to run the application (which uses app.cjs)
CMD [ "npm", "start" ]
