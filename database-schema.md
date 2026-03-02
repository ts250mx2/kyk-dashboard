# SQL Database Schema

## Table: Estado_Resultados_210

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | varchar | YES | 50 |
|  Dia | varchar | YES | 50 |
|  Mes | varchar | YES | 50 |
|  Anio | varchar | YES | 50 |
|  VentasSinDescuento | varchar | YES | 50 |
|  DevolucionesVentas | varchar | YES | 50 |
|  Descuentos | varchar | YES | 50 |
|  CostoReal | varchar | YES | 50 |
|  TotalCosto | varchar | YES | 50 |
|  Recibo | varchar | YES | 50 |
|  Ajustes | varchar | YES | 50 |
|  MovimientosEntradas | varchar | YES | 50 |
|  MovimientosSalidas | varchar | YES | 50 |
|  IdDepto | varchar | YES | 50 |
|  IdTienda | varchar | YES | 50 |
|  Fecha | varchar | YES | 50 |
|  CantidadVentas | varchar | YES | 50 |
|  CantidadMenudeo | varchar | YES | 50 |
|  CantidadMayoreo | varchar | YES | 50 |
|  CantidadMayoreo1 | varchar | YES | 50 |
|  CantidadMayoreo2 | varchar | YES | 50 |
|  CantidadMayoreo3 | varchar | YES | 50 |
|  CantidadDescuento | varchar | YES | 50 |
|  CantidadRecibo | varchar | YES | 50 |
|  CantidadAjustes | varchar | YES | 50 |
|  CantidadMovimientosEntradas | varchar | YES | 50 |
|  CantidadMovimientosSalidas | varchar | YES | 50 |
|  TotalVentas | varchar | YES | 50 |
|  VentasMenudeo | varchar | YES | 50 |
|  VentasMayoreo | varchar | YES | 50 |
|  VentasMayoreo1 | varchar | YES | 50 |
|  VentasMayoreo2 | varchar | YES | 50 |
|  VentasMayoreo3 | varchar | YES | 50 |
|  VentasMayoreo4 | varchar | YES | 50 |
|  VentasDescuento | varchar | YES | 50 |
|  CantidadInventario | varchar | YES | 50 |
|  TotalInventario | varchar | YES | 50 |
|  CantidadTickets | varchar | YES | 50 |
|  UtilidadNeta | varchar | YES | 50 |
|  UtilidadAjustes | varchar | YES | 50 |
|  UtiilidaCompra | varchar | YES | 50 |
|  UtilidadTeorica | varchar | YES | 50 |
|  CantidadDevolucionesVenta | varchar | YES | 50 |
|  VentaNeta | varchar | YES | 50 |
|  TransferenciasEntradas | varchar | YES | 50 |
|  TransferenciasSalidas | varchar | YES | 50 |
|  CantidadTransferenciasEntradas | varchar | YES | 50 |
|  CantidadTransferenciasSalidas | varchar | YES | 50 |
|  DevolucionesProveedor | varchar | YES | 50 |
|  CantidadDevolucionesProveedor | varchar | YES | 50 |
|  FactorVenta | varchar | YES | 50 |
|  Modificado | varchar | YES | 50 |
|  CantidadMayoreo4 | varchar | YES | 50 |
|  FechaTexto | varchar | YES | 50 |
|  TotalTickets | varchar | YES | 50 |
|  TotalTicketsDetalle | varchar | YES | 50 |
|  VentaPromedioTotal | varchar | YES | 50 |
|  CantidadTicketsReal | varchar | YES | 50 |
|  VentaPromedioReal | varchar | YES | 50 |
|  Indice | varchar | YES | 50 |
|  TotalVentaNeta | varchar | YES | 50 |
|  VentaPromedio | varchar | YES | 50 |

## Table: tblActualizaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| Tabla | varchar | NO | 50 |
| FechaAct | datetime | YES | - |
| IdTienda | int | NO | - |
| EsError | int | YES | - |
| Error | varchar | YES | 250 |
| FechaOK | datetime | YES | - |

## Table: tblActualizacionesTotales

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| Tabla | varchar | NO | 50 |
| Dia | int | YES | - |
| Mes | int | YES | - |
| Anio | int | NO | - |
| FechaAct | datetime | YES | - |

## Table: tblAjustesAuditorias

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdAjusteAuditoria | int | NO | - |
| IdProveedor | int | YES | - |
| FechaAjusteAuditoria | datetime | YES | - |
| Dia | int | YES | - |
| Mes | int | YES | - |
| Anio | int | YES | - |
| FechaAct | datetime | YES | - |
| IdTienda | int | NO | - |
| IdUsuarioAjusteAuditoria | int | YES | - |

## Table: tblAjustesInventarios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdAjusteInventario | int | NO | - |
| IdTienda | int | NO | - |
| AjusteInventario | varchar | YES | 250 |
| FechaAjuste | datetime | YES | - |
| IdUsuarioAjuste | int | YES | - |
| Impresiones | int | YES | - |

## Table: tblAjustesPorCaptura

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| Exi | float | YES | - |
| FechaCaptura | datetime | YES | - |
| IdUsuarioCaptura | int | YES | - |
| IdTienda | int | NO | - |

## Table: tblAjustesProveedores

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdProveedor | int | NO | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| IdTienda | int | NO | - |
| FechaRevision | datetime | YES | - |
| IdUsuarioAjuste | int | YES | - |
| TotalAjusteEntrada | float | YES | - |
| TotalAjusteSalida | float | YES | - |
| IdMovimientoEntrada | int | YES | - |
| IdMovimientoSalida | int | YES | - |
| Status | int | YES | - |
| IdUsuarioRevision | int | YES | - |

