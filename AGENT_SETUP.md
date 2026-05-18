# 🎯 Agente de IA Mejorado - Guía Rápida

## ¿Qué se ha mejorado?

Tu agente de IA ahora es un **Analista de Datos Senior** profesional que:

✅ Genera análisis estratégicos profundos
✅ Sugiere automáticamente reportes relevantes  
✅ Proporciona recomendaciones accionables
✅ Identifica automáticamente anomalías y riesgos
✅ Hace preguntas de seguimiento inteligentes

---

## 🚀 Usar el Agente Mejorado

### 1. Abre el Chat
```
Navega a cualquier página del dashboard
Haz clic en el icono de chat en la esquina inferior derecha
```

### 2. Ejemplos de Preguntas Profesionales

```
📊 "¿Cómo va el desempeño operativo de hoy vs ayer?"
📈 "Analiza los KPIs principales del mes actual"
⚠️ "¿Hay patrones anormales en cancelaciones?"
🎯 "¿Qué acciones recomendarías para mejorar ventas?"
🔗 "Compara esta semana vs la semana anterior"
```

### 3. Respuesta Profesional

Cada análisis incluye:
- **Resumen Ejecutivo**: Hallazgo principal + métrica clave
- **Análisis Detallado**: Causas, patrones, contexto
- **Hallazgos Clave**: 3+ insights identificados
- **Recomendaciones**: Acciones priorizadas
- **Reportes Sugeridos**: Para profundizar
- **Preguntas Inteligentes**: De seguimiento contextual

---

## 📚 Documentación

### Para Usuarios
**Archivo:** `AI_AGENT_GUIDE.md`

Incluye:
- Cómo usar el agente
- Tipos de análisis disponibles
- Catálogo de 30+ reportes
- Mejores prácticas
- Ejemplos reales

### Para Desarrolladores
**Archivo:** `AGENT_IMPROVEMENTS.md`

Incluye:
- Cambios técnicos realizados
- Nuevas funcionalidades
- Ejemplos de código
- Checklist de verificación

---

## ⚙️ Configuración

### Cambiar Modelo IA

El agente usa **Claude (Recomendado)** por defecto.

Para cambiar a GPT-4o:
1. Abre el chat
2. En las sugerencias, busca el selector de modelo
3. O en preferencias de la aplicación

### Agregar Reglas Personalizadas

1. Ve a `/dashboard/system/ai-learning`
2. Agrega palabras clave y reglas específicas de tu negocio
3. El agente las usará automáticamente

---

## 🧪 Probar el Agente

### Test Rápido
```
1. Pregunta: "¿Cómo van las ventas de hoy?"
   Esperado: Análisis con números, hallazgos, recomendaciones

2. Pregunta: "¿Hay algo que requiera atención?"
   Esperado: Detecta anomalías automáticamente

3. Pregunta: "Sugiere reportes para analizar cancelaciones"
   Esperado: Recomienda reportes específicos
```

### Verificar Instalación
```bash
npm run build
```

Si ves "✓ Compiled successfully" → ¡Perfecto!

---

## 🔍 Características Principales

### 1. Análisis Automático Estructurado
El agente genera automáticamente:
- Resumen ejecutivo
- Análisis detallado  
- Hallazgos clave
- Recomendaciones
- Preguntas de seguimiento

### 2. Sugerencias de Reportes Inteligentes
Detecta automáticamente qué reportes son relevantes:
```
Usuario: "¿Hay cancelaciones anormales?"
Agente: Sugiere automáticamente:
  - Alertas de Cancelaciones
  - Tendencias de Cancelaciones
```

### 3. Detección de Anomalías
Identifica automáticamente:
- Sucursales con bajo desempeño
- Productos con problemas
- Patrones anormales
- Riesgos operacionales

### 4. SQL Automático
No necesitas escribir SQL. El agente:
- Genera consultas complejas
- Las ejecuta contra tu BD
- Analiza resultados
- Proporciona insights

---

## 📊 Reportes Disponibles

El agente conoce estos 30+ reportes:

**Ventas (8):** Overview, Operaciones, Heatmap, Tendencias, Comparativa, Metas, Cancelaciones

**Compras (8):** Dashboard, Órdenes, Recibos, Distribución, Rutas, Facturas, Dispersión, Consolidación

**Análisis (2):** Pareto, Departamentos

**Sistema (2):** Historial de Preguntas, Aprendizaje IA

---

## ✨ Casos de Uso

### Diariamente
- "¿Cómo va vs ayer?"
- "¿Hay algo que requiera atención?"

### Semanalmente
- Comparativa semanal vs anterior
- Review de KPIs
- Identificación de tendencias

### Mensualmente
- Análisis completo del mes
- Comparativa año a año
- Evaluación de metas

### Ad-hoc
- Investigación de problemas
- Evaluación de impacto
- Benchmarking entre sucursales

---

## 💡 Consejos Profesionales

### ✅ Haz Estas Preguntas
```
"¿Cómo va X métrica vs período anterior?"
"¿Qué productos necesitan atención?"
"¿Cuál es el impacto de X cambio?"
"¿Qué recomendarías para mejorar X?"
"¿Hay patrones anormales?"
```

### ❌ Evita Estas
```
"¿Cómo va el negocio?" → Mejor: "¿Cómo va vs ayer?"
Preguntas sin período → Especifica: "hoy", "esta semana", etc.
Preguntas de predicción → El agente analiza pasado/presente
```

---

## 🆘 Problemas Comunes

### "El agente no responde"
- Verifica que tengas conexión a BD
- Revisa que el período esté especificado
- Reformula la pregunta más específicamente

### "Los números no parecen correctos"
- El agente ejecuta SQL directo contra tu BD
- Verifica que tus datos sean correctos
- Consulta el SQL que se ejecutó

### "No sugiere reportes"
- Algunos análisis no requieren reportes adicionales
- Prueba preguntas más específicas sobre análisis

---

## 📞 Soporte

Documentación:
- **Usuarios:** Lee `AI_AGENT_GUIDE.md`
- **Desarrolladores:** Lee `AGENT_IMPROVEMENTS.md`

Problemas técnicos:
1. Revisa `AGENT_IMPROVEMENTS.md` - Checklist de verificación
2. Ejecuta `npm run build` para verificar compilación
3. Revisa logs del servidor

---

## 🎯 Próximos Pasos

1. **Abre el chat** y prueba el agente
2. **Lee `AI_AGENT_GUIDE.md`** para mejores prácticas
3. **Configura reglas personalizadas** en `/dashboard/system/ai-learning`
4. **Entrena tu equipo** en el uso del agente

---

**¡Tu agente está listo para revolucionar tu toma de decisiones!** 🚀

Para preguntas: Consulta `AI_AGENT_GUIDE.md`
Para desarrolladores: Consulta `AGENT_IMPROVEMENTS.md`
