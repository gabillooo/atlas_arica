# ATLAS Arica — PP10 Etapa I

Aplicación web de seguimiento de pavimentos asfálticos en Arica.
React + Vite + Tailwind CSS + Leaflet (OpenStreetMap).

## Requisitos

- **Node.js 18+** → https://nodejs.org (versión LTS)
- **VS Code** → https://code.visualstudio.com

## Correr localmente

```bash
npm install
npm run dev
```

Abrir en el navegador: **http://localhost:5173**

## Compilar para producción

```bash
npm run build
```

Genera `dist/` lista para subir a Netlify, Vercel, etc.

## Estructura

```
src/
  app/App.tsx            ← Todo el código de la app
  styles/
    index.css            ← Entrada CSS
    tailwind.css         ← Tailwind v4
    theme.css            ← Variables de color/tipografía
    leaflet-custom.css   ← Estilos del mapa
    fonts.css            ← Fuentes
vite.config.ts
package.json
```