## Table: tblAperturasCierres

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdApertura | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| FechaApertura | datetime | YES | - |
| IdCajero | int | YES | - |
| IdSupervisorApertura | int | YES | - |
| EfectivoInicio | float | YES | - |
| FechaCierre | datetime | YES | - |
| Efectivo | float | YES | - |
| Cheques | float | YES | - |
| Tarjeta | float | YES | - |
| Dolares | float | YES | - |
| IdSupervisorCierre | int | YES | - |
| VistaPrecios | int | YES | - |
| Cancelados | int | YES | - |
| CierreTemporal | int | YES | - |
| Impresiones | int | YES | - |
| Marcados | int | YES | - |
| Devoluciones | float | YES | - |
| IdFactura | int | YES | - |
| Transferencia | float | YES | - |
| IdVentaInicio | int | YES | - |
| IdVentaFin | int | YES | - |
| TicketCorte | varchar | YES | -1 |

## Table: tblAperturasX

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdAperturaX | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| FechaInicio | datetime | YES | - |
| FechaFin | datetime | YES | - |
| IdCajero | int | YES | - |
| IdSupervisorApertura | int | YES | - |
| EfectivoInicio | float | YES | - |
| Efectivo | float | YES | - |
| Cheques | float | YES | - |
| Tarjeta | float | YES | - |
| Dolares | float | YES | - |
| Devoluciones | float | YES | - |
| Marcados | int | YES | - |
| Cancelados | int | YES | - |
| VistaPrecios | int | YES | - |
| IdSupervisorCierre | int | YES | - |
| Impresiones | int | YES | - |
| TotalVentas | float | YES | - |
| Transferencia | float | YES | - |

## Table: tblArticulos

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| CodigoBarras | varchar | YES | 50 |
| Descripcion | varchar | YES | 250 |
| IdTipo | int | YES | - |
| Status | int | YES | - |
| ConsumoInterno | int | YES | - |
| CantidadCaja | float | YES | - |
| CodigoInterno2 | int | YES | - |
| Caja | int | YES | - |
| UltimoCosto | float | YES | - |
| FechaAct | datetime | YES | - |
| IdDepto | int | YES | - |
| IdProveedorDefault | int | YES | - |
| MedidaCompra | varchar | YES | 50 |
| CantidadCompra | float | YES | - |
| MedidaVenta | varchar | YES | 50 |
| TipoOperacion | int | YES | - |
| Precio | float | YES | - |
| Descuento0 | float | YES | - |
| Descuento1 | float | YES | - |
| Descuento2 | float | YES | - |
| Descuento3 | float | YES | - |
| EscalaSuperior0 | float | YES | - |
| EscalaSuperior1 | float | YES | - |
| EscalaSuperior2 | float | YES | - |
| EscalaSuperior3 | float | YES | - |
| PrecioOferta | float | YES | - |
| Iva | float | YES | - |
| DescripcionCompra | varchar | YES | 250 |
| ErrorSAP | varchar | YES | 250 |
| ItmsGrpCod | varchar | YES | 50 |
| Categoria | varchar | YES | 250 |
| Familia | varchar | YES | 250 |
| IEPS | float | YES | - |
| IEPSCantidad | float | YES | - |
| Contenido | float | YES | - |
| FactorVenta | float | YES | - |
| ClaveCFDI | varchar | YES | 50 |
| DescripcionCFDI | varchar | YES | 250 |

## Table: tblArticulosOcultos

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblArticulosProveedor

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| IdProveedor | int | NO | - |
| Costo | float | YES | - |
| CodigoCompra | varchar | YES | 50 |
| DescripcionCompra | varchar | YES | 250 |
| CantidadCompra | float | YES | - |
| Desc0 | float | YES | - |
| Desc1 | float | YES | - |
| Desc2 | float | YES | - |
| Desc3 | float | YES | - |
| Desc4 | float | YES | - |
| FactorVolumen | float | YES | - |
| CostoReal | float | YES | - |
| FechaAct | datetime | YES | - |
| SoloDevolucion | int | YES | - |
| Destare1 | float | YES | - |
| Destare2 | float | YES | - |

## Table: tblBufferRepCortes

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| IdComputadora | int | NO | - |
| IdDepto | int | NO | - |
| Impuesto | int | NO | - |
| TipoCorte | int | NO | - |
| Valor1 | float | YES | - |
| Valor2 | float | YES | - |
| Valor3 | float | YES | - |
| Valor4 | float | YES | - |
| Valor5 | float | YES | - |
| Valor6 | float | YES | - |
| Valor7 | float | YES | - |
| Valor8 | float | YES | - |
| Valor9 | float | YES | - |
| Valor10 | float | YES | - |
| Valor11 | float | YES | - |
| Valor12 | float | YES | - |
| Valor13 | float | YES | - |
| Valor14 | float | YES | - |
| Valor15 | float | YES | - |
| Valor16 | float | YES | - |
| Valor17 | float | YES | - |
| Valor18 | float | YES | - |
| Valor19 | float | YES | - |
| Valor20 | float | YES | - |
| Valor21 | float | YES | - |
| Valor22 | float | YES | - |
| Valor23 | float | YES | - |
| Valor24 | float | YES | - |
| Valor25 | float | YES | - |
| Valor26 | float | YES | - |
| Valor27 | float | YES | - |
| Valor28 | float | YES | - |
| Valor29 | float | YES | - |
| Valor30 | float | YES | - |
| Valor31 | float | YES | - |
| Total | float | YES | - |

## Table: tblBufferRepCortesCancelaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdCajero | int | YES | - |
| Cancelaciones | int | YES | - |
| FechaApertura | datetime | YES | - |
| TotalCancelaciones | float | YES | - |

