# Cómo Verificar que las Coordenadas son Correctas

## ✅ Método Rápido: Usar OpenStreetMap

1. Abre **OpenStreetMap**: https://www.openstreetmap.org/
2. En el cuadro de búsqueda, escribe: `Arica, Chile`
3. Haz zoom hasta ver las calles del centro
4. Haz clic derecho sobre cualquier punto del mapa
5. Selecciona **"Mostrar dirección" o "Show address"**
6. Verás las coordenadas exactas en formato: `-18.4750, -70.3100`

## 🔍 Verificar una Calle Específica

### Ejemplo: Av. Comandante San Martín

1. Busca en OpenStreetMap: `Comandante San Martín, Arica`
2. Verás que es la **avenida costera** que bordea el Pacífico
3. Las coordenadas aproximadas son: **-18.4720, -70.3175**
4. Puedes hacer clic en varios puntos de la avenida para ver que las coordenadas coinciden

### Ejemplo: Av. 21 de Mayo

1. Busca: `21 de Mayo, Arica`
2. Es una calle principal del **centro**
3. Coordenadas aproximadas: **-18.4750, -70.3095**

## 📍 Formato de Coordenadas en ATLAS

```typescript
{
  street: "Av. Comandante San Martín",
  startLat: -18.4725,  // Latitud punto inicio
  startLng: -70.3185,  // Longitud punto inicio
  endLat: -18.4715,    // Latitud punto final
  endLng: -70.3165     // Longitud punto final
}
```

### ¿Qué significa cada valor?

- **Latitud negativa** (-18.xxxx): Indica que está en el **hemisferio sur**
- **Longitud negativa** (-70.xxxx): Indica que está al **oeste del meridiano de Greenwich**
- Arica está aproximadamente en: **-18.47° S, -70.31° W**

## 🗺️ Cómo Verificar en el Mapa de ATLAS

1. Abre la aplicación ATLAS Arica
2. El mapa se carga centrado en el centro de Arica
3. Verás las **líneas de colores** (tramos de calles)
4. Haz **zoom** para acercarte
5. Las líneas deben estar **exactamente sobre las calles** del mapa base

### ✅ Señales de que las coordenadas son correctas:

- ✅ Las líneas de tramos están **sobre las calles**, no sobre edificios o mar
- ✅ Al hacer clic en un tramo, el nombre coincide con la calle del mapa
- ✅ La **Av. Comandante San Martín** está junto al mar (costa)
- ✅ Las calles del **centro** están agrupadas en el área urbana

### ❌ Señales de que las coordenadas están mal:

- ❌ Las líneas aparecen en el **océano Pacífico**
- ❌ Las líneas están en **zonas vacías** sin calles
- ❌ Los nombres no coinciden con el mapa base
- ❌ Las calles están muy **dispersas** o fuera de Arica

## 🛠️ Herramientas para Validar Coordenadas

### 1. OpenStreetMap (Recomendado)
- URL: https://www.openstreetmap.org/#map=15/-18.4750/-70.3100
- Gratuito, actualizado, usado por ATLAS

### 2. Google Maps
- Búsqueda: `Arica, Chile`
- Haz clic derecho > "¿Qué hay aquí?"
- Muestra coordenadas en formato: `-18.4750, -70.3100`

### 3. GPS Coordinates (Web)
- URL: https://www.gps-coordinates.net/
- Ingresa dirección y obtén coordenadas

### 4. GPS en Terreno
- Si estás en Arica físicamente
- Usa la app de **GPS Status** en Android
- O la app **Compass** en iOS
- Compara con las coordenadas en ATLAS

## 📊 Rangos Válidos para Arica

### Latitud (Norte-Sur)
- **Centro de Arica**: -18.4750
- **Límite Norte**: ~ -18.460
- **Límite Sur**: ~ -18.490
- **Rango total**: -18.46 a -18.49

### Longitud (Este-Oeste)
- **Centro de Arica**: -70.3100
- **Costa (oeste)**: ~ -70.320
- **Interior (este)**: ~ -70.280
- **Rango total**: -70.28 a -70.32

### ⚠️ Si tus coordenadas están fuera de estos rangos:
- Probablemente están **incorrectas**
- No apuntarán a Arica
- Revisa que el signo negativo esté correcto

## 🔄 Cómo Actualizar Coordenadas Incorrectas

Si encuentras que una calle está mal ubicada:

1. Abre `src/app/App.tsx`
2. Busca el array `mockSegments`
3. Encuentra la calle incorrecta
4. Actualiza `startLat`, `startLng`, `endLat`, `endLng`
5. Usa OpenStreetMap para obtener las coordenadas correctas
6. Guarda y recarga la aplicación

### Ejemplo de corrección:

```typescript
// ❌ ANTES (incorrecto)
{
  street: "Av. 21 de Mayo",
  startLat: -18.5000,  // Fuera de rango
  startLng: -70.2000,  // Muy al este
  // ...
}

// ✅ DESPUÉS (correcto)
{
  street: "Av. 21 de Mayo",
  startLat: -18.4755,  // Centro de Arica
  startLng: -70.3105,  // Longitud correcta
  // ...
}
```

## 📞 Soporte

Si tienes dudas sobre las coordenadas:

1. Verifica en **OpenStreetMap** primero
2. Compara con **Google Maps** como segunda referencia
3. Consulta el archivo `CALLES_ARICA.md` para coordenadas documentadas
4. Si el error persiste, reporta en GitHub Issues del proyecto

## 📚 Referencias

- **OpenStreetMap Arica**: https://www.openstreetmap.org/#map=14/-18.4750/-70.3100
- **Sistema de coordenadas WGS84**: Estándar internacional GPS
- **Formato decimal degrees**: Más preciso que grados/minutos/segundos

---

**Última actualización**: 18 de Mayo 2026  
**Equipo ATLAS Arica**
