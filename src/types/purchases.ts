export interface PurchaseOrder {
    IdOrdenCompra: number;
    IdProveedor: number;
    FechaOrdenCompra: string;
    TipoOrdenCompra: string;
    Tienda: string;
    Proveedor: string;
    Status: string;
    FolioReciboMovil: string | null;
    FechaRecibo: string | null;
    TotalPedido: number;
    TotalRecibo: number;
    PorcentajeEfectividad: number;
    TotalDev: number;
    TotalPagar: number;
    NumeroFactura: string | null;
    TotalFactura: number;
    Ordenados: number;
    Recibidos: number;
    Devoluciones: number;
    UsuarioOrden: string;
    UsuarioRecibo: string;
    IdTienda: number;
    IdReciboMovil: number | null;
    UUID?: string | null;
    RFCProveedor?: string | null;
    DiasCredito?: number | null;
    SubtotalPedido?: number;
    Coment?: string | null;
}


export interface InvoiceDetail {
    UUID: string;
    Serie: string;
    Folio: string;
    Fecha: string;
    CondicionesPago: string;
    Subtotal: number;
    Descuento: number;
    Total: number;
    Moneda: string;
    MetodoPago: string;
    LugarExpedicion: string;
    UsoCFDI: string;
    RFCEmisor: string;
    Emisor: string;
    RFCReceptor: string;
    Receptor: string;
    TipoComprobante: string;
}

export interface InvoiceConcept {
    Cantidad: number;
    Unidad: string;
    ClaveProdServ: string;
    NoIdentificacion: string;
    Descripcion: string;
    ValorUnitario: number;
    Importe: number;
    Descuento: number;
}

export interface DistributionItem {
    IdOrdenCompra: number;
    FechaOrdenCompra: string;
    IdTiendaDestino: number;
    TiendaDestino: string;
    CantidadArticulos: number;
    IdTransferenciaSalida: number | null;
    FolioSalida: string | null;
    FechaSalida: string | null;
    UsuarioSalida: string | null;
    IdTransferenciaEntrada: number | null;
    FolioEntrada: string | null;
    FechaEntrada: string | null;
    UsuarioEntrada: string | null;
    UUID?: string | null;
}

export interface DistributionDetailItem {
    Cantidad?: number;
    MedidaCompra?: string;
    CantidadSalida?: number;
    Medida?: string;
    Piezas?: number;
    PiezasPedido?: number;
    PiezasRecibo?: number;
    MedidaPiezas: string;
    CodigoBarras: string;
    Descripcion: string;
    Costo?: number;
    Total?: number;
}

export interface OrderDetail {
    PiezasPedido: number;
    Pedido: number;
    PedidoTransito: number;
    SinCargo: string;
    Medida: string;
    CodigoBarras: string;
    Descripcion: string;
    Costo: number;
    IVA100: number;
    IEPS100: number;
    D1: number;
    D2: number;
    D3: number;
    D4: number;
    D5: number;
    Total: number;
    UsuarioOrden: string;
    FechaOrdenCompra: string;
}
