/**
 * Tools y prompt del Agente Avanzado.
 *
 * Hereda las tools del agente Kesito (query_database, get_sales_forecast,
 * get_product_recommendations) y añade build_report (valida + preview) y
 * save_report (persiste la definición data-driven en BD).
 *
 * El mismo ADVANCED_TOOLS + system prompt se usa en /estimate (countTokens)
 * y en /run, garantizando que la estimación de costo sea fiel.
 */

import fs from 'fs';
import path from 'path';
import { query, localizeDatesForModel } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import {
    runForecastForAgent,
    getProductRecommendationsForAgent,
    renderForecastSummaryForAgent,
    renderProductRecommendationsForAgent,
} from '@/lib/forecast/agent-tools';
import { createReport, type ReportCostFields } from './reports-store';
import { substituteParams } from './params';
import {
    ADVANCED_REPORT_SCHEMA_VERSION,
    type AdvancedReportDefinition,
    type ReportViz,
} from './types';
import { USD_MXN_RATE } from '@/lib/pricing';

/** Esquema reutilizable de parámetros interactivos del reporte. */
const PARAMS_SCHEMA = {
    type: 'array',
    description: 'Parámetros que hacen el reporte INTERACTIVO en el visor (período, sucursales, producto, proveedor, etc.), SEGÚN aplique al reporte. Usa el token de cada parámetro como {{token}} dentro del SQL.',
    items: {
        type: 'object',
        properties: {
            token: { type: 'string', description: 'nombre del placeholder usado como {{token}} en el SQL (ej. "desde", "hasta", "sucursales", "producto", "proveedor").' },
            label: { type: 'string', description: 'etiqueta para el control en el visor (ej. "Desde", "Sucursales", "Producto contiene").' },
            kind: { type: 'string', enum: ['date', 'storeList', 'text', 'number'], description: 'date=fecha · storeList=multiselección de sucursales · text=filtro por texto (producto/proveedor/cliente/depto) · number=número.' },
            defaultValue: { type: 'string', description: 'valor por defecto: date="YYYY-MM-DD"; storeList="" (todas) o "1,2"; text="" (todas); number="10".' },
        },
        required: ['token', 'label', 'kind'],
    },
};

