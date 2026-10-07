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

# Variable disponible durante el build de Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Construye el frontend con las variables VITE_*
RUN npm run build

# Railway sirve el frontend en el puerto 8080
EXPOSE 8080

# Sirve el artefacto construido
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080"]