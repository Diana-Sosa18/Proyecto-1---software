# Comandos de inicializacion

## Backend

```powershell
cd backend
npm init -y
npm install express dotenv mysql2
npm install -D nodemon
```

## Frontend

```powershell
cd frontend
npm init -y
npm install react react-dom
npm install -D vite typescript @types/react @types/react-dom @vitejs/plugin-react tailwindcss postcss autoprefixer
```

## Instalar dependencias para generar node_modules

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Ejecutar proyecto

```powershell
cd backend
npm run dev

cd ..\frontend
npm run dev
```