export const ADVANCED_TOOLS: any[] = [
    {
        name: 'query_database',
        description: 'Ejecuta una consulta T-SQL de SOLO LECTURA (SELECT/WITH) contra SQL Server para explorar datos, validar cifras y diseñar el reporte. Usa SIEMPRE TOP para acotar resultados grandes. Respeta las columnas con corchetes de la vista Ventas (ej. [Fecha Venta], [Folio Venta], [Precio Venta]).',
        input_schema: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'Consulta T-SQL de lectura (SELECT o WITH). Un solo statement, sin ; final.' },
            },
            required: ['sql'],
        },
    },
    {
        name: 'get_sales_forecast',
        description: 'Proyección de ventas oficial (promedio móvil estacional + feriados MX + meta + tendencia + MAPE). Úsala para preguntas sobre el FUTURO de ventas.',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: { type: 'number', description: 'Días a proyectar (1-180). Default 30.' },
                storeNames: { type: 'array', items: { type: 'string' }, description: 'Nombres parciales de sucursales (LIKE). Omite para todas.' },
            },
            required: [],
        },
    },
    {
        name: 'get_product_recommendations',
        description: 'Productos a CARGAR/EMPUJAR/MONITOREAR/REDUCIR para los próximos N días, cruzando histórico reciente con el mismo período del año pasado.',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: { type: 'number', description: 'Días futuros (1-180). Default 30.' },
                topN: { type: 'number', description: 'Cuántos productos (5-30). Default 15.' },
                storeNames: { type: 'array', items: { type: 'string' }, description: 'Nombres parciales de sucursales. Omite para todas.' },
            },
            required: [],
        },
    },
    {
        name: 'ask_clarification',
        description: 'Pregunta al usuario cuando falta información o hay decisiones que conviene confirmar para acertarle al reporte: período, sucursal(es), producto(s), proveedor(es), cliente(s), departamento, dimensión de desglose o tipo de gráfica. Ofrece SIEMPRE opciones concretas y cliqueables en "suggestions" para que el usuario solo elija. Úsala ANTES de construir si hay dudas razonables. Puedes (opcionalmente) correr antes un query_database para listar valores reales (p. ej. nombres de sucursales o proveedores) y sugerir esos.',
        input_schema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'Pregunta clara y breve, en español, en tono consultor.' },
                suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-6 opciones concretas y cliqueables (ej. "Este mes", "Mes pasado", "Por sucursal", "Gráfica de barras", "Bodega 238").',
                },
            },
            required: ['question'],
        },
    },
    {
        name: 'build_report',
        description: 'VALIDA y previsualiza el SQL candidato del reporte ANTES de proponerlo: ejecuta la consulta (read-only, con los valores por defecto de los parámetros) y devuelve filas, columnas y muestra. Pasa los mismos params que usarás en propose_report.',
        input_schema: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'SQL final del reporte (SELECT/WITH, un statement, sin ; final). Puede usar tokens {{token}} de los parámetros.' },
                params: PARAMS_SCHEMA,
            },
            required: ['sql'],
        },
    },
    {
        name: 'propose_report',
        description: 'PROPONE el reporte ya diseñado y validado para que el usuario lo confirme. NO lo guardes tú: tras llamar a build_report y verificar que el SQL corre, llama propose_report con la definición completa. El usuario elegirá el modelo de generación, el nombre y verá el costo antes de crearlo. Llama esta tool cuando el reporte esté listo.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Nombre de negocio del reporte (ej. "Ventas por sucursal — Mayo").' },
                description: { type: 'string', description: 'Descripción corta de qué muestra el reporte.' },
                sql: { type: 'string', description: 'El MISMO SQL validado con build_report (SELECT/WITH, un statement, sin ; final).' },
                visualization: { type: 'string', enum: ['table', 'bar', 'line', 'pie', 'area', 'treemap'], description: 'Cómo se grafica: bar=comparativas · line/area=series temporales · pie=distribución · treemap=rectángulos proporcionales (cuando el usuario pida "rectángulos", "treemap" o "mapa de árbol") · table=detalle.' },
                blocks: {
                    type: 'array',
                    description: 'OPCIONAL — SOLO para reportes AVANZADOS tipo TABLERO con varias vistas. Cada bloque tiene su PROPIA consulta y visualización; los "params" del reporte son GLOBALES (un solo control de período/sucursal mueve TODOS los bloques, usando los mismos {{token}} en cada SQL). VALIDA CADA bloque con build_report antes de proponer (puedes encadenar varios build_report en el mismo turno). Orden recomendado: kpis arriba → chart de tendencia → chart de ranking → table de detalle → narrative. Máx 6 bloques. Si una sola vista basta, NO uses blocks: usa sql + visualization.',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'identificador corto y estable del bloque (ej. "kpis", "tendencia", "top", "detalle", "proyeccion").' },
                            type: { type: 'string', enum: ['kpis', 'chart', 'table', 'narrative', 'forecast'], description: 'kpis=tarjetas de indicadores · chart=gráfica · table=tabla de detalle · narrative=comentario del analista · forecast=proyección de ventas a futuro (motor del dashboard; NO lleva sql).' },
                            title: { type: 'string', description: 'Título del bloque (ej. "Tendencia diaria", "Top 10 productos", "Proyección próximos 30 días").' },
                            sql: { type: 'string', description: 'SELECT/WITH del bloque (un statement, sin ; final). Usa los {{token}} de los params globales. No aplica a type narrative ni forecast.' },
                            visualization: { type: 'string', enum: ['table', 'bar', 'line', 'pie', 'area', 'treemap'], description: 'Para type chart (y forecast; default area).' },
                            forecast: {
                                type: 'object',
                                description: 'SOLO para type forecast: proyección de ventas a futuro (no usa SQL; el sistema corre el modelo). No requiere build_report.',
                                properties: {
                                    horizonDays: { type: 'number', description: 'Días a proyectar (1-180). "semana"=7, "quincena"=15, "mes"=30, "trimestre"=90. Default 30.' },
                                    storeNames: { type: 'array', items: { type: 'string' }, description: 'Nombres parciales de sucursales (LIKE). Omite para usar el filtro global de sucursales del tablero.' },
                                },
                            },
                            chartConfig: {
                                type: 'object',
                                description: 'Opciones de presentación del bloque.',
                                properties: {
                                    showValues: { type: 'boolean' },
                                    showPercent: { type: 'boolean' },
                                    lockViz: { type: 'boolean' },
                                    withTable: { type: 'boolean' },
                                },
                            },
                            kpis: {
                                type: 'array',
                                description: 'Para type kpis: tarjetas calculadas sobre las filas del bloque.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        label: { type: 'string' },
                                        column: { type: 'string' },
                                        agg: { type: 'string', enum: ['sum', 'avg', 'min', 'max', 'count'] },
                                        format: { type: 'string', enum: ['currency', 'number', 'percent'] },
                                    },
                                    required: ['label', 'column', 'agg'],
                                },
                            },
                            expectedColumns: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        key: { type: 'string' },
                                        label: { type: 'string' },
                                        role: { type: 'string', enum: ['dimension', 'measure', 'temporal'] },
                                        format: { type: 'string', enum: ['currency', 'number', 'percent', 'date', 'text'] },
                                    },
                                    required: ['key', 'role'],
                                },
                            },
                            drill: {
                                type: 'object',
                                description: 'OPCIONAL — DRILL-DOWN del bloque: al hacer clic en una categoría (barra/rebanada/fila) abre el detalle. "sql" usa el token {{clicked}} (valor clickeado; el sistema lo entrecomilla) y puede usar los {{token}} de los params globales. Filtra por la MISMA columna que es la dimensión/eje del bloque (ej. si agrupa por Tienda: ...WHERE Tienda = {{clicked}}).',
                                properties: {
                                    sql: { type: 'string', description: 'SELECT/WITH de detalle (un statement, sin ; final) con {{clicked}}.' },
                                    title: { type: 'string', description: 'Título del panel; puede incluir {{clicked}} (ej. "Ventas de {{clicked}}").' },
                                    visualization: { type: 'string', enum: ['table', 'bar', 'line', 'pie', 'area', 'treemap'], description: 'Cómo mostrar el detalle (default table).' },
                                },
                                required: ['sql'],
                            },
                        },
                        required: ['id', 'type'],
                    },
                },
                expectedColumns: {
                    type: 'array',
                    description: 'Columnas del SELECT en ORDEN (la primera suele ser la dimensión/eje X; las numéricas, las series).',
                    items: {
                        type: 'object',
                        properties: {
                            key: { type: 'string' },
                            label: { type: 'string' },
                            role: { type: 'string', enum: ['dimension', 'measure', 'temporal'] },
                            format: { type: 'string', enum: ['currency', 'number', 'percent', 'date', 'text'] },
                        },
                        required: ['key', 'role'],
                    },
                },
                insights: { type: 'array', items: { type: 'string' }, description: '2-4 hallazgos clave con cifras.' },
                recommendations: { type: 'array', items: { type: 'string' }, description: '1-3 acciones recomendadas.' },
                suggestedQuestions: { type: 'array', items: { type: 'string' }, description: '2-3 preguntas de seguimiento.' },
                params: PARAMS_SCHEMA,
                chartConfig: {
                    type: 'object',
                    description: 'Opciones de PRESENTACIÓN de la gráfica (ajústalas según pida el usuario sobre cómo se ve).',
                    properties: {
                        showValues: { type: 'boolean', description: 'Mostrar las cantidades/valores sobre la gráfica. Actívalo si pide "pon las cantidades", "muestra los valores", "que se vean los números".' },
                        showPercent: { type: 'boolean', description: 'Mostrar los valores como PORCENTAJE del total. Actívalo si pide "ponlo en porcentaje", "que sea %".' },
                        lockViz: { type: 'boolean', description: 'Mostrar SOLO el tipo de gráfica elegido y ocultar el selector. Actívalo si pide "solo muéstrame la gráfica de X", "déjalo fijo en treemap".' },
                        withTable: { type: 'boolean', description: 'Mostrar la TABLA debajo de la gráfica (las dos juntas). Actívalo si pide "muéstrame también la tabla", "gráfica y tabla juntas".' },
                    },
                },
                kpis: {
                    type: 'array',
                    description: 'Tarjetas KPI que se muestran ARRIBA del reporte, calculadas sobre las filas. Úsalas si el usuario pide "tarjetas", "indicadores", "totales arriba", "resumen".',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string', description: 'Nombre de la tarjeta (ej. "Venta total", "Ticket promedio").' },
                            column: { type: 'string', description: 'Columna numérica del SELECT sobre la que se calcula.' },
                            agg: { type: 'string', enum: ['sum', 'avg', 'min', 'max', 'count'], description: 'Agregación: sum=total, avg=promedio, max/min, count=número de filas.' },
                            format: { type: 'string', enum: ['currency', 'number', 'percent'] },
                        },
                        required: ['label', 'column', 'agg'],
                    },
                },
                drill: {
                    type: 'object',
                    description: 'OPCIONAL — DRILL-DOWN del reporte (single, sin blocks): al hacer clic en una categoría (barra/rebanada/fila) abre el detalle. "sql" usa el token {{clicked}} (valor clickeado; el sistema lo entrecomilla) y puede usar los {{token}} de los params. Filtra por la MISMA columna que es la dimensión/eje (ej. ...WHERE Tienda = {{clicked}}).',
                    properties: {
                        sql: { type: 'string', description: 'SELECT/WITH de detalle (un statement, sin ; final) con {{clicked}}.' },
                        title: { type: 'string', description: 'Título del panel; puede incluir {{clicked}} (ej. "Ventas de {{clicked}}").' },
                        visualization: { type: 'string', enum: ['table', 'bar', 'line', 'pie', 'area', 'treemap'], description: 'Cómo mostrar el detalle (default table).' },
                    },
                    required: ['sql'],
                },
                complexity: {
                    type: 'string',
                    enum: ['baja', 'media', 'alta'],
                    description: 'Complejidad del reporte para RECOMENDAR el modelo de generación. baja=1 tabla y agregación simple · media=varias columnas/períodos o joins ligeros · alta=múltiples joins, series temporales, causa raíz o comparativas complejas.',
                },
                complexityReason: { type: 'string', description: 'Una frase corta de por qué esa complejidad.' },
            },
            required: ['title', 'sql', 'visualization'],
        },
    },
];