## Table: tblBufferRepCortesCancelacionesSupervisor

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdCajero | int | YES | - |
| Cancelaciones | int | YES | - |
| FechaApertura | datetime | YES | - |
| TotalCancelaciones | float | YES | - |

## Table: tblBufferRepCortesDetalleCancelaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdCancelacion | int | NO | - |
| CodigoInterno | int | NO | - |
| FechaCancelacion | datetime | YES | - |
| Cantidad | float | YES | - |
| PrecioVenta | float | YES | - |
| IdSupervisor | int | YES | - |
| IdCajero | int | YES | - |

## Table: tblBufferRepCortesDetalleCancelacionesSupervisor

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdCancelacion | int | NO | - |
| CodigoInterno | int | NO | - |
| FechaCancelacion | datetime | YES | - |
| Cantidad | float | YES | - |
| PrecioVenta | float | YES | - |
| IdSupervisor | int | YES | - |
| IdCajero | int | YES | - |

## Table: tblBufferRepCortesDifEfectivo

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| EsRetiros | int | NO | - |
| TotalRetiros | float | YES | - |
| TotalVentas | float | YES | - |
| IdTienda | int | YES | - |

## Table: tblBufferRepCortesFacturas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdCajero | int | YES | - |
| TotalFacturasGlobal | float | YES | - |
| TotalClientes | float | YES | - |
| TotalRefacturado | float | YES | - |
| TicketCorte | varchar | YES | -1 |
| FechaApertura | datetime | YES | - |
| FechaFacturaGlobal | datetime | YES | - |
| UUIDGlobal | varchar | YES | 50 |
| FacturasClientes | int | YES | - |
| TotalVentas | float | YES | - |

## Table: tblBufferRepCortesFormasPago

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdApertura | int | NO | - |
| IdFormaPago | int | NO | - |
| IdVale | int | NO | - |
| FormaPago | varchar | YES | 50 |
| Monto | float | YES | - |
| IdTienda | int | YES | - |

## Table: tblBufferRepCortesPorAperturas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdApertura | int | NO | - |
| TipoCorte | int | NO | - |
| IdDepto | int | NO | - |
| Operaciones | int | YES | - |
| Valor | float | YES | - |
| ValorSinIva | float | YES | - |
| ValorSinIeps | float | YES | - |
| ValorIva | float | YES | - |
| ValorIeps | float | YES | - |
| AcctCodeSAP | varchar | YES | 250 |
| CuentaContableSAP | varchar | YES | 250 |
| IdTienda | int | YES | - |

## Table: tblBufferRepCortesPre

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| IdComputadora | int | NO | - |
| IdDepto | int | NO | - |
| Anio | int | NO | - |
| Mes | int | NO | - |
| Dia | int | NO | - |
| TipoCorte | int | NO | - |
| Valor | float | YES | - |
| ValorSinIva | float | YES | - |
| ValorSinIeps | float | YES | - |
| ValorIva | float | YES | - |
| ValorIeps | float | YES | - |

## Table: tblBufferRepCortesRetiros

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| IdRetiro | int | NO | - |
| IdApertura | int | NO | - |
| Monto | float | YES | - |
| FechaRetiro | datetime | YES | - |
| Concepto | varchar | YES | 250 |
| Concepto1 | varchar | YES | 250 |
| Concepto2 | varchar | YES | 250 |
| AcctCodeSAP | varchar | YES | 250 |
| CuentaContableSAP | varchar | YES | 250 |
| IdTienda | int | YES | - |

## Table: tblBufferRepFacturas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdFactura | int | NO | - |
| Credito | int | NO | - |
| TipoFactura | varchar | YES | 50 |
| Serie | varchar | YES | 50 |
| FolioFactura | varchar | YES | 50 |
| FechaFactura | datetime | YES | - |
| RFC | varchar | YES | 50 |
| ClienteConcepto | varchar | YES | 250 |
| UUID | varchar | YES | 50 |
| FormaPago | varchar | YES | 250 |
| MetodoPago | varchar | YES | 250 |
| UsoCFDI | varchar | YES | 250 |
| Total | float | YES | - |
| TotalIVA | float | YES | - |
| TotalIEPS | float | YES | - |
| IdApertura | int | YES | - |
| IdComputadoraVenta | int | YES | - |
| IdCajero | int | YES | - |
| FechaApertura | datetime | YES | - |

## Table: tblBufferRepFacturasClientes

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadoraVenta | int | NO | - |
| TotalFacturas | float | YES | - |
| CantidadFacturas | int | YES | - |

## Table: tblCajas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| Cantidad | float | YES | - |
| CodigoBarras | varchar | YES | 50 |

## Table: tblCancelaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdCancelacion | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| FechaCancelacion | datetime | YES | - |
| IdSupervisor | int | YES | - |
| IdApertura | int | YES | - |
| Completo | int | YES | - |

## Table: tblCapturaExistencias

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| ExiCaptura | float | YES | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| FechaCaptura | datetime | YES | - |
| IdProveedor | int | NO | - |
| IdAjusteAuditoria | int | YES | - |
| Exi | float | YES | - |
| CadenaFolios | varchar | YES | 250 |
| IdUsuarioCaptura | int | YES | - |
| ExiAjuste | float | YES | - |

## Table: tblCapturaExistenciasHoy

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| ExiCaptura | float | YES | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| FechaCaptura | datetime | YES | - |
| IdProveedor | int | NO | - |
| IdAjusteAuditoria | int | YES | - |
| Exi | float | YES | - |
| CadenaFolios | varchar | YES | 250 |
| IdUsuarioCaptura | int | YES | - |
| ExiAjuste | float | YES | - |

