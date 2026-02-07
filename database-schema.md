# Database Schema

## Tables

### Cancelaciones

| Column Name | Data Type |
| :--- | :--- |
| IdCancelacion | int |
| Caja | int |
| IdTienda | int |
| FechaCancelacion | datetime |
| IdSupervisor | int |
| IdApertura | int |
| Completo | int |
| Z | int |
| Supervisor | varchar |
| Cajero | varchar |
| CodigoBarras | varchar |
| Descripcion | varchar |
| Cantidad | float |
| PrecioVenta | float |
| Total | float |
| Tienda | varchar |
| MesTexto | varchar |
| Mes | int |
| Anio | int |
| DiaSemanaTexto | varchar |
| MesAnio | varchar |

### Compras

| Column Name | Data Type |
| :--- | :--- |
| IdReciboMovil | int |
| IdTienda | int |
| Modificado | int |
| IdProveedor | int |
| FechaRecibo | datetime |
| IdUsuarioRecibo | int |
| Numero | varchar |
| Total | float |
| Impresiones | int |
| IdReciboSistema | int |
| FechaAct | datetime |
| ErrorSistema | varchar |
| FolioReciboMovil | varchar |
| CanastillasEntregadas | int |
| CanastillasRecibidas | int |
| DescuentoPtoPago | float |
| PlazoPtoPago | float |
| IdDevolucionSistema | int |
| SubtotalRecibo | float |
| DescuentosRecibo | float |
| IVARecibo | float |
| TotalRecibo | float |
| SubtotalDevoluciones | float |
| DescuentosDevoluciones | float |
| IVADevoluciones | float |
| TotalDevoluciones | float |
| DescuentosFinancieros | float |
| TotalPagar | float |
| Status | int |
| InterfaceReciboSAP | int |
| TotalKYK | float |
| TotalSAP | float |
| InterfaceDevolucionesSAP | int |
| IdReciboSAP | int |
| IdDevolucionSAP | int |
| TotalIEPS | float |
| TotalIEPSDevoluciones | float |
| UUID | varchar |
| EnvioCorreo | int |
| Proveedor | varchar |
| RFC | varchar |
| Tienda | varchar |

### ComprasDetalle

| Column Name | Data Type |
| :--- | :--- |
| IdReciboMovil | int |
| IdTienda | int |
| Modificado | int |
| IdProveedor | int |
| FechaRecibo | datetime |
| IdUsuarioRecibo | int |
| Numero | varchar |
| Total | float |
| Impresiones | int |
| IdReciboSistema | int |
| FechaAct | datetime |
| ErrorSistema | varchar |
| FolioReciboMovil | varchar |
| CanastillasEntregadas | int |
| CanastillasRecibidas | int |
| DescuentoPtoPago | float |
| PlazoPtoPago | float |
| IdDevolucionSistema | int |
| SubtotalRecibo | float |
| DescuentosRecibo | float |
| IVARecibo | float |
| TotalRecibo | float |
| SubtotalDevoluciones | float |
| DescuentosDevoluciones | float |
| IVADevoluciones | float |
| TotalDevoluciones | float |
| DescuentosFinancieros | float |
| TotalPagar | float |
| Status | int |
| InterfaceReciboSAP | int |
| TotalKYK | float |
| TotalSAP | float |
| InterfaceDevolucionesSAP | int |
| IdReciboSAP | int |
| IdDevolucionSAP | int |
| TotalIEPS | float |
| TotalIEPSDevoluciones | float |
| UUID | varchar |
| EnvioCorreo | int |
| Proveedor | varchar |
| RFC | varchar |
| Tienda | varchar |
| CodigoBarras | varchar |
| Descripcion | varchar |
| Depto | varchar |
| Cantidad | float |
| Costo | float |
| Iva | float |
| Desc0 | float |
| Desc1 | float |
| Desc2 | float |
| Desc3 | float |
| Desc4 | float |
| Factor | float |
| Devolucion | int |
| CantidadCompra | float |
| IEPS | float |
| Expr1 | float |

### Cortes

| Column Name | Data Type |
| :--- | :--- |
| IdApertura | int |
| FechaApertura | datetime |
| EfectivoInicio | float |
| FechaCierre | datetime |
| VistaPrecios | int |
| Cancelados | int |
| Impresiones | int |
| TicketCorte | varchar |
| Cajero | varchar |
| Tienda | varchar |
| IdTienda | int |
| Caja | int |
| TotalVenta | float |
| Mes | int |
| Anio | int |
| MesTexto | varchar |
| DiaSemanaTexto | varchar |
| MesAnio | varchar |

### InternasHoy

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| PrecioOferta | float |
| FechaInicio | datetime |
| FechaFin | datetime |
| Factor | int |

### Ofertas

| Column Name | Data Type |
| :--- | :--- |
| Factor | int |
| IdOfertaPublica | int |
| CodigoInterno | int |
| PrecioOfertaPublica | float |
| FechaInicioPublica | datetime |
| FechaFinPublica | datetime |
| CodigoBarras | varchar |
| Descripcion | varchar |

### OfertasHoy

| Column Name | Data Type |
| :--- | :--- |
| Factor | int |
| IdOfertaPublica | int |
| CodigoInterno | int |
| PrecioOfertaPublica | float |
| FechaInicioPublica | datetime |
| FechaFinPublica | datetime |
| CodigoBarras | varchar |
| Descripcion | varchar |