/** Las mismas tools en formato de function-calling de OpenAI. */
export const ADVANCED_OPENAI_TOOLS: any[] = ADVANCED_TOOLS.map((t) => ({
    type: 'function',
    function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
    },
}));

const ALLOWED_VIZ: ReportViz[] = ['table', 'bar', 'line', 'pie', 'area', 'treemap'];
export function normalizeViz(v: unknown): ReportViz {
    return ALLOWED_VIZ.includes(v as ReportViz) ? (v as ReportViz) : 'table';
}

let cachedSchema: string | null = null;
/** Lee database-schema-ia.md (cacheado en memoria). Igual que /api/query. */
export function getAdvancedSchemaString(): string {
    if (cachedSchema !== null) return cachedSchema;
    try {
        cachedSchema = fs.readFileSync(path.join(process.cwd(), 'database-schema-ia.md'), 'utf-8');
    } catch {
        cachedSchema = '';
    }
    return cachedSchema;
}

export function buildAdvancedSystemPrompt(schemaString: string): string {
    return `Eres KESITO, el AGENTE AVANZADO de KYK: una EXTENSIÓN de Claude que actúa como
analista de retail senior. Conversas, SUGIERES y CONSTRUYES reportes para un dueño de negocio
SIN conocimientos técnicos. Eres proactivo y consultivo: no esperas instrucciones perfectas,
ayudas a definir el reporte. Al final GUARDAS un reporte reutilizable (aparece en "Mis Reportes").

TONO: cálido, cercano y profesional. Tutea. Español de México. Nada de jerga técnica ni SQL al usuario.

CÓMO TRABAJAS (sé interactivo, no un ejecutor mudo):
1. ENTIENDE Y SUGIERE. Lee la petición. Si hay dudas razonables o decisiones que mejorarían el
   reporte, usa la tool ask_clarification con OPCIONES concretas y cliqueables. Pregunta por lo que
   aplique al reporte pedido:
     • Período (Hoy / Este mes / Mes pasado / Este año / Rango específico)
     • Alcance: ¿todas las sucursales o algunas? (puedes listar nombres reales con query_database)
     • Dimensión de desglose: por sucursal / departamento / producto / proveedor / cliente / día
     • Filtros: ¿algún producto, proveedor, cliente o departamento en particular?
     • Tipo de gráfica recomendada (y por qué), ofreciendo alternativas
   Agrupa en 1-2 preguntas útiles con buenas sugerencias; no interrogues de más. Si quieres sugerir
   valores REALES (sucursales, proveedores, top productos), corre primero un query_database breve y
   ofrécelos como opciones.
2. PROPÓN. Cuando tenga sentido, propón tú una configuración por defecto ("te sugiero ventas netas
   por sucursal de este mes en barras; ¿lo ajustamos?") en vez de dejar al usuario en blanco.
3. DISEÑA Y PROPÓN. Cuando ya esté claro (el usuario confirmó o la petición no tiene ambigüedad),
   valida el SQL con build_report (confirma que corre y trae filas; corrige si falla o sale vacío) y
   luego llama propose_report con la definición completa (título sugerido de negocio, SQL validado,
   visualización adecuada, expectedColumns en orden, insights, recommendations, suggestedQuestions).
   NO guardas tú el reporte: con propose_report se lo presentas al usuario, que elegirá el modelo de
   generación, le pondrá nombre y verá el costo antes de crearlo. Incluye SIEMPRE "complexity"
   (baja/media/alta) según lo elaborado del reporte (joins, series, comparativas, causa raíz) para
   recomendar el modelo adecuado.

CUÁNDO PREGUNTAR vs. PROCEDER:
- Si el período NO está claro y no es deducible → pregunta (con opciones de período).
- Si hay varias formas razonables de desglosar/graficar → propón una y ofrece alternativas.
- Si la petición ya es específica ("ventas de hoy por sucursal en barras") → procede sin preguntar.
- No preguntes lo que ya te dijeron en la conversación.

REGLA CRÍTICA DE ACCIÓN (no te quedes en plática):
- NUNCA respondas solo con texto de cortesía ("perfecto, lo preparo") sin actuar. Si ya tienes lo
  necesario, EN EL MISMO TURNO encadena las tools: query_database → build_report → propose_report.
- Si el usuario ACABA de responder tu ask_clarification, NO vuelvas a preguntar lo mismo: diseña y
  PROPÓN el reporte con esa respuesta.
- Usa ask_clarification SOLO cuando realmente falte información. Una vez resuelta, avanza hasta
  propose_report. El turno no debe terminar "en el aire" si ya puedes proponer el reporte.

ENFOQUE: EL REPORTE SIEMPRE DEBE SER DINÁMICO. Guía al usuario en el armado y propón un reporte
interactivo por defecto:
- Incluye SIEMPRE que aplique un período ajustable: params 'desde'/'hasta' (el visor pone botones de
  período automáticamente). Úsalo en el SQL como [Fecha Venta] >= {{desde}} AND [Fecha Venta] <= {{hasta}}.
- Agrega los filtros relevantes al tema: sucursales (storeList) y, según el reporte, producto / proveedor
  / cliente / departamento (text; el de departamento muestra botones automáticos).
- Considera tarjetas KPI arriba (total, promedio, etc.) y mostrar tabla + gráfica juntas cuando aporten.
- SÉ PROACTIVO sugiriendo el armado: si la petición es general, usa ask_clarification para ofrecer
  opciones de dinamismo como chips (ej. "Con filtro de período", "Por sucursal", "Con KPIs arriba",
  "Tabla + gráfica", "Filtro por departamento"). Propón buenos defaults dinámicos; no interrogues de más.
- En "suggestedQuestions" SIEMPRE incluye 2-3 mejoras de dinamismo accionables y concretas (ej.
  "Agrégale filtro por producto", "Ponle botones de período", "Muéstrame también la tabla",
  "Agrega tarjetas KPI de total y promedio", "Permíteme filtrar por departamento").

REGLAS DE SQL:
- SOLO lectura: SELECT o WITH. Un solo statement, SIN ';' final. Nada de INSERT/UPDATE/DDL/EXEC.
- Acota con TOP cuando el resultado pueda ser grande.
- Montos en MXN. Para "Top más vendidos" ordena por SUM(Total) DESC (ingreso), nunca por unidades.
- Respeta los nombres con corchetes/espacios de la vista Ventas: [Fecha Venta], [Folio Venta],
  [Precio Venta], [Codigo Barras], etc.

REGLAS DE VISUALIZACIÓN: bar=comparar categorías · line/area=series temporales · pie=distribución
porcentual · treemap=rectángulos proporcionales (usa 'treemap' SIEMPRE que el usuario pida
"rectángulos", "treemap" o "mapa de árbol") · table=detalle multi-columna. La primera columna del
SELECT es el eje/dimensión.

PRESENTACIÓN (chartConfig) — ajusta cómo se VE la gráfica según pida el usuario:
- "pon las cantidades / muestra los valores / que se vean los números" → chartConfig.showValues = true
- "ponlo en porcentaje / que sea %" → chartConfig.showPercent = true
- "solo gráfica de pastel / solo pastel / déjalo en pie / solo muéstrame X / fíjalo en X" → pon
  visualization al tipo pedido (pie/bar/line/area/treemap) Y chartConfig.lockViz = true.
Cuando edites un reporte existente y el usuario pida un cambio de presentación, CONSERVA el resto de
chartConfig y del reporte; solo cambia lo pedido.

COMPONENTES que puedes agregar al reporte (eres una extensión de Claude que diseña la pantalla):
- TARJETAS KPI arriba: declara "kpis" (label, column numérica, agg sum/avg/max/min/count, format).
  Úsalas para "ponme indicadores/tarjetas/totales arriba".
- TABLA + GRÁFICA juntas: chartConfig.withTable = true cuando pida ver la tabla junto a la gráfica.
- FILTRO RÁPIDO POR DEPARTAMENTO: declara un param kind 'text' con token/label de departamento
  (ej. token "departamento") usado en el SQL como AND Depto LIKE {{departamento}}; el visor muestra
  AUTOMÁTICAMENTE botones con los departamentos reales (un clic filtra; "Todos" limpia).
- MODAL DE DETALLE: ya es automático — al hacer clic en una fila de la tabla se abre un modal con su
  detalle. Si el usuario quiere ver detalle por fila, asegúrate de incluir la tabla (withTable o viz table).

REPORTES MULTI-BLOQUE (TABLEROS) — cuando una sola gráfica NO alcanza:
- Úsalos para peticiones tipo "reporte completo", "tablero", "dashboard", "panorama general", o
  cuando el usuario hace VARIAS preguntas que conviene responder juntas en una sola pantalla.
- En propose_report llena el arreglo "blocks": cada bloque es una vista con su PROPIO sql y su
  propia visualization. Los "params" siguen siendo GLOBALES: declara período/sucursal/etc. UNA vez a
  nivel reporte y usa los MISMOS {{token}} en el SQL de cada bloque → un solo control mueve todo.
- Estructura recomendada (de arriba hacia abajo):
    1) type 'kpis'  → totales del período (venta total, ticket promedio, # tickets) con sus "kpis".
    2) type 'chart' → tendencia temporal (line/area).
    3) type 'chart' → ranking/comparativa (bar o treemap; ej. top sucursales o productos).
    4) type 'table' → detalle.
    5) type 'narrative' (opcional) → comentario corto del analista.
- BLOQUE DE PROYECCIÓN: usa type 'forecast' (con "forecast": {horizonDays, storeNames}) para incluir la
  PROYECCIÓN DE VENTAS A FUTURO del dashboard dentro del tablero (ej. "y agrégame la proyección del
  próximo mes"). NO lleva sql y NO requiere build_report; el sistema corre el modelo. Si omites
  storeNames, usa el filtro global de sucursales del tablero.
- VALIDA CADA bloque CON SQL con build_report (uno por bloque) antes de proponer; puedes encadenar
  varios build_report en el MISMO turno. Los bloques 'forecast' y 'narrative' no se validan. Máximo 6 bloques.
- Si una sola vista responde la pregunta, NO uses blocks: usa el sql + visualization de siempre.

DRILL-DOWN (detalle al hacer clic): cuando un gráfico/tabla muestre categorías AGREGADAS (por
sucursal, producto, departamento, día…) y aporte poder hacer clic para ver el desglose, declara
"drill" en ESE bloque (o en el reporte single):
- "drill.sql": SELECT de detalle que filtra por la categoría clickeada usando el token {{clicked}}
  en la MISMA columna que es la dimensión/eje del gráfico. Ej. si el bloque agrupa ventas por Tienda:
  SELECT [Fecha Venta], [Folio Venta], Total FROM Ventas WHERE Tienda = {{clicked}}
  AND [Fecha Venta] >= {{desde}} AND [Fecha Venta] <= {{hasta}}  (puede reusar los params globales).
- NO pongas comillas alrededor de {{clicked}} (el sistema lo sustituye por el valor entrecomillado y seguro).
- "drill.title" puede incluir {{clicked}} (ej. "Tickets de {{clicked}}"). "drill.visualization": table por defecto.
- El drill NO se valida con build_report; asegúrate de que la columna del WHERE exista y empate la dimensión del bloque.

¿RECALCULAR O SOLO REDISEÑAR? (tú lo decides):
- Si el cambio toca los DATOS (nuevo filtro, otra dimensión/agrupación, otro período, otra métrica o
  agregación) → SÍ recalcular: usa query_database / build_report y ajusta el SQL.
- Si el cambio es SOLO de PRESENTACIÓN (tipo de gráfica, mostrar valores, porcentaje, qué columna
  graficar, fijar la gráfica) → NO recalcules: NO uses build_report ni query_database; llama
  propose_report DIRECTAMENTE con la definición actualizada y el MISMO sql sin cambios.
- SIEMPRE termina llamando propose_report, aunque el cambio sea mínimo de presentación. Nunca te
  quedes sin proponer cuando el usuario pidió un cambio.

PARÁMETROS INTERACTIVOS (haz el reporte ajustable en el visor):
- Declara en "params" SOLO lo que aplique a ESE reporte y usa su token {{token}} dentro del SQL.
- Período dinámico: casi siempre conviene. Dos params kind 'date' (tokens "desde" y "hasta") y en el
  SQL: [Fecha Venta] >= {{desde}} AND [Fecha Venta] <= {{hasta}}. defaultValue en formato YYYY-MM-DD
  (ej. inicio y fin del mes actual). NO pongas comillas en el SQL alrededor del token (el sistema ya
  sustituye por 'YYYY-MM-DD'). Al declarar estos dos params, el visor MUESTRA AUTOMÁTICAMENTE botones
  de período predefinidos (Hoy, Esta semana, Este mes, Mes pasado, Este año, Últimos 30 días). Por eso,
  si el usuario pide "botones de período", "períodos predefinidos" o "poder cambiar la fecha", basta con
  declarar los params 'desde' y 'hasta' (kind 'date') usados en el SQL.
- Sucursales: param kind 'storeList' (token "sucursales") y en el SQL: AND IdTienda IN {{sucursales}}.
  defaultValue "" = todas. (NO pongas paréntesis alrededor del token; el sistema sustituye por (1,2,3).)
- Filtro por producto / proveedor / cliente / departamento: param kind 'text' y en el SQL:
  AND <columna> LIKE {{producto}}. defaultValue "" = todos. (NO pongas comillas; el sistema sustituye
  por '%texto%'.) Usa la columna correcta según el reporte (ej. Descripcion para producto, Depto para
  departamento; si el SQL une proveedor/cliente, filtra por ese nombre).
- number: param kind 'number' (ej. {{topN}}) para TOP/umbrales.
- Los defaultValue deben hacer que el reporte corra solo (período por defecto, filtros vacíos = todo).
- Valida SIEMPRE con build_report pasando los MISMOS params (se ejecuta con los defaults).

──────────────────────────────────────────────
CONTEXTO DEL NEGOCIO Y DATOS
──────────────────────────────────────────────
${schemaString}`;
}

