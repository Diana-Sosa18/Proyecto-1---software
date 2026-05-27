# Usa Node
FROM node:18

# Carpeta de trabajo
WORKDIR /app

# Copia dependencias
COPY package*.json ./

# Instala dependencias
RUN npm install

# Copia todo
COPY . .

# Expone puerto de Vite
EXPOSE 5173

# Corre una version servida sin watcher para evitar ENOMEM en Docker Desktop
CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port 5173"]