## Table: tblComputadoras

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| Computadora | varchar | YES | 50 |
| Activa | int | YES | - |
| Host | varchar | YES | 50 |
| VersionKYKCortes | varchar | YES | 50 |
| FechaUltimoAcceso | datetime | YES | - |
| Modificado | int | YES | - |

## Table: tblCuentasContablesSAP

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| TipoConcepto | tinyint | NO | - |
| IdTipoConcepto | tinyint | NO | - |
| IdTienda | tinyint | NO | - |
| CuentaContableSAP | varchar | YES | 250 |
| AcctCode | varchar | YES | 250 |
| Mes | tinyint | NO | - |
| AcctCodeSAP | varchar | YES | 250 |

## Table: tblDeptos

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdDepto | int | NO | - |
| Depto | varchar | YES | 50 |

## Table: tblDetalleAjustesInventarios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdAjusteInventario | int | NO | - |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| CostoReal | float | YES | - |
| ExiAnt | float | YES | - |
| Exi | float | YES | - |

## Table: tblDetalleCancelaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdCancelacion | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| Cantidad | float | YES | - |
| PrecioVenta | float | YES | - |

## Table: tblDetalleDevolucionesCompra

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdProveedor | int | NO | - |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| FechaAct | datetime | YES | - |
| Dev | float | YES | - |
| Modificado | int | YES | - |
| IdUsuarioDevolucionCompra | int | YES | - |

## Table: tblDetalleDevolucionesVenta

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdDetalleDevolucionVenta | int | NO | - |
| IdTienda | int | NO | - |
| IdDevolucionVenta | int | YES | - |
| CodigoInterno | int | YES | - |
| Cantidad | float | YES | - |
| CantidadAnterior | float | YES | - |
| PrecioVenta | float | YES | - |
| PrecioVentaAnterior | float | YES | - |
| IVA | float | YES | - |
| IEPS | float | YES | - |
| IdVenta | int | YES | - |
| IdComputadora | int | YES | - |

## Table: tblDetalleEmpacados2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdEmpacado | int | NO | - |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Cantidad | float | YES | - |
| Comentarios | varchar | YES | -1 |
| TipoMovimiento | int | NO | - |

## Table: tblDetalleEmpacados3

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdEmpacado | int | NO | - |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Cantidad | float | YES | - |
| Comentarios | varchar | YES | -1 |
| TipoMovimiento | int | YES | - |

## Table: tblDetalleFacturas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdFactura | int | NO | - |
| IdTienda | int | NO | - |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| Credito | int | NO | - |

## Table: tblDetalleMovimientos2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdMovimiento | int | NO | - |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Mov | float | YES | - |
| Costo | float | YES | - |
| Iva | float | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblDetalleProgramacionPrecios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdSesionProgramacion | int | NO | - |
| CodigoInterno | int | NO | - |
| Precio | decimal | YES | - |
| Descuento0 | decimal | YES | - |
| Descuento1 | decimal | YES | - |
| Descuento2 | decimal | YES | - |
| Descuento3 | decimal | YES | - |
| EscalaSuperior0 | decimal | YES | - |
| EscalaSuperior1 | decimal | YES | - |
| EscalaSuperior2 | decimal | YES | - |
| EscalaSuperior3 | decimal | YES | - |
| IVA | decimal | YES | - |

## Table: tblDetalleRecibo2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRecibo | int | YES | - |
| CodigoInterno | int | YES | - |
| IdTienda | int | YES | - |
| Rec | float | YES | - |
| RecGranel | float | YES | - |
| Costo | float | YES | - |
| Iva | float | YES | - |
| Desc0 | float | YES | - |
| Desc1 | float | YES | - |
| Desc2 | float | YES | - |
| Desc3 | float | YES | - |
| Desc4 | float | YES | - |
| Factor | float | YES | - |
| Devolucion | int | YES | - |
| CantidadCompra | float | YES | - |
| IEPS | float | YES | - |
| IEPSCantidad | float | YES | - |

## Table: tblDetalleReciboMovil

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdReciboMovil | int | NO | - |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Rec | float | YES | - |
| RecGranel | float | YES | - |
| Costo | float | YES | - |
| Iva | float | YES | - |
| Desc0 | float | YES | - |
| Desc1 | float | YES | - |
| Desc2 | float | YES | - |
| Desc3 | float | YES | - |
| Desc4 | float | YES | - |
| Factor | float | YES | - |
| Devolucion | int | NO | - |
| CantidadCompra | float | YES | - |
| FechaCaducidad | varchar | YES | 20 |
| ExiAnterior | float | YES | - |
| StatusInventario | int | YES | - |
| Pedido | float | YES | - |
| CajasTara | float | YES | - |
| Tara | float | YES | - |
| PesoTotal | float | YES | - |
| CajasTara2 | float | YES | - |
| Tara2 | float | YES | - |
| PesoTotal2 | float | YES | - |
| CajasTara3 | float | YES | - |
| Tara3 | float | YES | - |
| PesoTotal3 | float | YES | - |
| CajasTara4 | float | YES | - |
| Tara4 | float | YES | - |
| PesoTotal4 | float | YES | - |
| IEPS | float | YES | - |
| IEPSCantidad | float | YES | - |
| Temperatura | float | YES | - |
| IdRenglonFacturaProveedor | int | YES | - |

## Table: tblDetalleSesionesOfertas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdSesionOferta | int | NO | - |
| CodigoInterno | int | NO | - |
| PrecioOferta | float | YES | - |