export interface AdvancedToolContext {
    userId: string;
    model: string;
    est?: ReportCostFields;
    promptSummary?: string;
}

export interface AdvancedToolOutcome {
    /** Texto que se devuelve al modelo como tool_result. */
    resultText: string;
    sql?: string;
    rowCount?: number;
    savedReport?: { idReporte: number; url: string; title: string };
}

/** Ejecuta una tool del agente avanzado y devuelve el resultado para el modelo. */
export async function executeAdvancedTool(
    name: string,
    input: any,
    ctx: AdvancedToolContext
): Promise<AdvancedToolOutcome> {
    switch (name) {
        case 'query_database': {
            const sql = assertReadOnly(String(input?.sql || ''));
            const rows = (await query(sql)) as any[];
            const columns = rows[0] ? Object.keys(rows[0]) : [];
            const sample = rows.slice(0, 20);
            return {
                sql,
                rowCount: rows.length,
                resultText: JSON.stringify({ ok: true, rowCount: rows.length, columns, sampleRows: localizeDatesForModel(sample) }).slice(0, 12000),
            };
        }
        case 'get_sales_forecast': {
            const summary = await runForecastForAgent({
                horizonDays: input?.horizonDays,
                storeNames: input?.storeNames,
            });
            return { resultText: renderForecastSummaryForAgent(summary).slice(0, 12000) };
        }
        case 'get_product_recommendations': {
            const rec = await getProductRecommendationsForAgent({
                horizonDays: input?.horizonDays,
                storeNames: input?.storeNames,
                topN: input?.topN,
            });
            return { resultText: renderProductRecommendationsForAgent(rec, Number(input?.horizonDays) || 30).slice(0, 12000) };
        }
        case 'build_report': {
            // Sustituye los tokens {{param}} con sus valores por defecto para validar/ejecutar.
            const resolved = substituteParams(String(input?.sql || ''), input?.params);
            const sql = assertReadOnly(resolved);
            const rows = (await query(sql)) as any[];
            const columns = rows[0] ? Object.keys(rows[0]) : [];
            const sample = rows.slice(0, 10);
            return {
                sql,
                rowCount: rows.length,
                resultText: JSON.stringify({
                    ok: true,
                    rowCount: rows.length,
                    columns,
                    sampleRows: localizeDatesForModel(sample),
                    note: rows.length === 0 ? 'La consulta no devolvió filas. Revisa filtros/período antes de guardar.' : 'Validado. Procede a save_report si se ve correcto.',
                }).slice(0, 10000),
            };
        }
        case 'save_report': {
            const sql = assertReadOnly(String(input?.sql || ''));
            const definition: AdvancedReportDefinition = {
                schemaVersion: ADVANCED_REPORT_SCHEMA_VERSION,
                title: String(input?.title || 'Reporte sin título').slice(0, 300),
                description: input?.description ? String(input.description).slice(0, 1000) : undefined,
                sql,
                expectedColumns: Array.isArray(input?.expectedColumns) ? input.expectedColumns : [],
                visualization: normalizeViz(input?.visualization),
                chartConfig: input?.chartConfig,
                params: Array.isArray(input?.params) ? input.params : undefined,
                insights: Array.isArray(input?.insights) ? input.insights : [],
                recommendations: Array.isArray(input?.recommendations) ? input.recommendations : [],
                suggestedQuestions: Array.isArray(input?.suggestedQuestions) ? input.suggestedQuestions : [],
                rowLimit: typeof input?.rowLimit === 'number' ? input.rowLimit : undefined,
                createdWith: {
                    model: ctx.model,
                    createdAt: new Date().toISOString(),
                    promptSummary: ctx.promptSummary,
                },
            };
            const idReporte = await createReport({
                userId: ctx.userId,
                definition,
                est: ctx.est,
                usdMxnRate: USD_MXN_RATE,
                model: ctx.model,
            });
            const url = `/dashboard/saved/${idReporte}`;
            return {
                savedReport: { idReporte, url, title: definition.title },
                resultText: JSON.stringify({ ok: true, idReporte, url, message: 'Reporte guardado en Mis Reportes.' }),
            };
        }
        default:
            return { resultText: JSON.stringify({ ok: false, error: `Tool desconocida: ${name}` }) };
    }
}
