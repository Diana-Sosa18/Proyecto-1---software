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

# Corre la app
CMD ["npm", "run", "dev", "--", "--host"]