## Table: tblDetalleTransferenciasSalidas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTransferenciaSalida | int | NO | - |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Costo | float | YES | - |
| Iva | float | YES | - |
| Mov | float | YES | - |
| CantidadCompra | float | YES | - |
| Modificado | int | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblDetalleVentas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| Cantidad | float | YES | - |
| PrecioVenta | float | YES | - |
| PrecioNormal | float | YES | - |
| Iva | float | YES | - |

## Table: tblDevolucionesVenta

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdDevolucionVenta | int | NO | - |
| IdTienda | int | NO | - |
| FechaDevolucionVenta | datetime | YES | - |
| IdUsuario | int | YES | - |
| Valor | float | YES | - |
| Status | int | YES | - |
| IdComputadoraCanje | int | YES | - |
| FechaCanje | datetime | YES | - |
| ClaveDevolucion | varchar | YES | 50 |
| Cliente | varchar | YES | 250 |
| Concepto | varchar | YES | 250 |
| DirTel | varchar | YES | 250 |
| Impresiones | int | YES | - |
| DiasCaducidad | int | YES | - |
| Empleado | varchar | YES | 250 |
| IdFactura | int | YES | - |
| Credito | int | YES | - |

## Table: tblDiasSemana

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| DiaSemana | int | YES | - |
| DiaSemanaTexto | varchar | YES | 50 |

## Table: tblEmpacados2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdEmpacado | int | NO | - |
| IdUsuarioEmpacado | int | YES | - |
| IdTienda | int | NO | - |
| FechaAct | datetime | YES | - |
| Impresiones | int | YES | - |
| Concepto | varchar | YES | 250 |
| FechaEmpacado | datetime | YES | - |
| Modificado | int | YES | - |
| Corte | int | YES | - |

## Table: tblExistencias

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| IdTienda | int | NO | - |
| Exi | decimal | YES | - |
| PVD | decimal | YES | - |
| Costo | decimal | YES | - |
| CostoReal | decimal | YES | - |
| CostoRealIVA | decimal | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblFacturas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdFactura | int | NO | - |
| Credito | int | NO | - |
| IdTienda | int | NO | - |
| FechaFactura | datetime | YES | - |
| AlfaNumerico | varchar | YES | 50 |
| IdUsuario | int | YES | - |
| RFC | varchar | YES | 50 |
| ClienteConcepto | varchar | YES | 250 |
| Total | float | YES | - |
| IVA | float | YES | - |
| MetodoPago | varchar | YES | 50 |
| Cuenta | varchar | YES | 50 |
| UUID | varchar | YES | 50 |
| IdApertura | int | YES | - |
| IdComputadora | int | YES | - |
| Serie | varchar | YES | 50 |
| TipoCFDI | varchar | YES | 150 |
| FormaPago | varchar | YES | 150 |
| RegimenFiscal | varchar | YES | 150 |
| FechaInicio | datetime | YES | - |
| FechaFin | datetime | YES | - |
| UsoCFDI | varchar | YES | 250 |
| TotalIEPS | float | YES | - |
| DomicilioFiscalReceptor | varchar | YES | 50 |

## Table: tblFormasPago

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdFormaPago | varchar | NO | 10 |
| FormaPago | varchar | YES | 250 |

## Table: tblInventariosCostos

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| IdTienda | int | NO | - |
| Exi | decimal | YES | - |
| Costo | decimal | YES | - |
| Salidas | decimal | YES | - |
| Entradas | decimal | YES | - |
| Ventas | decimal | YES | - |
| VentasMenudeo | decimal | YES | - |
| VentasMayoreo | decimal | YES | - |
| PrecioVenta | decimal | YES | - |
| PrecioNormal | decimal | YES | - |
| Compras | decimal | YES | - |
| CostoReal | decimal | YES | - |
| CostoRealIVA | decimal | YES | - |
| IdProveedor | int | YES | - |
| PVD | decimal | YES | - |

## Table: tblKits

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| CodigoInterno | int | NO | - |
| CodigoInterno2 | int | NO | - |
| Factor | float | YES | - |
| Paquete | int | YES | - |

## Table: tblLogPreguntas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdLogPregunta | int | NO | - |
| Pregunta | varchar | YES | -1 |
| Error | int | YES | - |
| FechaPregunta | datetime | YES | - |
| IdUsuario | int | YES | - |
| Resultado | varchar | YES | -1 |
| ConsultaSQL | varchar | YES | -1 |
| MensajeError | varchar | YES | -1 |

## Table: tblLogTablasDetalleConcentrado

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdLog | int | NO | - |
| Tabla | varchar | YES | 50 |
| IdComputadora | int | YES | - |
| IdTienda | int | YES | - |
| Dia | int | YES | - |
| Mes | int | YES | - |
| Anio | int | YES | - |
| Diferencia | int | YES | - |
| FechaAct | datetime | YES | - |
| Completo | int | YES | - |
| ServidorDestino | varchar | YES | 50 |

## Table: tblMeses

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| Mes | int | YES | - |
| MesTexto | varchar | YES | 50 |

## Table: tblMovimientos2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdMovimiento | int | NO | - |
| Movimiento | varchar | YES | 250 |
| Impresiones | int | YES | - |
| FechaMovimiento | datetime | YES | - |
| IdUsuarioMovimiento | int | YES | - |
| IdTienda | int | NO | - |
| FechaAct | datetime | YES | - |
| IdUsuarioCancelado | int | YES | - |
| IdProveedor | int | YES | - |
| TipoMovimiento | int | YES | - |
| Status | int | YES | - |
| Dia | int | YES | - |
| Mes | int | YES | - |
| Anio | int | YES | - |
| FolioMovimiento | varchar | YES | 50 |
| Modificado | int | YES | - |
| Subtotal | float | YES | - |
| Iva | float | YES | - |
| Total | float | YES | - |
| IdDeptoTraspaso | int | YES | - |
| IdFolioInventarioAjuste | int | YES | - |