### Productos

| Column Name | Data Type |
| :--- | :--- |
| UltimoCosto | float |
| Caja | int |
| CantidadCaja | float |
| MedidaVenta | varchar |
| MedidaCompra | varchar |
| IdDepto | int |
| CodigoInterno2 | int |
| Iva | float |
| Descripcion | varchar |
| IdTipo | int |
| CodigoBarras | varchar |
| CodigoInterno | int |
| PrecioOferta | float |
| FechaInicio | datetime |
| FechaFin | datetime |
| PrecioOfertaPublica | float |
| FechaInicioPublica | datetime |
| FechaFinPublica | datetime |
| Precio | float |
| Descuento0 | float |
| Descuento1 | float |
| Descuento2 | float |
| Descuento3 | float |
| Escala 1 | float |
| Escala 2 | float |
| Escala 3 | float |
| Escala 4 | float |
| CambioPrecio | datetime |
| CompraIndependiente | int |
| DescuentosMayoreo | int |
| FactorVenta | float |
| TipoOperacion | int |
| IdProveedorDefault | int |
| IEPS | float |
| IEPSCantidad | float |
| ClaveCFDI | varchar |
| DescripcionCFDI | varchar |
| Depto | varchar |
| PrecioVenta | float |
| FechaAct | datetime |
| Precio Escala 1 | float |
| Precio Escala 2 | float |
| Precio Escala 3 | float |
| Precio Escala 4 | float |
| Utilidad | float |

### ProductosProveedor

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| CodigoBarras | varchar |
| Depto | varchar |
| PrecioVenta | float |
| FechaAct | datetime |
| Descripcion | varchar |
| Iva | float |
| MedidaVenta | varchar |
| UltimoCosto | float |
| Costo | float |
| CodigoCompra | varchar |
| DescripcionCompra | varchar |
| CantidadCompra | float |
| Desc0 | float |
| Desc1 | float |
| Desc2 | float |
| Desc3 | float |
| Desc4 | float |
| FactorVolumen | float |
| CostoReal | float |
| Cambio_Costo | datetime |
| Proveedor | varchar |
| RFC | varchar |
| DiasPedido | int |

### ProgramacionPreciosHoy

| Column Name | Data Type |
| :--- | :--- |
| IdSesionProgramacion | int |
| CodigoInterno | int |
| Precio | decimal |
| Descuento0 | decimal |
| Descuento1 | decimal |
| Descuento2 | decimal |
| Descuento3 | decimal |
| EscalaSuperior0 | decimal |
| EscalaSuperior1 | decimal |
| EscalaSuperior2 | decimal |
| EscalaSuperior3 | decimal |
| IVA | decimal |
| InicioPrecios | datetime |
| Factor | int |

### Retiros

| Column Name | Data Type |
| :--- | :--- |
| IdRetiro | int |
| Caja | int |
| IdTienda | int |
| IdApertura | int |
| Fecha | datetime |
| IdSupervisor | int |
| Concepto | varchar |
| Supervisor | varchar |
| Cajero | varchar |
| Z | int |
| Monto | float |
| Tienda | varchar |
| MesTexto | varchar |
| DiaSemanaTexto | varchar |
| MesAnio | varchar |

### SucursalesActivas

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| Tienda | varchar |
| IdRazonSocial | int |
| Host | varchar |
| FechaSincroniza | datetime |
| Direccion | varchar |
| Municipio | varchar |
| Colonia | varchar |
| CP | varchar |
| Tel1 | varchar |
| Tel2 | varchar |
| Fax | varchar |
| Status | int |
| IdProveedor | int |
| TipoTienda | int |
| Calle | varchar |
| NumeroExterior | varchar |
| NumeroInterior | varchar |
| Estado | varchar |
| DireccionWebServices | varchar |

### tblActualizaciones

| Column Name | Data Type |
| :--- | :--- |
| Tabla | varchar |
| FechaAct | datetime |
| IdTienda | int |
| EsError | int |
| Error | varchar |
| FechaOK | datetime |

### tblActualizacionesTotales

| Column Name | Data Type |
| :--- | :--- |
| Tabla | varchar |
| Dia | int |
| Mes | int |
| Anio | int |
| FechaAct | datetime |

### tblAjustesAuditorias

| Column Name | Data Type |
| :--- | :--- |
| IdAjusteAuditoria | int |
| IdProveedor | int |
| FechaAjusteAuditoria | datetime |
| Dia | int |
| Mes | int |
| Anio | int |
| FechaAct | datetime |
| IdTienda | int |
| IdUsuarioAjusteAuditoria | int |

### tblAjustesInventarios

| Column Name | Data Type |
| :--- | :--- |
| IdAjusteInventario | int |
| IdTienda | int |
| AjusteInventario | varchar |
| FechaAjuste | datetime |
| IdUsuarioAjuste | int |
| Impresiones | int |

### tblAjustesPorCaptura

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| Dia | int |
| Mes | int |
| Anio | int |
| Exi | float |
| FechaCaptura | datetime |
| IdUsuarioCaptura | int |
| IdTienda | int |

### tblAjustesProveedores

