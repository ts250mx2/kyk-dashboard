/**
 * Definición data-driven de un reporte creado por el Agente Avanzado.
 *
 * Esta interfaz se serializa como JSON y se guarda en
 * tblAgentReports.DefinicionJson. Contiene TODO lo necesario para
 * re-renderizar el reporte en runtime SIN volver a deployar:
 * el visor /dashboard/saved/[id] solo re-ejecuta `sql` (read-only) y
 * monta <AgentDataView> con `visualization`.
 */

/** Tipos de visualización que AgentDataView acepta como suggestedViz. */
export type ReportViz = 'table' | 'bar' | 'line' | 'pie' | 'area' | 'treemap';

/** Columna esperada del SELECT. AgentDataView mapea ejes POSICIONALMENTE
 *  (x = primera columna, series = resto numéricas), por lo que el orden importa. */
export interface ReportColumn {
    key: string;                                   // alias exacto de la columna en el SELECT
    label?: string;                                // etiqueta legible opcional
    role: 'dimension' | 'measure' | 'temporal';    // semántica para validación/formato
    format?: 'currency' | 'number' | 'percent' | 'date' | 'text';
}

/** Configuración declarativa de la gráfica (fuente de verdad para evolucionar el visor). */
export interface ReportChartConfig {
    xKey?: string;             // columna del eje X (default: primera columna)
    seriesKeys?: string[];     // columnas de series (default: resto numéricas)
    stacked?: boolean;
    showLegend?: boolean;
    colorScheme?: string[];    // hex opcionales
    // Opciones de presentación (las ajusta el agente por comando):
    showValues?: boolean;      // mostrar las cantidades/valores sobre la gráfica
    showPercent?: boolean;     // mostrar los valores como % del total
    lockViz?: boolean;         // mostrar SOLO el tipo de gráfica elegido (oculta el selector)
    withTable?: boolean;       // mostrar la tabla DEBAJO de la gráfica (las dos juntas)
}

/** Tarjeta KPI calculada sobre los datos del reporte (se muestra arriba). */
export interface ReportKpi {
    label: string;
    column: string;                                  // columna numérica del SELECT
    agg: 'sum' | 'avg' | 'min' | 'max' | 'count';    // agregación sobre las filas
    format?: 'currency' | 'number' | 'percent';
}

/** Tipo de parámetro interactivo del reporte. */
export type ReportParamKind = 'date' | 'storeList' | 'text' | 'number';

/**
 * Parámetro declarativo que hace el reporte INTERACTIVO. El SQL usa el token
 * `{{token}}` donde quiera el valor; el visor renderiza el control adecuado y
 * el servidor sustituye el token por un fragmento SQL seguro (ver params.ts).
 *
 * Convención de uso en el SQL:
 *   date      → `[Fecha Venta] >= {{desde}}` (se sustituye por 'YYYY-MM-DD')
 *   storeList → `AND IdTienda IN {{sucursales}}` (se sustituye por (1,2,3) o todas)
 *   text      → `AND Descripcion LIKE {{producto}}` (se sustituye por '%texto%' o '%')
 *   number    → `... {{topN}}` (se sustituye por el número)
 */
export interface ReportParam {
    token: string;                         // nombre del placeholder {{token}} en el SQL
    label: string;                         // etiqueta para el control del visor
    kind: ReportParamKind;
    defaultValue?: string;                 // valor por defecto (texto). date='YYYY-MM-DD', storeList='id,id' o '', text='', number='0'
    required?: boolean;
}

/** Composición de bloques del reporte renderizado. */
export interface ReportLayout {
    sections: Array<{
        type: 'kpis' | 'chart' | 'table' | 'insights' | 'recommendations';
        title?: string;
        order: number;
    }>;
}

export interface AdvancedReportDefinition {
    schemaVersion: number;                 // versión del esquema de la definición (default 1)
    title: string;
    description?: string;
    sql: string;                           // SELECT/WITH validado con assertReadOnly (sin ';' final)
    expectedColumns: ReportColumn[];       // orden de columnas del SELECT
    visualization: ReportViz;              // suggestedViz para AgentDataView
    chartConfig?: ReportChartConfig;
    layout?: ReportLayout;
    params?: ReportParam[];                // placeholders `?` posicionales en el SQL
    kpis?: ReportKpi[];                    // tarjetas KPI arriba del reporte
    insights: string[];                    // key_insights generados al crear
    recommendations: string[];
    suggestedQuestions: string[];
    rowLimit?: number;                     // tope de filas a renderizar (default 500)
    createdWith: {
        model: string;                     // ej. claude-opus-4-8
        createdAt: string;                 // ISO
        promptSummary?: string;            // resumen de la petición original
    };
}

export const ADVANCED_REPORT_SCHEMA_VERSION = 1;
