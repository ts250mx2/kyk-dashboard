# Database Schema

## Tablas y Reglas de Negocio

### Tabla: Ventas
Esta tabla contiene el histórico de transacciones detallado por artículo.

| Columna | Tipo | Descripción / Reglas de Negocio |
| :--- | :--- | :--- |
| Folio Venta | varchar | Identificador único del ticket. |
| IdVenta | int | ID interno de la venta. |
| Caja | int | Número de terminal de cobro. |
| IdTienda | int | ID de la sucursal. |
| Fecha Venta | datetime | Fecha y hora exacta de la transacción. |
| Z | int | **Corte de Caja**. Identifica a qué cierre diario pertenece la venta. |
| Cajero | varchar | Nombre del empleado que realizó la venta. |
| Codigo Barras | varchar | Código EAN/UPC del producto. |
| Descripcion | varchar | Nombre comercial del artículo vendido. |
| Cantidad | float | Número de unidades vendidas. |
| Precio Venta | currency | Precio unitario al que se vendió (incluye IVA). |
| Total | currency | **Monto Bruto**: Cantidad * Precio Venta. |
| Descuento | currency | Monto descontado en la línea. |
| Mes | varchar | Nombre del mes (ej: Enero). |
| IdMes | int | Número de mes (1-12). |
| Año | int | Año fiscal (ej: 2026). |
| Dia Semana | varchar | Día de la semana (ej: Lunes). |
| Tienda | varchar | Nombre de la sucursal. |
| Depto | varchar | Categoría o departamento del producto (ej: ABARROTES, CREMERIA). |

#### Reglas de Cálculo:
- **Venta Neta**: `SUM(Total)`.
- **Ticket Promedio**: `SUM(Total) / COUNT(DISTINCT [Folio Venta])`.
- **Artículos por Ticket**: `SUM(Cantidad) / COUNT(DISTINCT [Folio Venta])`.
- **Ventas del Día**: Filtrar por `CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)`.
- **Top Más Vendidos**: Clasificar siempre por mayor ingreso monetario (`ORDER BY SUM(Total) DESC`), NUNCA por unidades.

### Tabla: Cancelaciones
Registros de artículos cancelados durante o después de la venta.
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| Fecha Cancelacion | datetime | Fecha y hora de la cancelación. |
| Descripcion | varchar | Nombre del producto cancelado. |
| Codigo Barras | varchar | Código de barras del producto. |
| Supervisor | varchar | Quién autorizó la cancelación. |
| Cajero | varchar | Cajero que realizó la operación. |
| Cantidad | float | Unidades canceladas. |
| Precio Venta | currency | Precio de venta del artículo. |
| Total | currency | Monto monetario cancelado (Cantidad * Precio). |
| Tienda | varchar | Sucursal. |
| Caja | int | Número de terminal. |
| Z | int | Corte al que pertenece. |
| Año | int | Año fiscal. |
| Mes | varchar | Nombre del mes. |
| IdMes | int | Número de mes. |
| Dia Semana | varchar | Nombre del día. |
| Mes Año | varchar | Formato Mes-Año (ej: Ene-2026). |

### Tabla: Retiros
Movimientos de salida de efectivo de la caja (gastos o resguardos).
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| Fecha Retiro | datetime | Momento del movimiento. |
| Monto | currency | Cantidad retirada. |
| Concepto | varchar | Motivo del retiro (ej: Pago Proveedor, Retiro Parcial). |
| Supervisor | varchar | Quién autorizó el retiro. |
| Cajero | varchar | Cajero que realizó la operación. |
| Tienda | varchar | Sucursal. |
| Z | int | Corte de caja al que pertenece. |
| IdMes | int | Mes (1-12). |
| Mes | varchar | Nombre del mes. |
| Año | int | Año fiscal (ej: 2026). |
| Dia Semana | varchar | Nombre del día. |
| Mes Año | varchar | Formato Mes-Año (ej: Ene-2026). |

### Tabla: Cortes
Resumen de cierres de caja (Corte Z).
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| FechaCierre | datetime | Fecha del corte. |
| TotalVenta | currency | Venta acumulada en ese turno/corte. |
| Efectivo | currency | Dinero físico reportado. |
| Tarjeta | currency | Pagos con tarjeta. |
| Cajero | varchar | Responsable del turno. |
| Tienda | varchar | Sucursal. |

### Tabla: Tickets
Cabeceras de ventas (transacción completa).
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| FolioVenta | varchar | Ticket único. |
| FechaVenta | datetime | Fecha de la transacción. |
| Total | currency | Monto total pagado. |
| Cajero | varchar | Quién atendió. |
| Tienda | varchar | Sucursal. |

#### Reglas de Negocio Adicionales:
- **Cancelaciones**: Para sumas usa `SUM(Total)`.
- **Retiros**: Para sumas usa `SUM(Monto)`.
- **Cortes**: El campo principal es `TotalVenta`.
- **Tickets**: Use `COUNT(DISTINCT FolioVenta)` para número de clientes.
- **Comparación de Meses**: SIEMPRE que se use `MONTH(GETDATE())`, el filtro debe ser contra la columna `IdMes` (ej: `WHERE IdMes = MONTH(GETDATE())`). NUNCA compares el número del mes contra la columna `Mes` (que es texto).
