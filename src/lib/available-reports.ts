export const AVAILABLE_REPORTS = {
  sales: {
    category: 'VENTAS Y OPERACIONES',
    reports: [
      {
        id: 'overview-general',
        name: 'Dashboard General',
        path: '/dashboard/overview',
        description: 'Resumen integral de ventas, tickets, cancelaciones y KPIs principales',
        keywords: ['resumen', 'general', 'overview', 'kpi', 'totales', 'visión general'],
        useCases: ['Visión general del negocio', 'Métricas ejecutivas', 'Estado general del día']
      },
      {
        id: 'sales-operations',
        name: 'Operaciones de Ventas',
        path: '/dashboard/sales/operations',
        description: 'Desglose por sucursal, análisis horario, ticket promedio y efectividad',
        keywords: ['operaciones', 'sucursal', 'tienda', 'ticket', 'promedio', 'ventas por tienda'],
        useCases: ['Performance por sucursal', 'Análisis de tickets', 'Comparativa entre tiendas']
      },
      {
        id: 'sales-heatmap',
        name: 'Mapa de Calor de Ventas',
        path: '/dashboard/sales/heatmap',
        description: 'Análisis de horas pico, patrones de tráfico horario y tendencias intradiarias',
        keywords: ['heatmap', 'horas', 'horario', 'pico', 'tráfico', 'intradiario', 'hora punta'],
        useCases: ['Identificar horas pico', 'Optimizar staffing', 'Análisis de patrones horarios']
      },
      {
        id: 'sales-trends',
        name: 'Tendencias de Ventas',
        path: '/dashboard/sales/reports/trends',
        description: 'Evolución de productos, análisis por departamento, familia y proveedor',
        keywords: ['tendencia', 'evolución', 'producto', 'departamento', 'familia', 'histórico'],
        useCases: ['Productos con mejor/peor desempeño', 'Análisis de categorías', 'Productos destacados']
      },
      {
        id: 'sales-comparison',
        name: 'Comparativa de Ventas',
        path: '/dashboard/sales/reports/comparison',
        description: 'Comparación período actual vs anterior (diaria, semanal, mensual)',
        keywords: ['comparativa', 'comparación', 'vs', 'anterior', 'período', 'variación', 'crecimiento'],
        useCases: ['Análisis período a período', 'Identificar crecimiento', 'Evaluación de impacto']
      },
      {
        id: 'sales-goals',
        name: 'Metas de Ventas',
        path: '/dashboard/sales/goals',
        description: 'Seguimiento contra objetivos por concepto, sucursal y período',
        keywords: ['meta', 'objetivo', 'goal', 'cumplimiento', 'progreso', 'target'],
        useCases: ['Seguimiento de metas', 'Identificar desviaciones', 'Evaluación de desempeño']
      },
      {
        id: 'cancellations-trends',
        name: 'Tendencias de Cancelaciones',
        path: '/dashboard/cancellations/reports/trends',
        description: 'Análisis de cancelaciones por tipo, causa, hora y evolución',
        keywords: ['cancelación', 'cancelaciones', 'devolución', 'anulación', 'devuelto'],
        useCases: ['Causas principales de cancelaciones', 'Patrones de devolución', 'Análisis temporal']
      },
      {
        id: 'cancellations-alerts',
        name: 'Alertas de Cancelaciones',
        path: '/dashboard/cancellations/alerts',
        description: 'Detección de cancelaciones anormales, comportamientos atípicos por sucursal',
        keywords: ['alerta', 'cancelación anormal', 'anomalía', 'riesgo', 'atípico'],
        useCases: ['Identificar anomalías', 'Monitoreo de riesgos', 'Evaluación de calidad']
      }
    ]
  },
  purchases: {
    category: 'COMPRAS E INVENTARIO',
    reports: [
      {
        id: 'purchases-dashboard',
        name: 'Dashboard de Compras',
        path: '/dashboard/purchases/dashboard',
        description: 'Resumen de órdenes, recibos, distribución y consolidación de compras',
        keywords: ['compras', 'órdenes', 'recibos', 'compra dashboard', 'inventario entrada'],
        useCases: ['Visión general de compras', 'Estado de órdenes', 'Consolidación de recibos']
      },
      {
        id: 'purchase-orders',
        name: 'Órdenes de Compra',
        path: '/dashboard/purchases/orders',
        description: 'Estado de órdenes, proveedores, recibos programados y retrasos',
        keywords: ['orden', 'compra', 'proveedor', 'recibido', 'pendiente', 'retraso'],
        useCases: ['Órdenes pendientes', 'Análisis de proveedores', 'Control de recepción']
      },
      {
        id: 'purchase-receipts',
        name: 'Recibos de Compra',
        path: '/dashboard/purchases/receipts',
        description: 'Desglose de recibos, consolidación, comparativa compras vs devoluciones',
        keywords: ['recibo', 'entrada', 'consolidación', 'devolución', 'compra recibida'],
        useCases: ['Recepción de mercancía', 'Consolidación de facturas', 'Devoluciones']
      },
      {
        id: 'purchase-distributions',
        name: 'Distribución de Mercancía',
        path: '/dashboard/purchases/distributions',
        description: 'Estatus de envíos a sucursales, eficiencia de surtido por almacén',
        keywords: ['distribución', 'envío', 'sucursal', 'almacén', 'surtido', 'transferencia'],
        useCases: ['Eficiencia de distribución', 'Control de surtido', 'Entregas a sucursales']
      },
      {
        id: 'purchase-routes',
        name: 'Rutas de Entrega',
        path: '/dashboard/purchases/routes',
        description: 'Eficiencia de rutas, retrasos, transportes y cumplimiento de entregas',
        keywords: ['ruta', 'entrega', 'transporte', 'logística', 'cumplimiento', 'retraso'],
        useCases: ['Optimizar rutas', 'Monitorear entregas', 'Análisis de logística']
      },
      {
        id: 'purchase-invoices',
        name: 'Facturas de Compra',
        path: '/dashboard/invoices/purchases',
        description: 'Relaciones de facturas, conceptos, detalles y análisis por proveedor',
        keywords: ['factura', 'facturación', 'concepto', 'detalle', 'proveedor factura'],
        useCases: ['Control de facturas', 'Análisis de proveedores', 'Detalles de compra']
      },
      {
        id: 'purchase-dispersion',
        name: 'Dispersión de Compras',
        path: '/dashboard/purchases/dispersion',
        description: 'Análisis geográfico y de dispersión de compras entre sucursales',
        keywords: ['dispersión', 'geográfico', 'mapa', 'ubicación', 'distribución'],
        useCases: ['Análisis geográfico', 'Optimización de compras', 'Evaluación de dispersión']
      },
      {
        id: 'purchase-consolidation',
        name: 'Consolidación de Compras',
        path: '/dashboard/purchases/consolidate-receipts',
        description: 'Consolidación de recibos y procesamiento de compras por lote',
        keywords: ['consolidación', 'lote', 'procesamiento', 'recibo consolidado'],
        useCases: ['Procesar compras en lote', 'Consolidar recibos', 'Validación de entrada']
      }
    ]
  },
  analysis: {
    category: 'ANÁLISIS ESTRATÉGICO',
    reports: [
      {
        id: 'pareto-analysis',
        name: 'Análisis de Pareto',
        path: '/dashboard/overview',
        description: 'Análisis ABC/Pareto de productos más vendidos y su contribución a ventas',
        keywords: ['pareto', 'abc', 'productos', 'contribución', 'volumen', 'concentración'],
        useCases: ['Identificar productos clave', 'Análisis de concentración', 'Surtido óptimo']
      },
      {
        id: 'department-analysis',
        name: 'Análisis de Departamentos',
        path: '/dashboard/overview',
        description: 'Performance por departamento, familia de productos y análisis comparativo',
        keywords: ['departamento', 'familia', 'categoría', 'depto', 'performance'],
        useCases: ['Performance por categoría', 'Análisis de familias', 'Comparativa departamentos']
      }
    ]
  },
  system: {
    category: 'SISTEMA Y AUDITORÍA',
    reports: [
      {
        id: 'question-history',
        name: 'Historial de Preguntas',
        path: '/dashboard/system/question-history',
        description: 'Auditoría de consultas, usuarios activos, patrones de uso y tendencias',
        keywords: ['historial', 'preguntas', 'auditoría', 'usuario', 'uso'],
        useCases: ['Auditoría de sistema', 'Usuarios más activos', 'Patrones de consulta']
      },
      {
        id: 'ai-learning',
        name: 'Aprendizaje de IA',
        path: '/dashboard/system/ai-learning',
        description: 'Configuración de reglas dinámicas para mejora continua del agente',
        keywords: ['ia', 'reglas', 'aprendizaje', 'configuración', 'mejora'],
        useCases: ['Configurar reglas del agente', 'Mejora de análisis', 'Personalización']
      }
    ]
  }
};

export function findRelevantReports(query: string): Array<{
  report: typeof AVAILABLE_REPORTS.sales.reports[0];
  relevanceScore: number;
  category: string;
}> {
  const queryLower = query.toLowerCase();
  const results: Array<{
    report: typeof AVAILABLE_REPORTS.sales.reports[0];
    relevanceScore: number;
    category: string;
  }> = [];

  Object.entries(AVAILABLE_REPORTS).forEach(([catKey, catData]) => {
    if (catData.reports) {
      catData.reports.forEach(report => {
        let score = 0;

        // Exact name match
        if (report.name.toLowerCase().includes(queryLower) || queryLower.includes(report.name.toLowerCase())) {
          score += 10;
        }

        // Keyword matches
        report.keywords.forEach(keyword => {
          if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
            score += 3;
          }
        });

        // Description match
        if (report.description.toLowerCase().includes(queryLower)) {
          score += 2;
        }

        // Use case match
        report.useCases.forEach(useCase => {
          if (useCase.toLowerCase().includes(queryLower) || queryLower.includes(useCase.toLowerCase())) {
            score += 2;
          }
        });

        if (score > 0) {
          results.push({
            report,
            relevanceScore: score,
            category: (catData as any).category
          });
        }
      });
    }
  });

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
}
