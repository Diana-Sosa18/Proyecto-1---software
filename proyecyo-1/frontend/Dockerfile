# Usa Node
FROM node:20

# Carpeta de trabajo
WORKDIR /app

# Copia dependencias
COPY package*.json ./

# Instala dependencias
RUN npm install

# Copia todo
COPY . .

RUN npm run build

# Expone puerto de Vite
EXPOSE 5173

# Sirve el artefacto inmutable ya construido.
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