| Column Name | Data Type |
| :--- | :--- |
| IdProveedor | int |
| Dia | int |
| Mes | int |
| Anio | int |
| IdTienda | int |
| FechaRevision | datetime |
| IdUsuarioAjuste | int |
| TotalAjusteEntrada | float |
| TotalAjusteSalida | float |
| IdMovimientoEntrada | int |
| IdMovimientoSalida | int |
| Status | int |
| IdUsuarioRevision | int |

### tblAperturasCierres

| Column Name | Data Type |
| :--- | :--- |
| IdApertura | int |
| IdComputadora | int |
| IdTienda | int |
| FechaApertura | datetime |
| IdCajero | int |
| IdSupervisorApertura | int |
| EfectivoInicio | float |
| FechaCierre | datetime |
| Efectivo | float |
| Cheques | float |
| Tarjeta | float |
| Dolares | float |
| IdSupervisorCierre | int |
| VistaPrecios | int |
| Cancelados | int |
| CierreTemporal | int |
| Impresiones | int |
| Marcados | int |
| Devoluciones | float |
| IdFactura | int |
| Transferencia | float |
| IdVentaInicio | int |
| IdVentaFin | int |
| TicketCorte | varchar |

### tblAperturasX

| Column Name | Data Type |
| :--- | :--- |
| IdAperturaX | int |
| IdApertura | int |
| IdComputadora | int |
| IdTienda | int |
| FechaInicio | datetime |
| FechaFin | datetime |
| IdCajero | int |
| IdSupervisorApertura | int |
| EfectivoInicio | float |
| Efectivo | float |
| Cheques | float |
| Tarjeta | float |
| Dolares | float |
| Devoluciones | float |
| Marcados | int |
| Cancelados | int |
| VistaPrecios | int |
| IdSupervisorCierre | int |
| Impresiones | int |
| TotalVentas | float |
| Transferencia | float |

### tblArticulos

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| CodigoBarras | varchar |
| Descripcion | varchar |
| IdTipo | int |
| Status | int |
| ConsumoInterno | int |
| CantidadCaja | float |
| CodigoInterno2 | int |
| Caja | int |
| UltimoCosto | float |
| FechaAct | datetime |
| IdDepto | int |
| IdProveedorDefault | int |
| MedidaCompra | varchar |
| CantidadCompra | float |
| MedidaVenta | varchar |
| TipoOperacion | int |
| Precio | float |
| Descuento0 | float |
| Descuento1 | float |
| Descuento2 | float |
| Descuento3 | float |
| EscalaSuperior0 | float |
| EscalaSuperior1 | float |
| EscalaSuperior2 | float |
| EscalaSuperior3 | float |
| PrecioOferta | float |
| Iva | float |
| DescripcionCompra | varchar |
| ErrorSAP | varchar |
| ItmsGrpCod | varchar |
| Categoria | varchar |
| Familia | varchar |
| IEPS | float |
| IEPSCantidad | float |
| Contenido | float |
| FactorVenta | float |
| ClaveCFDI | varchar |
| DescripcionCFDI | varchar |

### tblArticulosOcultos

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| FechaAct | datetime |

### tblArticulosProveedor

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| IdProveedor | int |
| Costo | float |
| CodigoCompra | varchar |
| DescripcionCompra | varchar |
| CantidadCompra | float |
| Desc0 | float |
| Desc1 | float |
| Desc2 | float |
| Desc3 | float |
| Desc4 | float |
| FactorVolumen | float |
| CostoReal | float |
| FechaAct | datetime |
| SoloDevolucion | int |
| Destare1 | float |
| Destare2 | float |

### tblBufferRepCortes

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| IdComputadora | int |
| IdDepto | int |
| Impuesto | int |
| TipoCorte | int |
| Valor1 | float |
| Valor2 | float |
| Valor3 | float |
| Valor4 | float |
| Valor5 | float |
| Valor6 | float |
| Valor7 | float |
| Valor8 | float |
| Valor9 | float |
| Valor10 | float |
| Valor11 | float |
| Valor12 | float |
| Valor13 | float |
| Valor14 | float |
| Valor15 | float |
| Valor16 | float |
| Valor17 | float |
| Valor18 | float |
| Valor19 | float |
| Valor20 | float |
| Valor21 | float |
| Valor22 | float |
| Valor23 | float |
| Valor24 | float |
| Valor25 | float |
| Valor26 | float |
| Valor27 | float |
| Valor28 | float |
| Valor29 | float |
| Valor30 | float |
| Valor31 | float |
| Total | float |

### tblBufferRepCortesCancelaciones

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCajero | int |
| Cancelaciones | int |
| FechaApertura | datetime |
| TotalCancelaciones | float |

### tblBufferRepCortesCancelacionesSupervisor

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCajero | int |
| Cancelaciones | int |
| FechaApertura | datetime |
| TotalCancelaciones | float |

### tblBufferRepCortesDetalleCancelaciones

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCancelacion | int |
| CodigoInterno | int |
| FechaCancelacion | datetime |
| Cantidad | float |
| PrecioVenta | float |
| IdSupervisor | int |
| IdCajero | int |

### tblBufferRepCortesDetalleCancelacionesSupervisor

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCancelacion | int |
| CodigoInterno | int |
| FechaCancelacion | datetime |
| Cantidad | float |
| PrecioVenta | float |
| IdSupervisor | int |
| IdCajero | int |