## Table: tblMovimientosSAP

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdMovimientoSAP | varchar | NO | 50 |
| IdTienda | int | NO | - |
| Mov | float | NO | - |
| CodigoInternoStr | varchar | YES | 50 |
| Concepto | varchar | YES | 250 |
| FechaMovimientoSAP | datetime | YES | - |
| NumeroFactura | varchar | NO | 50 |
| IdTipoMovimiento | int | YES | - |
| CodigoInterno | int | NO | - |

## Table: tblOfertasPublicas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdOfertaPublica | int | NO | - |
| CodigoInterno | int | YES | - |
| PrecioOfertaPublica | float | YES | - |
| FechaInicioPublica | datetime | YES | - |
| FechaFinPublica | datetime | YES | - |

## Table: tblPalabrasClave

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdPalabraClave | int | NO | - |
| Consecutivo | int | YES | - |
| PalabraClave | varchar | YES | 250 |
| FechaAct | datetime | YES | - |
| Status | int | YES | - |

## Table: tblProgramacionPrecios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdSesionProgramacion | int | NO | - |
| InicioPrecios | datetime | YES | - |

## Table: tblProveedores

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdProveedor | int | NO | - |
| Proveedor | varchar | YES | 250 |
| SurtidoDirecto | int | YES | - |
| Status | int | YES | - |
| RFC | varchar | YES | 50 |
| DiasPedido | int | YES | - |
| CorreoElectronico | varchar | YES | 250 |
| DescuentoPtoPago | float | YES | - |
| PlazoPtoPago | int | YES | - |
| Direccion | varchar | YES | 250 |
| Estado | varchar | YES | 250 |
| Tel1 | varchar | YES | 50 |
| Tel2 | varchar | YES | 50 |
| Fax | varchar | YES | 50 |
| ColoniaProveedor | varchar | YES | 250 |
| MunicipioProveedor | varchar | YES | 50 |
| CPProveedor | varchar | YES | 50 |
| AbreEstadoSAP | varchar | YES | 50 |
| CondicionesPago | varchar | YES | 50 |
| DiaSemana | int | YES | - |
| PedidosTransito | int | YES | - |
| SinRevision | int | YES | - |
| IdTiendaProveedor | int | YES | - |

## Table: tblPuestos

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdPuesto | int | NO | - |
| Puesto | varchar | YES | 50 |
| Status | int | YES | - |
| M1 | int | YES | - |
| M2 | int | YES | - |
| M3 | int | YES | - |
| M4 | int | YES | - |
| M5 | int | YES | - |
| M6 | int | YES | - |
| M7 | int | YES | - |
| M8 | int | YES | - |
| M9 | int | YES | - |
| M10 | int | YES | - |
| M11 | int | YES | - |
| M12 | int | YES | - |
| M13 | int | YES | - |
| M14 | int | YES | - |
| M15 | int | YES | - |
| M16 | int | YES | - |
| M17 | int | YES | - |

## Table: tblRazonesSociales

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRazonSocial | int | NO | - |
| RazonSocial | varchar | YES | 250 |
| Calle | varchar | YES | 250 |
| NumeroExterior | varchar | YES | 50 |
| NumeroInterior | varchar | YES | 50 |
| Direccion | varchar | YES | 250 |
| Estado | varchar | YES | 50 |
| Tel1 | varchar | YES | 50 |
| Tel2 | varchar | YES | 50 |
| Fax | varchar | YES | 50 |
| Municipio | varchar | YES | 250 |
| RFC | varchar | YES | 50 |
| CP | varchar | YES | 50 |
| Status | int | YES | - |
| Colonia | varchar | YES | 250 |

## Table: tblRecibo2

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRecibo | int | NO | - |
| IdTienda | int | NO | - |
| FolioRecibo | varchar | YES | 50 |
| IdProveedor | int | YES | - |
| Autorizado | int | YES | - |
| AutorizadoRevision | int | YES | - |
| FechaRecibo | datetime | YES | - |
| IdUsuarioRecibo | int | YES | - |
| Numero | varchar | YES | 50 |
| Total | float | YES | - |
| FechaRevision | datetime | YES | - |
| IdContrarecibo | int | YES | - |
| IdTiendaContrarecibo | int | YES | - |
| IdUsuarioRevision | int | YES | - |
| IdTiendaRevision | int | YES | - |
| Impresiones | int | YES | - |
| TotalRec | float | YES | - |
| IvaRec | float | YES | - |
| TotalDev | float | YES | - |
| IvaDev | float | YES | - |
| Descuentos | float | YES | - |
| FechaAct | datetime | YES | - |
| FechaActRevision | datetime | YES | - |
| AjusteFinanciero | float | YES | - |
| AjusteCostos | float | YES | - |
| AjusteCantidad | float | YES | - |
| AjusteOtro | float | YES | - |
| TotalPagar | float | YES | - |
| IdPago | int | YES | - |
| IdUsuarioCancelado | int | YES | - |
| Documento | varchar | YES | 50 |
| ClaveContingencia | varchar | YES | 50 |
| Modificado | int | YES | - |
| UUID | varchar | YES | 50 |

