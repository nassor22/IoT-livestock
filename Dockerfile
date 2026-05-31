FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . /usr/src/app

EXPOSE 8000

ENV PORT=8000
CMD ["node", "server.js"]