### tblBufferRepCortesDifEfectivo

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| EsRetiros | int |
| TotalRetiros | float |
| TotalVentas | float |
| IdTienda | int |

### tblBufferRepCortesFacturas

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCajero | int |
| TotalFacturasGlobal | float |
| TotalClientes | float |
| TotalRefacturado | float |
| TicketCorte | varchar |
| FechaApertura | datetime |
| FechaFacturaGlobal | datetime |
| UUIDGlobal | varchar |
| FacturasClientes | int |
| TotalVentas | float |

### tblBufferRepCortesFormasPago

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdComputadoraVenta | int |
| IdApertura | int |
| IdFormaPago | int |
| IdVale | int |
| FormaPago | varchar |
| Monto | float |
| IdTienda | int |

### tblBufferRepCortesPorAperturas

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdComputadoraVenta | int |
| IdApertura | int |
| TipoCorte | int |
| IdDepto | int |
| Operaciones | int |
| Valor | float |
| ValorSinIva | float |
| ValorSinIeps | float |
| ValorIva | float |
| ValorIeps | float |
| AcctCodeSAP | varchar |
| CuentaContableSAP | varchar |
| IdTienda | int |

### tblBufferRepCortesPre

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| IdComputadora | int |
| IdDepto | int |
| Anio | int |
| Mes | int |
| Dia | int |
| TipoCorte | int |
| Valor | float |
| ValorSinIva | float |
| ValorSinIeps | float |
| ValorIva | float |
| ValorIeps | float |

### tblBufferRepCortesRetiros

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdComputadoraVenta | int |
| IdRetiro | int |
| IdApertura | int |
| Monto | float |
| FechaRetiro | datetime |
| Concepto | varchar |
| Concepto1 | varchar |
| Concepto2 | varchar |
| AcctCodeSAP | varchar |
| CuentaContableSAP | varchar |
| IdTienda | int |

### tblBufferRepFacturas

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdFactura | int |
| Credito | int |
| TipoFactura | varchar |
| Serie | varchar |
| FolioFactura | varchar |
| FechaFactura | datetime |
| RFC | varchar |
| ClienteConcepto | varchar |
| UUID | varchar |
| FormaPago | varchar |
| MetodoPago | varchar |
| UsoCFDI | varchar |
| Total | float |
| TotalIVA | float |
| TotalIEPS | float |
| IdApertura | int |
| IdComputadoraVenta | int |
| IdCajero | int |
| FechaApertura | datetime |

### tblBufferRepFacturasClientes

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| IdComputadoraVenta | int |
| TotalFacturas | float |
| CantidadFacturas | int |

### tblCajas

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| Cantidad | float |
| CodigoBarras | varchar |

### tblCancelaciones

| Column Name | Data Type |
| :--- | :--- |
| IdCancelacion | int |
| IdComputadora | int |
| IdTienda | int |
| FechaCancelacion | datetime |
| IdSupervisor | int |
| IdApertura | int |
| Completo | int |

### tblCapturaExistencias

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| CodigoInterno | int |
| ExiCaptura | float |
| Dia | int |
| Mes | int |
| Anio | int |
| FechaCaptura | datetime |
| IdProveedor | int |
| IdAjusteAuditoria | int |
| Exi | float |
| CadenaFolios | varchar |
| IdUsuarioCaptura | int |
| ExiAjuste | float |

### tblCapturaExistenciasHoy

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| CodigoInterno | int |
| ExiCaptura | float |
| Dia | int |
| Mes | int |
| Anio | int |
| FechaCaptura | datetime |
| IdProveedor | int |
| IdAjusteAuditoria | int |
| Exi | float |
| CadenaFolios | varchar |
| IdUsuarioCaptura | int |
| ExiAjuste | float |

### tblComputadoras

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| Computadora | varchar |
| Activa | int |
| Host | varchar |
| VersionKYKCortes | varchar |
| FechaUltimoAcceso | datetime |
| Modificado | int |

### tblCuentasContablesSAP

| Column Name | Data Type |
| :--- | :--- |
| TipoConcepto | tinyint |
| IdTipoConcepto | tinyint |
| IdTienda | tinyint |
| CuentaContableSAP | varchar |
| AcctCode | varchar |
| Mes | tinyint |
| AcctCodeSAP | varchar |

### tblDeptos

| Column Name | Data Type |
| :--- | :--- |
| IdDepto | int |
| Depto | varchar |

### tblDetalleAjustesInventarios

| Column Name | Data Type |
| :--- | :--- |
| IdAjusteInventario | int |
| IdTienda | int |
| CodigoInterno | int |
| CostoReal | float |
| ExiAnt | float |
| Exi | float |

### tblDetalleCancelaciones

| Column Name | Data Type |
| :--- | :--- |
| IdCancelacion | int |
| IdComputadora | int |
| IdTienda | int |
| CodigoInterno | int |
| Cantidad | float |
| PrecioVenta | float |

### tblDetalleDevolucionesCompra

| Column Name | Data Type |
| :--- | :--- |
| IdProveedor | int |
| IdTienda | int |
| CodigoInterno | int |
| FechaAct | datetime |
| Dev | float |
| Modificado | int |
| IdUsuarioDevolucionCompra | int |

### tblDetalleDevolucionesVenta