## Table: tblReciboMovil

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdReciboMovil | int | NO | - |
| IdTienda | int | NO | - |
| Modificado | int | YES | - |
| IdProveedor | int | YES | - |
| FechaRecibo | datetime | YES | - |
| IdUsuarioRecibo | int | YES | - |
| Numero | varchar | YES | -1 |
| Total | float | YES | - |
| Impresiones | int | YES | - |
| IdReciboSistema | int | YES | - |
| FechaAct | datetime | YES | - |
| ErrorSistema | varchar | YES | 250 |
| FolioReciboMovil | varchar | YES | 50 |
| CanastillasEntregadas | int | YES | - |
| CanastillasRecibidas | int | YES | - |
| DescuentoPtoPago | float | YES | - |
| PlazoPtoPago | float | YES | - |
| IdDevolucionSistema | int | YES | - |
| SubtotalRecibo | float | YES | - |
| DescuentosRecibo | float | YES | - |
| IVARecibo | float | YES | - |
| TotalRecibo | float | YES | - |
| SubtotalDevoluciones | float | YES | - |
| DescuentosDevoluciones | float | YES | - |
| IVADevoluciones | float | YES | - |
| TotalDevoluciones | float | YES | - |
| DescuentosFinancieros | float | YES | - |
| TotalPagar | float | YES | - |
| Status | int | YES | - |
| InterfaceReciboSAP | int | YES | - |
| TotalKYK | float | YES | - |
| TotalSAP | float | YES | - |
| InterfaceDevolucionesSAP | int | YES | - |
| IdReciboSAP | int | YES | - |
| IdDevolucionSAP | int | YES | - |
| TotalIEPS | float | YES | - |
| TotalIEPSDevoluciones | float | YES | - |
| UUID | varchar | YES | 2500 |
| EnvioCorreo | int | YES | - |

## Table: tblRecuperaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRecuperacion | int | NO | - |
| Concepto | varchar | YES | -1 |
| FechaAlta | datetime | YES | - |
| Notas | varchar | YES | -1 |
| IdStatusRecuperacion | int | YES | - |
| IdProveedor | int | YES | - |
| IdTienda | int | YES | - |
| Monto | float | YES | - |
| IdUsuario | int | YES | - |
| FechaModificacion | datetime | YES | - |

## Table: tblRecuperacionesComentarios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRecuperacionComentario | int | NO | - |
| IdRecuperacion | int | YES | - |
| Comentario | varchar | YES | -1 |
| IdUsuario | int | YES | - |
| Status | int | YES | - |
| FechaAlta | datetime | YES | - |
| FechaModificacion | datetime | YES | - |
| Monto | float | YES | - |
| Referencia | varchar | YES | 50 |

## Table: tblRegimenesFiscales

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRegimenFiscal | int | NO | - |
| RegimenFiscal | varchar | YES | 250 |

## Table: tblReglasPalabrasClave

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdReglaPalabraClave | int | NO | - |
| IdPalabraClave | int | YES | - |
| Consecutivo | int | YES | - |
| Regla | varchar | YES | -1 |
| IdPerfil | int | YES | - |
| Status | int | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblRetiros

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRetiro | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdApertura | int | YES | - |
| Fecha | datetime | YES | - |
| IdSupervisor | int | YES | - |
| Tarjeta | float | YES | - |
| Efectivo | float | YES | - |
| Devoluciones | float | YES | - |
| Dolares | float | YES | - |
| Cheques | float | YES | - |
| Concepto | varchar | YES | 150 |
| CantidadCheques | int | YES | - |
| TarjetaTeorico | float | YES | - |
| ChequesTeorico | float | YES | - |
| EfectivoTeorico | float | YES | - |
| CantidadTarjeta | float | YES | - |
| Transferencia | float | YES | - |
| TarjetaDebito | float | YES | - |

## Table: tblSAPAccounts

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| AcctCode | varchar | NO | 250 |
| AcctName | varchar | NO | 250 |
| FormatCode | varchar | NO | 250 |
| IdRazonSocial | tinyint | NO | - |

## Table: tblSesionesOfertas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdSesionOferta | int | NO | - |
| FechaInicio | datetime | YES | - |
| FechaFin | datetime | YES | - |
| FechaAct | datetime | YES | - |

## Table: tblStatusOrdenesCompra

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdStatusOrdenCompra | int | NO | - |
| StatusOrdenCompra | varchar | YES | 50 |
| BackColor | varchar | YES | 50 |
| ForeColor | varchar | YES | 50 |

## Table: tblStatusRecuperaciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdStatusRecuperacion | int | NO | - |
| StatusRecuperacion | varchar | YES | 50 |
| Status | int | YES | - |

## Table: tblTablasDetalleConcentrado

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| Tabla | varchar | NO | 50 |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| Dia | int | NO | - |
| Mes | int | NO | - |
| Anio | int | NO | - |
| Cantidad | int | YES | - |
| FechaAct | datetime | YES | - |
| FechaFolio | datetime | YES | - |
| Comparado | int | YES | - |

## Table: tblTiendas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| Tienda | varchar | YES | 250 |
| IdRazonSocial | int | YES | - |
| Host | varchar | YES | 50 |
| FechaSincroniza | datetime | YES | - |
| Direccion | varchar | YES | 250 |
| Municipio | varchar | YES | 250 |
| Colonia | varchar | YES | 250 |
| CP | varchar | YES | 50 |
| Tel1 | varchar | YES | 50 |
| Tel2 | varchar | YES | 50 |
| Fax | varchar | YES | 50 |
| Status | int | YES | - |
| IdProveedor | int | YES | - |
| TipoTienda | int | YES | - |
| Calle | varchar | YES | 250 |
| NumeroExterior | varchar | YES | 250 |
| NumeroInterior | varchar | YES | 250 |
| Estado | varchar | YES | 250 |
| DireccionWebServices | varchar | YES | 250 |

## Table: tblTiendasSincronizacion

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| FechaInicio | datetime | YES | - |
| FechaFin | datetime | YES | - |
| FechaAct | datetime | YES | - |
| Tabla | varchar | YES | 50 |

