FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "npm install --include=dev && sed -i 's/\\r$//' node_modules/.bin/vite && npm exec vite -- --host 0.0.0.0"]