| Column Name | Data Type |
| :--- | :--- |
| IdDetalleDevolucionVenta | int |
| IdTienda | int |
| IdDevolucionVenta | int |
| CodigoInterno | int |
| Cantidad | float |
| CantidadAnterior | float |
| PrecioVenta | float |
| PrecioVentaAnterior | float |
| IVA | float |
| IEPS | float |
| IdVenta | int |
| IdComputadora | int |

### tblDetalleEmpacados2

| Column Name | Data Type |
| :--- | :--- |
| IdEmpacado | int |
| CodigoInterno | int |
| IdTienda | int |
| Cantidad | float |
| Comentarios | varchar |
| TipoMovimiento | int |

### tblDetalleEmpacados3

| Column Name | Data Type |
| :--- | :--- |
| IdEmpacado | int |
| CodigoInterno | int |
| IdTienda | int |
| Cantidad | float |
| Comentarios | varchar |
| TipoMovimiento | int |

### tblDetalleFacturas

| Column Name | Data Type |
| :--- | :--- |
| IdFactura | int |
| IdTienda | int |
| IdVenta | int |
| IdComputadora | int |
| Credito | int |

### tblDetalleMovimientos2

| Column Name | Data Type |
| :--- | :--- |
| IdMovimiento | int |
| CodigoInterno | int |
| IdTienda | int |
| Mov | float |
| Costo | float |
| Iva | float |
| FechaAct | datetime |

### tblDetalleProgramacionPrecios

| Column Name | Data Type |
| :--- | :--- |
| IdSesionProgramacion | int |
| CodigoInterno | int |
| Precio | decimal |
| Descuento0 | decimal |
| Descuento1 | decimal |
| Descuento2 | decimal |
| Descuento3 | decimal |
| EscalaSuperior0 | decimal |
| EscalaSuperior1 | decimal |
| EscalaSuperior2 | decimal |
| EscalaSuperior3 | decimal |
| IVA | decimal |

### tblDetalleRecibo2

| Column Name | Data Type |
| :--- | :--- |
| IdRecibo | int |
| CodigoInterno | int |
| IdTienda | int |
| Rec | float |
| RecGranel | float |
| Costo | float |
| Iva | float |
| Desc0 | float |
| Desc1 | float |
| Desc2 | float |
| Desc3 | float |
| Desc4 | float |
| Factor | float |
| Devolucion | int |
| CantidadCompra | float |
| IEPS | float |
| IEPSCantidad | float |

### tblDetalleReciboMovil

| Column Name | Data Type |
| :--- | :--- |
| IdReciboMovil | int |
| CodigoInterno | int |
| IdTienda | int |
| Rec | float |
| RecGranel | float |
| Costo | float |
| Iva | float |
| Desc0 | float |
| Desc1 | float |
| Desc2 | float |
| Desc3 | float |
| Desc4 | float |
| Factor | float |
| Devolucion | int |
| CantidadCompra | float |
| FechaCaducidad | varchar |
| ExiAnterior | float |
| StatusInventario | int |
| Pedido | float |
| CajasTara | float |
| Tara | float |
| PesoTotal | float |
| CajasTara2 | float |
| Tara2 | float |
| PesoTotal2 | float |
| CajasTara3 | float |
| Tara3 | float |
| PesoTotal3 | float |
| CajasTara4 | float |
| Tara4 | float |
| PesoTotal4 | float |
| IEPS | float |
| IEPSCantidad | float |
| Temperatura | float |
| IdRenglonFacturaProveedor | int |

### tblDetalleSesionesOfertas

| Column Name | Data Type |
| :--- | :--- |
| IdSesionOferta | int |
| CodigoInterno | int |
| PrecioOferta | float |

### tblDetalleTransferenciasSalidas

| Column Name | Data Type |
| :--- | :--- |
| IdTransferenciaSalida | int |
| CodigoInterno | int |
| IdTienda | int |
| Costo | float |
| Iva | float |
| Mov | float |
| CantidadCompra | float |
| Modificado | int |
| FechaAct | datetime |

### tblDetalleVentas

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| CodigoInterno | int |
| Cantidad | float |
| PrecioVenta | float |
| PrecioNormal | float |
| Iva | float |

### tblDevolucionesVenta

| Column Name | Data Type |
| :--- | :--- |
| IdDevolucionVenta | int |
| IdTienda | int |
| FechaDevolucionVenta | datetime |
| IdUsuario | int |
| Valor | float |
| Status | int |
| IdComputadoraCanje | int |
| FechaCanje | datetime |
| ClaveDevolucion | varchar |
| Cliente | varchar |
| Concepto | varchar |
| DirTel | varchar |
| Impresiones | int |
| DiasCaducidad | int |
| Empleado | varchar |
| IdFactura | int |
| Credito | int |

### tblDiasSemana

| Column Name | Data Type |
| :--- | :--- |
| DiaSemana | int |
| DiaSemanaTexto | varchar |

### tblEmpacados2

| Column Name | Data Type |
| :--- | :--- |
| IdEmpacado | int |
| IdUsuarioEmpacado | int |
| IdTienda | int |
| FechaAct | datetime |
| Impresiones | int |
| Concepto | varchar |
| FechaEmpacado | datetime |
| Modificado | int |
| Corte | int |

### tblFacturas