## Table: tblTiposOrdenesCompra

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTipoOrdenCompra | int | NO | - |
| TipoOrdenCompra | varchar | YES | 50 |
| BackColor | varchar | YES | 50 |
| ForeColor | varchar | YES | 50 |

## Table: tblTmpExistencias20260112

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| Exi | float | NO | - |

## Table: tblTmpVentasCuaresma2025

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| CantidadCuaresma | float | NO | - |
| TotalCuaresma | float | YES | - |
| CantidadNoCuaresma | float | NO | - |
| TotalNoCuaresma | float | YES | - |
| CrecimientoCantidadCuaresma | float | NO | - |
| CrecimientoTotalCuaresma | float | YES | - |

## Table: tblTmpVentasCuaresma2025Pre

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTienda | int | NO | - |
| CodigoInterno | int | NO | - |
| EsCuaresma | int | NO | - |
| Cantidad | float | NO | - |
| Total | float | YES | - |

## Table: tblTransferenciasEntradas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTransferenciaEntrada | int | NO | - |
| TransferenciaEntrada | varchar | YES | 250 |
| FolioEntrada | varchar | YES | 50 |
| IdTienda | int | NO | - |
| FechaEntrada | datetime | YES | - |
| Corte | int | YES | - |
| Status | int | YES | - |
| IdUsuarioCancelado | int | YES | - |
| FechaAct | datetime | YES | - |
| Impresiones | int | YES | - |
| IdUsuarioEntrada | int | YES | - |
| Modificado | int | YES | - |

## Table: tblTransferenciasSalidas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdTransferenciaSalida | int | NO | - |
| TransferenciaSalida | varchar | YES | 250 |
| FolioSalida | varchar | YES | 50 |
| FolioEntrada | varchar | YES | 50 |
| IdTransferenciaEntrada | int | YES | - |
| IdTienda | int | NO | - |
| IdTiendaDestino | int | YES | - |
| FechaSalida | datetime | YES | - |
| IdUsuarioSalida | int | YES | - |
| FechaEntrada | datetime | YES | - |
| Corte | int | YES | - |
| Status | int | YES | - |
| IdUsuarioCancelado | int | YES | - |
| Total | float | YES | - |
| FechaAct | datetime | YES | - |
| Impresiones | int | YES | - |
| ModificadoOrigen | int | YES | - |
| ModificadoDestino | int | YES | - |
| ClaveContingencia | varchar | YES | 50 |
| Subtotal | float | YES | - |
| IVA | float | YES | - |
| TransmitidoTiendaDestino | int | YES | - |
| Modifiado | int | YES | - |
| UUID | varchar | YES | 50 |

## Table: tblUsosCFDI

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdUsoCFDI | varchar | NO | 50 |
| UsoCFDI | varchar | YES | 250 |

## Table: tblUsuarios

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdUsuario | int | NO | - |
| Usuario | varchar | YES | 250 |
| IdPuesto | int | YES | - |
| FechaNacimiento | datetime | YES | - |
| FechaIngreso | datetime | YES | - |
| Contrasenia | varchar | YES | 50 |
| Contrasenia2 | varchar | YES | 50 |
| CodigoBarras | varchar | YES | 50 |
| IdTienda | int | YES | - |
| Status | int | YES | - |

## Table: tblVales

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVale | int | NO | - |
| Vale | varchar | YES | 50 |
| Importe | float | YES | - |

## Table: tblValesCierres

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVale | int | NO | - |
| IdApertura | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| EsTarjeta | int | NO | - |
| Importe | float | YES | - |

## Table: tblValesCierresX

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVale | int | NO | - |
| IdAperturaX | int | NO | - |
| IdTienda | int | NO | - |
| IdComputadora | int | NO | - |
| EsTarjeta | int | NO | - |
| Importe | float | YES | - |

## Table: tblValesRetiros

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdRetiro | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdVale | int | NO | - |
| EsTarjeta | int | NO | - |
| Importe | float | YES | - |
| CantidadVales | float | YES | - |
| ValesTeorico | float | YES | - |

## Table: tblVentas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| FechaVenta | datetime | YES | - |
| IdApertura | int | YES | - |
| Efectivo | float | YES | - |
| Pago | float | YES | - |
| Total | float | YES | - |
| DescuentoEfectivo | float | YES | - |

## Table: tblVentasCheques

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdBanco | int | YES | - |
| Clave | int | YES | - |
| Cheques | float | YES | - |
| Cuenta | varchar | YES | 50 |

## Table: tblVentasDevoluciones

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| Devoluciones | float | YES | - |
| IdDevolucionVenta | int | YES | - |

## Table: tblVentasDolares

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| Dolares | float | NO | - |
| TipoCambio | float | YES | - |

## Table: tblVentasRefacturadas

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdComputadora | int | NO | - |
| IdVenta | int | NO | - |
| IdTienda | int | NO | - |
| IdFacturaCorte | int | NO | - |
| IdFacturaCliente | int | NO | - |
| FechaAct | datetime | YES | - |
| IdNotaCredito | int | NO | - |
| TransmitidoSQL | int | YES | - |

## Table: tblVentasTarjeta

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| Tarjeta | float | YES | - |

## Table: tblVentasTransferencias

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| Transferencia | float | YES | - |

## Table: tblVentasVales

| Column | Type | Nullable | Max Length |
| :--- | :--- | :--- | :--- |
| IdVenta | int | NO | - |
| IdComputadora | int | NO | - |
| IdTienda | int | NO | - |
| IdVale | int | NO | - |
| ValesTarjeta | float | YES | - |
| Vales | float | YES | - |

## Relationships (Foreign Keys)

| Parent Table | Parent Column | Referenced Table | Referenced Column |
| :--- | :--- | :--- | :--- |