| Column Name | Data Type |
| :--- | :--- |
| IdFactura | int |
| Credito | int |
| IdTienda | int |
| FechaFactura | datetime |
| AlfaNumerico | varchar |
| IdUsuario | int |
| RFC | varchar |
| ClienteConcepto | varchar |
| Total | float |
| IVA | float |
| MetodoPago | varchar |
| Cuenta | varchar |
| UUID | varchar |
| IdApertura | int |
| IdComputadora | int |
| Serie | varchar |
| TipoCFDI | varchar |
| FormaPago | varchar |
| RegimenFiscal | varchar |
| FechaInicio | datetime |
| FechaFin | datetime |
| UsoCFDI | varchar |
| TotalIEPS | float |
| DomicilioFiscalReceptor | varchar |

### tblFormasPago

| Column Name | Data Type |
| :--- | :--- |
| IdFormaPago | varchar |
| FormaPago | varchar |

### tblKits

| Column Name | Data Type |
| :--- | :--- |
| CodigoInterno | int |
| CodigoInterno2 | int |
| Factor | float |
| Paquete | int |

### tblLogTablasDetalleConcentrado

| Column Name | Data Type |
| :--- | :--- |
| IdLog | int |
| Tabla | varchar |
| IdComputadora | int |
| IdTienda | int |
| Dia | int |
| Mes | int |
| Anio | int |
| Diferencia | int |
| FechaAct | datetime |
| Completo | int |
| ServidorDestino | varchar |

### tblMeses

| Column Name | Data Type |
| :--- | :--- |
| Mes | int |
| MesTexto | varchar |

### tblMovimientos2

| Column Name | Data Type |
| :--- | :--- |
| IdMovimiento | int |
| Movimiento | varchar |
| Impresiones | int |
| FechaMovimiento | datetime |
| IdUsuarioMovimiento | int |
| IdTienda | int |
| FechaAct | datetime |
| IdUsuarioCancelado | int |
| IdProveedor | int |
| TipoMovimiento | int |
| Status | int |
| Dia | int |
| Mes | int |
| Anio | int |
| FolioMovimiento | varchar |
| Modificado | int |
| Subtotal | float |
| Iva | float |
| Total | float |
| IdDeptoTraspaso | int |
| IdFolioInventarioAjuste | int |

### tblMovimientosSAP

| Column Name | Data Type |
| :--- | :--- |
| IdMovimientoSAP | varchar |
| IdTienda | int |
| Mov | float |
| CodigoInternoStr | varchar |
| Concepto | varchar |
| FechaMovimientoSAP | datetime |
| NumeroFactura | varchar |
| IdTipoMovimiento | int |
| CodigoInterno | int |

### tblOfertasPublicas

| Column Name | Data Type |
| :--- | :--- |
| IdOfertaPublica | int |
| CodigoInterno | int |
| PrecioOfertaPublica | float |
| FechaInicioPublica | datetime |
| FechaFinPublica | datetime |

### tblProgramacionPrecios

| Column Name | Data Type |
| :--- | :--- |
| IdSesionProgramacion | int |
| InicioPrecios | datetime |

### tblProveedores

| Column Name | Data Type |
| :--- | :--- |
| IdProveedor | int |
| Proveedor | varchar |
| SurtidoDirecto | int |
| Status | int |
| RFC | varchar |
| DiasPedido | int |
| CorreoElectronico | varchar |
| DescuentoPtoPago | float |
| PlazoPtoPago | int |
| Direccion | varchar |
| Estado | varchar |
| Tel1 | varchar |
| Tel2 | varchar |
| Fax | varchar |
| ColoniaProveedor | varchar |
| MunicipioProveedor | varchar |
| CPProveedor | varchar |
| AbreEstadoSAP | varchar |
| CondicionesPago | varchar |
| DiaSemana | int |
| PedidosTransito | int |
| SinRevision | int |
| IdTiendaProveedor | int |

### tblPuestos

| Column Name | Data Type |
| :--- | :--- |
| IdPuesto | int |
| Puesto | varchar |
| Status | int |
| M1 | int |
| M2 | int |
| M3 | int |
| M4 | int |
| M5 | int |
| M6 | int |
| M7 | int |
| M8 | int |
| M9 | int |
| M10 | int |
| M11 | int |
| M12 | int |
| M13 | int |
| M14 | int |
| M15 | int |
| M16 | int |
| M17 | int |

### tblRazonesSociales

| Column Name | Data Type |
| :--- | :--- |
| IdRazonSocial | int |
| RazonSocial | varchar |
| Calle | varchar |
| NumeroExterior | varchar |
| NumeroInterior | varchar |
| Direccion | varchar |
| Estado | varchar |
| Tel1 | varchar |
| Tel2 | varchar |
| Fax | varchar |
| Municipio | varchar |
| RFC | varchar |
| CP | varchar |
| Status | int |
| Colonia | varchar |

### tblRecibo2

| Column Name | Data Type |
| :--- | :--- |
| IdRecibo | int |
| IdTienda | int |
| FolioRecibo | varchar |
| IdProveedor | int |
| Autorizado | int |
| AutorizadoRevision | int |
| FechaRecibo | datetime |
| IdUsuarioRecibo | int |
| Numero | varchar |
| Total | float |
| FechaRevision | datetime |
| IdContrarecibo | int |
| IdTiendaContrarecibo | int |
| IdUsuarioRevision | int |
| IdTiendaRevision | int |
| Impresiones | int |
| TotalRec | float |
| IvaRec | float |
| TotalDev | float |
| IvaDev | float |
| Descuentos | float |
| FechaAct | datetime |
| FechaActRevision | datetime |
| AjusteFinanciero | float |
| AjusteCostos | float |
| AjusteCantidad | float |
| AjusteOtro | float |
| TotalPagar | float |
| IdPago | int |
| IdUsuarioCancelado | int |
| Documento | varchar |
| ClaveContingencia | varchar |
| Modificado | int |
| UUID | varchar |

### tblReciboMovil

| Column Name | Data Type |
| :--- | :--- |
| IdReciboMovil | int |
| IdTienda | int |
| Modificado | int |
| IdProveedor | int |
| FechaRecibo | datetime |
| IdUsuarioRecibo | int |
| Numero | varchar |
| Total | float |
| Impresiones | int |
| IdReciboSistema | int |
| FechaAct | datetime |
| ErrorSistema | varchar |
| FolioReciboMovil | varchar |
| CanastillasEntregadas | int |
| CanastillasRecibidas | int |
| DescuentoPtoPago | float |
| PlazoPtoPago | float |
| IdDevolucionSistema | int |
| SubtotalRecibo | float |
| DescuentosRecibo | float |
| IVARecibo | float |
| TotalRecibo | float |
| SubtotalDevoluciones | float |
| DescuentosDevoluciones | float |
| IVADevoluciones | float |
| TotalDevoluciones | float |
| DescuentosFinancieros | float |
| TotalPagar | float |
| Status | int |
| InterfaceReciboSAP | int |
| TotalKYK | float |
| TotalSAP | float |
| InterfaceDevolucionesSAP | int |
| IdReciboSAP | int |
| IdDevolucionSAP | int |
| TotalIEPS | float |
| TotalIEPSDevoluciones | float |
| UUID | varchar |
| EnvioCorreo | int |

### tblRecuperaciones

| Column Name | Data Type |
| :--- | :--- |
| IdRecuperacion | int |
| Concepto | varchar |
| FechaAlta | datetime |
| Notas | varchar |
| IdStatusRecuperacion | int |
| IdProveedor | int |
| IdTienda | int |
| Monto | float |
| IdUsuario | int |
| FechaModificacion | datetime |

### tblRecuperacionesComentarios

| Column Name | Data Type |
| :--- | :--- |
| IdRecuperacionComentario | int |
| IdRecuperacion | int |
| Comentario | varchar |
| IdUsuario | int |
| Status | int |
| FechaAlta | datetime |
| FechaModificacion | datetime |
| Monto | float |
| Referencia | varchar |

### tblRegimenesFiscales

| Column Name | Data Type |
| :--- | :--- |
| IdRegimenFiscal | int |
| RegimenFiscal | varchar |

### tblRetiros

| Column Name | Data Type |
| :--- | :--- |
| IdRetiro | int |
| IdComputadora | int |
| IdTienda | int |
| IdApertura | int |
| Fecha | datetime |
| IdSupervisor | int |
| Tarjeta | float |
| Efectivo | float |
| Devoluciones | float |
| Dolares | float |
| Cheques | float |
| Concepto | varchar |
| CantidadCheques | int |
| TarjetaTeorico | float |
| ChequesTeorico | float |
| EfectivoTeorico | float |
| CantidadTarjeta | float |
| Transferencia | float |
| TarjetaDebito | float |

### tblSAPAccounts

| Column Name | Data Type |
| :--- | :--- |
| AcctCode | varchar |
| AcctName | varchar |
| FormatCode | varchar |
| IdRazonSocial | tinyint |

### tblSesionesOfertas

| Column Name | Data Type |
| :--- | :--- |
| IdSesionOferta | int |
| FechaInicio | datetime |
| FechaFin | datetime |
| FechaAct | datetime |

### tblStatusOrdenesCompra

| Column Name | Data Type |
| :--- | :--- |
| IdStatusOrdenCompra | int |
| StatusOrdenCompra | varchar |
| BackColor | varchar |
| ForeColor | varchar |

### tblStatusRecuperaciones

| Column Name | Data Type |
| :--- | :--- |
| IdStatusRecuperacion | int |
| StatusRecuperacion | varchar |
| Status | int |

### tblTablasDetalleConcentrado

| Column Name | Data Type |
| :--- | :--- |
| Tabla | varchar |
| IdComputadora | int |
| IdTienda | int |
| Dia | int |
| Mes | int |
| Anio | int |
| Cantidad | int |
| FechaAct | datetime |
| FechaFolio | datetime |
| Comparado | int |

### tblTiendas

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| Tienda | varchar |
| IdRazonSocial | int |
| Host | varchar |
| FechaSincroniza | datetime |
| Direccion | varchar |
| Municipio | varchar |
| Colonia | varchar |
| CP | varchar |
| Tel1 | varchar |
| Tel2 | varchar |
| Fax | varchar |
| Status | int |
| IdProveedor | int |
| TipoTienda | int |
| Calle | varchar |
| NumeroExterior | varchar |
| NumeroInterior | varchar |
| Estado | varchar |
| DireccionWebServices | varchar |

### tblTiendasSincronizacion

| Column Name | Data Type |
| :--- | :--- |
| IdTienda | int |
| FechaInicio | datetime |
| FechaFin | datetime |
| FechaAct | datetime |
| Tabla | varchar |

### tblTiposOrdenesCompra

| Column Name | Data Type |
| :--- | :--- |
| IdTipoOrdenCompra | int |
| TipoOrdenCompra | varchar |
| BackColor | varchar |
| ForeColor | varchar |

### tblTransferenciasEntradas

| Column Name | Data Type |
| :--- | :--- |
| IdTransferenciaEntrada | int |
| TransferenciaEntrada | varchar |
| FolioEntrada | varchar |
| IdTienda | int |
| FechaEntrada | datetime |
| Corte | int |
| Status | int |
| IdUsuarioCancelado | int |
| FechaAct | datetime |
| Impresiones | int |
| IdUsuarioEntrada | int |
| Modificado | int |

### tblTransferenciasSalidas

| Column Name | Data Type |
| :--- | :--- |
| IdTransferenciaSalida | int |
| TransferenciaSalida | varchar |
| FolioSalida | varchar |
| FolioEntrada | varchar |
| IdTransferenciaEntrada | int |
| IdTienda | int |
| IdTiendaDestino | int |
| FechaSalida | datetime |
| IdUsuarioSalida | int |
| FechaEntrada | datetime |
| Corte | int |
| Status | int |
| IdUsuarioCancelado | int |
| Total | float |
| FechaAct | datetime |
| Impresiones | int |
| ModificadoOrigen | int |
| ModificadoDestino | int |
| ClaveContingencia | varchar |
| Subtotal | float |
| IVA | float |
| TransmitidoTiendaDestino | int |
| Modifiado | int |
| UUID | varchar |

### tblUsosCFDI

| Column Name | Data Type |
| :--- | :--- |
| IdUsoCFDI | varchar |
| UsoCFDI | varchar |

### tblUsuarios

| Column Name | Data Type |
| :--- | :--- |
| IdUsuario | int |
| Usuario | varchar |
| IdPuesto | int |
| FechaNacimiento | datetime |
| FechaIngreso | datetime |
| Contrasenia | varchar |
| Contrasenia2 | varchar |
| CodigoBarras | varchar |
| IdTienda | int |
| Status | int |

### tblVales

| Column Name | Data Type |
| :--- | :--- |
| IdVale | int |
| Vale | varchar |
| Importe | float |

### tblValesCierres

| Column Name | Data Type |
| :--- | :--- |
| IdVale | int |
| IdApertura | int |
| IdComputadora | int |
| IdTienda | int |
| EsTarjeta | int |
| Importe | float |

### tblValesCierresX

| Column Name | Data Type |
| :--- | :--- |
| IdVale | int |
| IdAperturaX | int |
| IdTienda | int |
| IdComputadora | int |
| EsTarjeta | int |
| Importe | float |

### tblValesRetiros

| Column Name | Data Type |
| :--- | :--- |
| IdRetiro | int |
| IdComputadora | int |
| IdTienda | int |
| IdVale | int |
| EsTarjeta | int |
| Importe | float |
| CantidadVales | float |
| ValesTeorico | float |

### tblVentas

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| FechaVenta | datetime |
| IdApertura | int |
| Efectivo | float |
| Pago | float |
| Total | float |
| DescuentoEfectivo | float |

### tblVentasCheques

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| IdBanco | int |
| Clave | int |
| Cheques | float |
| Cuenta | varchar |

### tblVentasDevoluciones

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| Devoluciones | float |
| IdDevolucionVenta | int |

### tblVentasDolares

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| Dolares | float |
| TipoCambio | float |

### tblVentasRefacturadas

| Column Name | Data Type |
| :--- | :--- |
| IdComputadora | int |
| IdVenta | int |
| IdTienda | int |
| IdFacturaCorte | int |
| IdFacturaCliente | int |
| FechaAct | datetime |
| IdNotaCredito | int |
| TransmitidoSQL | int |

### tblVentasTarjeta

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| Tarjeta | float |

### tblVentasTransferencias

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| Transferencia | float |

### tblVentasVales

| Column Name | Data Type |
| :--- | :--- |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| IdVale | int |
| ValesTarjeta | float |
| Vales | float |

### Tickets

| Column Name | Data Type |
| :--- | :--- |
| FolioVenta | varchar |
| IdVenta | int |
| Caja | int |
| IdTienda | int |
| FechaVenta | datetime |
| Z | int |
| Cajero | varchar |
| MesTexto | varchar |
| Mes | int |
| Anio | int |
| DiaSemanaTexto | varchar |
| Tienda | varchar |
| Total | float |
| MesAnio | varchar |

### Ventas

| Column Name | Data Type |
| :--- | :--- |
| FolioVenta | varchar |
| IdVenta | int |
| IdComputadora | int |
| IdTienda | int |
| FechaVenta | datetime |
| Z | int |
| Cajero | varchar |
| CodigoBarras | varchar |
| Descripcion | varchar |
| Cantidad | float |
| PrecioVenta | float |
| Total | float |
| Descuento | float |
| MesTexto | varchar |
| Mes | int |
| Anio | int |
| DiaSemanaTexto | varchar |
| Tienda | varchar |
| MesAnio | varchar |
| Depto | varchar |
| Proveedor | varchar |

## Relationships

- tblDetalleVentas (IdVenta, IdComputadora, IdTienda) -> tblVentas (IdVenta, IdComputadora, IdTienda)

