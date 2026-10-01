// ==========================================
// FÁBRICA DE PASTAS — CAPA DE DATOS COMPARTIDA
// Clases del dominio, datos semilla y persistencia en sessionStorage (dura
// solo mientras el navegador esté abierto; lo cargado en una prueba no debe
// acumularse para siempre). Este archivo se incluye en todas las páginas del
// panel interno para que lo cargado en una pantalla (ej. un cliente nuevo)
// esté disponible de inmediato en las demás (ej. el selector de cliente en Ventas).
// ==========================================

// Normaliza texto para búsquedas insensibles a mayúsculas y acentos (ej: "gomez" encuentra "Gómez").
function normalizarTexto(valor) {
    return (valor || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------- Modelo geográfico (datos de referencia, no se persisten) ----------
class Provincia { constructor(id_provincia, nombre) { this.id_provincia = id_provincia; this.nombre = nombre; } }
class Localidad { constructor(id_localidad, nombre, id_provincia) { this.id_localidad = id_localidad; this.nombre = nombre; this.id_provincia = id_provincia; } }
class Calle { constructor(id_calle, nombre, id_localidad) { this.id_calle = id_calle; this.nombre = nombre; this.id_localidad = id_localidad; } }

const dbProvincias = [
    new Provincia(1, 'Buenos Aires'),
    new Provincia(2, 'Santa Fe'),
    new Provincia(3, 'Córdoba')
];
const dbLocalidades = [
    new Localidad(101, 'Trenque Lauquen', 1),
    new Localidad(102, 'La Plata', 1),
    new Localidad(103, 'Rosario', 2),
    new Localidad(104, 'Córdoba Capital', 3)
];
const dbCalles = [
    new Calle(1001, 'Av. Villegas', 101),
    new Calle(1002, 'Calle 9 de Julio', 101),
    new Calle(1003, 'Calle 7', 102),
    new Calle(1004, 'Av. Pellegrini', 103),
    new Calle(1005, 'Av. Colón', 104)
];

// ---------- Modelo de personas (Cliente / Proveedor / Empleado) ----------
class Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva) {
        this.nombre = nombre;
        this.apellido = apellido || '';
        this.tipo_documento = tipo_documento || 'DNI';
        this.numero_documento = numero_documento;
        this.calleObj = calleObj;
        this.altura = altura;
        this.telefono = telefono;
        this.email = email;
        this.condicion_iva = condicion_iva || 'Consumidor Final';
    }

    get nombreCompleto() {
        return `${this.nombre} ${this.apellido}`.trim();
    }

    get documentoCompleto() {
        return `${this.tipo_documento} ${this.numero_documento || '-'}`;
    }

    get direccionCompleta() {
        if (!this.calleObj) return this.altura || '-';
        const loc = dbLocalidades.find(l => l.id_localidad === this.calleObj.id_localidad);
        const prov = loc ? dbProvincias.find(p => p.id_provincia === loc.id_provincia) : null;
        const nomLoc = loc ? loc.nombre : '';
        const nomProv = prov ? prov.nombre : '';
        return `${this.calleObj.nombre} ${this.altura || ''}, ${nomLoc} (${nomProv})`.trim();
    }
}

class Cliente extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, tipo_cliente, limite_credito, razon_social) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva);
        this.tipo_cliente = tipo_cliente;
        this.limite_credito = limite_credito;
        this.razon_social = razon_social || '';
    }

    get nombreMostrado() {
        return this.razon_social ? this.razon_social : this.nombreCompleto;
    }
}

class Proveedor extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, rubro, razon_social) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva);
        this.rubro = rubro;
        this.razon_social = razon_social;
    }

    get nombreMostrado() {
        return this.razon_social || this.nombreCompleto;
    }
}

class Empleado extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, calleObj, altura, telefono, email, legajo, cargo, fecha_ingreso, sueldo) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, 'Exento');
        this.fecha_nacimiento = fecha_nacimiento;
        this.legajo = legajo;
        this.cargo = cargo;
        this.fecha_ingreso = fecha_ingreso;
        this.sueldo = sueldo;
    }
}

// ---------- Modelo de producción (Receta / Maquinaria) ----------
class Receta {
    constructor(id_receta, nombre_receta, nombre_producto, detalleReceta) {
        this.id_receta = id_receta; this.nombre_receta = nombre_receta; this.nombre_producto = nombre_producto;
        this.detalle = detalleReceta; // [{ clave_mp, cantidad_por_kg }]
    }
}

class Maquinaria {
    constructor(id_maquinaria, nombre, descripcion, fecha_adquisicion, id_unidad_tiempo, estado) {
        this.id_maquinaria = id_maquinaria; this.nombre = nombre; this.descripcion = descripcion;
        this.fecha_adquisicion = fecha_adquisicion; this.id_unidad_tiempo = id_unidad_tiempo; this.estado = estado || 'Operativa';
    }
}

const ESTADOS_PEDIDO = ['Pendiente', 'En preparación', 'Listo', 'Entregado'];
const COLOR_ESTADO_PEDIDO = {
    'Pendiente': 'bg-amber-100 text-amber-800', 'En preparación': 'bg-blue-100 text-blue-800',
    'Listo': 'bg-indigo-100 text-indigo-800', 'Entregado': 'bg-emerald-100 text-emerald-800', 'Cancelado': 'bg-slate-200 text-slate-600'
};

// ---------- Comprobantes de venta y de pago (surgen de la Orden de Pedido) ----------
const MEDIOS_PAGO = [
    { id: 1, nombre: 'Efectivo' },
    { id: 2, nombre: 'Tarjeta de Débito' },
    { id: 3, nombre: 'Transferencia Bancaria' },
    { id: 4, nombre: 'Mercado Pago' }
];
const TIPOS_COMPROBANTE_VENTA = [
    { id: 1, nombre: 'Factura A' },
    { id: 2, nombre: 'Factura B' }
];

function nombreMedioPago(id) {
    const medio = MEDIOS_PAGO.find(m => m.id === id);
    return medio ? medio.nombre : '-';
}

function nombreTipoComprobanteVenta(id) {
    const tipo = TIPOS_COMPROBANTE_VENTA.find(t => t.id === id);
    return tipo ? tipo.nombre : '-';
}

// Arma el detalle + subtotal de un Comprobante de Venta a partir del detalle de la Orden de Pedido.
function construirDetalleComprobanteVenta(pedido, idComprobante) {
    return (pedido.detalle || []).map(i => ({
        id_comprobante_venta_cliente: idComprobante,
        id_producto: i.nombre,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        total: i.subtotal
    }));
}

// El Comprobante de Venta surge automáticamente de la Orden de Pedido una vez confirmada (ver confirmarPedido en ventas.js).
function generarComprobanteVenta(pedido) {
    const subtotal = (pedido.detalle || []).reduce((acc, i) => acc + i.subtotal, 0);
    const idComprobante = numComprobanteVentaContador++;
    const comprobante = {
        id_comprobante_venta_cliente: idComprobante,
        id_tipo_comprobante_venta: (pedido.clienteObj && pedido.clienteObj.condicion_iva === 'Responsable Inscripto') ? 1 : 2,
        id_orden_pedido_cliente: pedido.id,
        id_cliente: pedido.clienteObj ? pedido.clienteObj.numero_documento : null,
        clienteObj: pedido.clienteObj,
        cliente: pedido.cliente,
        id_empleado: pedido.empleado,
        fecha_emision: pedido.fecha,
        hora_emision: pedido.hora,
        condicion_venta: pedido.tipo === 'Mayorista' ? 'Cuenta Corriente' : 'Contado',
        es_anulado: false,
        subtotal,
        porcentaje_bonificacion: pedido.esDonacion ? 100 : (pedido.bonificacion || 0),
        total: pedido.total,
        observaciones: pedido.observaciones || '',
        detalle: construirDetalleComprobanteVenta(pedido, idComprobante)
    };
    listaComprobantesVenta.unshift(comprobante);
    return comprobante;
}

// Actualiza el Comprobante de Venta ya emitido cuando se edita una orden de pedido pendiente.
function actualizarComprobanteVenta(pedido) {
    const existente = obtenerComprobanteVentaPorPedido(pedido.id);
    if (!existente) return generarComprobanteVenta(pedido);

    existente.id_tipo_comprobante_venta = (pedido.clienteObj && pedido.clienteObj.condicion_iva === 'Responsable Inscripto') ? 1 : 2;
    existente.id_cliente = pedido.clienteObj ? pedido.clienteObj.numero_documento : null;
    existente.clienteObj = pedido.clienteObj;
    existente.cliente = pedido.cliente;
    existente.id_empleado = pedido.empleado;
    existente.condicion_venta = pedido.tipo === 'Mayorista' ? 'Cuenta Corriente' : 'Contado';
    existente.subtotal = (pedido.detalle || []).reduce((acc, i) => acc + i.subtotal, 0);
    existente.porcentaje_bonificacion = pedido.esDonacion ? 100 : (pedido.bonificacion || 0);
    existente.total = pedido.total;
    existente.observaciones = pedido.observaciones || '';
    existente.detalle = construirDetalleComprobanteVenta(pedido, existente.id_comprobante_venta_cliente);
    return existente;
}

function obtenerComprobanteVentaPorPedido(idPedido) {
    return listaComprobantesVenta.find(cv => cv.id_orden_pedido_cliente === idPedido);
}

function anularComprobanteVentaDePedido(idPedido) {
    const comprobante = obtenerComprobanteVentaPorPedido(idPedido);
    if (comprobante) comprobante.es_anulado = true;
}

// Un pedido está cobrado cuando tiene al menos un Comprobante de Pago vigente asociado a su Comprobante de Venta.
function pedidoEstaCobrado(idPedido) {
    const comprobante = obtenerComprobanteVentaPorPedido(idPedido);
    if (!comprobante) return false;
    return listaComprobantesPago.some(cp => cp.id_comprobante_venta_cliente === comprobante.id_comprobante_venta_cliente && !cp.es_anulado);
}

function registrarComprobantePago({ comprobanteVenta, idMedioPago, condicionPago, importe, observaciones }) {
    const ahora = new Date();
    const comprobantePago = {
        id_comprobante_pago_cliente: numComprobantePagoContador++,
        id_comprobante_venta_cliente: comprobanteVenta.id_comprobante_venta_cliente,
        id_cliente: comprobanteVenta.id_cliente,
        clienteObj: comprobanteVenta.clienteObj,
        cliente: comprobanteVenta.cliente,
        id_medio_pago: idMedioPago,
        fecha_pago: ahora.toISOString().slice(0, 10),
        hora_pago: ahora.toTimeString().slice(0, 5),
        condicion_pago: condicionPago,
        importe,
        observaciones: observaciones || '',
        es_anulado: false
    };
    listaComprobantesPago.unshift(comprobantePago);
    return comprobantePago;
}

// ==========================================
// PERSISTENCIA (sessionStorage) — así lo cargado en una pantalla se ve
// reflejado en el resto de las páginas del panel durante la sesión del
// navegador. Al cerrar el navegador/pestaña los datos de prueba se
// descartan y la próxima sesión vuelve a arrancar con los datos semilla.
// ==========================================
const CLAVE_ALMACENAMIENTO = 'fabricaPastasDB_v1';

function crearDatosIniciales() {
    const clientes = [
        new Cliente('Hotel', 'Plaza S.A.', 'CUIT', '30712345678', dbCalles[0], '450', '(02392) 456789', 'compras@hotelplaza.com', 'Responsable Inscripto', 'Mayorista', 150000, 'Hotel Plaza S.A.'),
        new Cliente('Mariano', 'Mosa', 'CUIT', '30889911224', dbCalles[2], '890', '11-4567-1234', 'donmosa@gmail.com', 'Responsable Inscripto', 'Mayorista', 80000, 'Restaurante Don Mosa'),
        new Cliente('María', 'Gómez', 'DNI', '28554433', dbCalles[1], '245', '11-2233-4455', 'mariagomez@gmail.com', 'Consumidor Final', 'Mostrador', 0, ''),
        new Cliente('Lucas', 'Fernández', 'DNI', '35667788', dbCalles[4], '120', '0351-556677', 'lucasf@gmail.com', 'Consumidor Final', 'Mostrador', 0, '')
    ];
    const proveedores = [
        new Proveedor('Jorge', 'Funes', 'CUIT', '30501234567', dbCalles[3], '100', '(0341) 4321000', 'ventas@molinos.com', 'Responsable Inscripto', 'Harinas y Sémolas', 'Molinos Cañuelas S.A.'),
        new Proveedor('Marcela', 'Díaz', 'CUIT', '30612398742', dbCalles[1], '1200', '(02392) 489112', 'pedidos@avicolasur.com', 'Responsable Inscripto', 'Huevos Frescos', 'Distribuidora Avícola Sur')
    ];
    const empleados = [
        new Empleado('Carlos', 'Gómez', 'CUIL', '20334455669', '1988-05-14', dbCalles[0], '1234', '(02392) 15-443322', 'cgomez@pastas.com', 'EMP-001', 'Maestro Pastero', '2021-03-15', 450000),
        new Empleado('Laura', 'Rodríguez', 'CUIL', '27389900114', '1995-11-20', dbCalles[1], '567', '(02392) 15-887766', 'lrodriguez@pastas.com', 'EMP-002', 'Cajera / Mostrador', '2022-08-01', 380000)
    ];
    const maquinaria = [
        new Maquinaria(1, 'Sobadora Industrial', 'Laminadora de masa para pastas secas y rellenas', '2019-03-10', 'Horas', 'Operativa'),
        new Maquinaria(2, 'Envasadora al Vacío', 'Envasado de productos frescos para conservación', '2021-07-22', 'Turnos', 'Operativa'),
        new Maquinaria(3, 'Amasadora Doble Brazo', 'Amasado de grandes volúmenes de masa', '2017-11-05', 'Horas', 'Operativa')
    ];
    const recetas = [
        new Receta(1, 'Receta Ravioles de Ricotta', 'Ravioles de Ricotta y Verdura', [{ clave_mp: 'harina', cantidad_por_kg: 0.4 }, { clave_mp: 'ricotta', cantidad_por_kg: 0.3 }]),
        new Receta(2, 'Receta Tallarines al Huevo', 'Tallarines al Huevo', [{ clave_mp: 'harina', cantidad_por_kg: 0.6 }, { clave_mp: 'huevos', cantidad_por_kg: 0.1 }]),
        new Receta(3, 'Receta Ñoquis de Papa', 'Ñoquis de Papa', [{ clave_mp: 'harina', cantidad_por_kg: 0.3 }])
    ];
    const pedidos = [
        { id: 1044, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Pendiente', fecha: '2026-09-30', hora: '09:15',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 2, precioUnitario: 2800, subtotal: 5600 }], total: 5600 },

        { id: 1043, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Pendiente', fecha: '2026-09-29', hora: '17:40',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 3, precioUnitario: 3000, subtotal: 9000 }], total: 9000 },

        { id: 1042, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esDonacion: false, bonificacion: 10,
          empleado: 'Eugenia Fernández', observaciones: 'Entrega habitual de los lunes.', estado: 'Pendiente', fecha: '2026-09-29', hora: '10:30',
          detalle: [{ id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pastas Rellenas', cantidad: 10, precioUnitario: 4200, subtotal: 42000 }], total: 37800 },

        { id: 1041, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 15,
          empleado: 'Carlos Gómez', observaciones: 'Entregar en la cocina del hotel, preguntar por el chef Darío.', estado: 'En preparación', fecha: '2026-09-27', hora: '11:00',
          detalle: [
              { id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pastas Rellenas', cantidad: 15, precioUnitario: 4200, subtotal: 63000 },
              { id: 2, nombre: 'Salsa Bolognesa en Pote', tipo: 'Salsas', cantidad: 15, precioUnitario: 1800, subtotal: 27000 }
          ], total: 76500 },

        { id: 1040, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Evento', esDonacion: false, bonificacion: 20,
          empleado: 'Carlos Gómez', observaciones: 'Pedido para evento de fin de mes.', estado: 'Entregado', fecha: '2026-09-24', hora: '08:30',
          fechaEntrega: '2026-09-25', horaEntrega: '14:00',
          detalle: [{ id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pastas Rellenas', cantidad: 20, precioUnitario: 3500, subtotal: 70000 }], total: 56000 },

        { id: 1039, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: true, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: 'Donación para comedor comunitario.', estado: 'Entregado', fecha: '2026-09-30', hora: '12:00',
          fechaEntrega: '2026-09-30', horaEntrega: '13:15',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 5, precioUnitario: 3000, subtotal: 15000 }], total: 0 },

        { id: 1038, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 0,
          empleado: 'Carlos Gómez', observaciones: '', estado: 'Cancelado', fecha: '2026-09-23', hora: '09:00',
          detalle: [{ id: 1, nombre: 'Salsa Fileto en Pote', tipo: 'Salsas', cantidad: 10, precioUnitario: 1200, subtotal: 12000 }], total: 12000 },

        { id: 1037, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esDonacion: false, bonificacion: 10,
          empleado: 'Carlos Gómez', observaciones: '', estado: 'En preparación', fecha: '2026-09-21', hora: '10:00',
          detalle: [{ id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pastas Rellenas', cantidad: 12, precioUnitario: 3500, subtotal: 42000 }], total: 37800 },

        { id: 1036, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Listo', fecha: '2026-09-20', hora: '13:20',
          detalle: [{ id: 1, nombre: 'Salsa Fileto en Pote', tipo: 'Salsas', cantidad: 4, precioUnitario: 1200, subtotal: 4800 }], total: 4800 },

        { id: 1035, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 5,
          empleado: 'Carlos Gómez', observaciones: 'Retira el proveedor habitual del hotel.', estado: 'Listo', fecha: '2026-09-19', hora: '09:40',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 20, precioUnitario: 3000, subtotal: 60000 }], total: 57000 },

        { id: 1034, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Entregado', fecha: '2026-09-18', hora: '16:00',
          fechaEntrega: '2026-09-18', horaEntrega: '18:30',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 1, precioUnitario: 2800, subtotal: 2800 }], total: 2800 }
    ];

    // Comprobantes de venta: surgen automáticamente de cada orden de pedido ya confirmada (de la más antigua a la más nueva).
    let contadorComprobanteVenta = 1;
    const comprobantesVenta = pedidos.slice().reverse().map(pedido => {
        const idComprobante = contadorComprobanteVenta++;
        return {
            id_comprobante_venta_cliente: idComprobante,
            id_tipo_comprobante_venta: (pedido.clienteObj && pedido.clienteObj.condicion_iva === 'Responsable Inscripto') ? 1 : 2,
            id_orden_pedido_cliente: pedido.id,
            id_cliente: pedido.clienteObj ? pedido.clienteObj.numero_documento : null,
            clienteObj: pedido.clienteObj,
            cliente: pedido.cliente,
            id_empleado: pedido.empleado,
            fecha_emision: pedido.fecha,
            hora_emision: pedido.hora,
            condicion_venta: pedido.tipo === 'Mayorista' ? 'Cuenta Corriente' : 'Contado',
            es_anulado: pedido.estado === 'Cancelado',
            subtotal: (pedido.detalle || []).reduce((acc, i) => acc + i.subtotal, 0),
            porcentaje_bonificacion: pedido.esDonacion ? 100 : (pedido.bonificacion || 0),
            total: pedido.total,
            observaciones: pedido.observaciones || '',
            detalle: (pedido.detalle || []).map(i => ({
                id_comprobante_venta_cliente: idComprobante, id_producto: i.nombre, nombre: i.nombre,
                cantidad: i.cantidad, precio_unitario: i.precioUnitario, total: i.subtotal
            }))
        };
    }).reverse();

    // Pagos ya recibidos para los pedidos que llegaron a "Entregado" (simulan cobros históricos previos a esta sesión).
    let contadorComprobantePago = 1;
    const comprobantesPago = [];
    const pagosHistoricos = [
        { idPedido: 1034, idMedioPago: 1, fecha: '2026-09-18', hora: '18:35' },
        { idPedido: 1040, idMedioPago: 3, fecha: '2026-09-25', hora: '14:10' }
    ];
    pagosHistoricos.forEach(pago => {
        const cv = comprobantesVenta.find(c => c.id_orden_pedido_cliente === pago.idPedido);
        if (!cv || !cv.total) return;
        comprobantesPago.push({
            id_comprobante_pago_cliente: contadorComprobantePago++,
            id_comprobante_venta_cliente: cv.id_comprobante_venta_cliente,
            id_cliente: cv.id_cliente,
            clienteObj: cv.clienteObj,
            cliente: cv.cliente,
            id_medio_pago: pago.idMedioPago,
            fecha_pago: pago.fecha,
            hora_pago: pago.hora,
            condicion_pago: 'Contado',
            importe: cv.total,
            observaciones: '',
            es_anulado: false
        });
    });

    return {
        clientes, proveedores, empleados, maquinaria, recetas, pedidos, comprobantesVenta, comprobantesPago,
        ordenesProduccion: [], ordenesMantenimiento: [], ordenesCompra: [],
        stockMateriaPrima: {
            harina: { nombre: 'Harina 0000', cantidad_actual: 100, unidad_medida: 'kg' },
            huevos: { nombre: 'Huevos Frescos', cantidad_actual: 80, unidad_medida: 'dzn' },
            ricotta: { nombre: 'Ricotta Fresca', cantidad_actual: 50, unidad_medida: 'kg' }
        },
        cajaDiaria: 0,
        contadores: {
            recibo: 1, ordenCompra: 101, lote: 1, pedido: 1045, empleado: 3, maquinaria: 4, ordenMant: 1, ordenProduccion: 1,
            comprobanteVenta: contadorComprobanteVenta, comprobantePago: contadorComprobantePago
        }
    };
}

function revivirPersona(obj, Clase) {
    return Object.setPrototypeOf(obj, Clase.prototype);
}

function cargarDatos() {
    const crudo = sessionStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!crudo) return crearDatosIniciales();
    try {
        const datos = JSON.parse(crudo);
        datos.clientes = datos.clientes.map(c => revivirPersona(c, Cliente));
        datos.proveedores = datos.proveedores.map(p => revivirPersona(p, Proveedor));
        datos.empleados = datos.empleados.map(e => revivirPersona(e, Empleado));
        // Los pedidos y comprobantes guardan el documento del cliente para volver a enlazar la MISMA instancia tras recargar.
        datos.pedidos = (datos.pedidos || []).map(p => {
            const { clienteDocumento, ...resto } = p;
            resto.clienteObj = datos.clientes.find(c => c.numero_documento === clienteDocumento) || null;
            return resto;
        });
        datos.comprobantesVenta = (datos.comprobantesVenta || []).map(cv => {
            const { clienteDocumento, ...resto } = cv;
            resto.clienteObj = datos.clientes.find(c => c.numero_documento === clienteDocumento) || null;
            return resto;
        });
        datos.comprobantesPago = (datos.comprobantesPago || []).map(cp => {
            const { clienteDocumento, ...resto } = cp;
            resto.clienteObj = datos.clientes.find(c => c.numero_documento === clienteDocumento) || null;
            return resto;
        });
        datos.maquinaria = datos.maquinaria || [];
        datos.recetas = (datos.recetas || []).map(r => Object.setPrototypeOf(r, Receta.prototype));
        datos.ordenesProduccion = datos.ordenesProduccion || [];
        datos.ordenesMantenimiento = datos.ordenesMantenimiento || [];
        datos.ordenesCompra = datos.ordenesCompra || [];
        datos.cajaDiaria = datos.cajaDiaria || 0;
        datos.contadores = datos.contadores || crearDatosIniciales().contadores;
        return datos;
    } catch (e) {
        console.error('No se pudo leer la base de la sesión, se reinicia con datos de ejemplo.', e);
        return crearDatosIniciales();
    }
}

const DATOS = cargarDatos();

// Variables globales que usan todas las páginas (mismos nombres que antes, para no reescribir la lógica de cada módulo).
let listaClientes = DATOS.clientes;
let listaProveedores = DATOS.proveedores;
let listaEmpleados = DATOS.empleados;
let listaMaquinaria = DATOS.maquinaria;
let listaRecetas = DATOS.recetas;
let listaPedidos = DATOS.pedidos;
let listaComprobantesVenta = DATOS.comprobantesVenta;
let listaComprobantesPago = DATOS.comprobantesPago;
let listaOrdenesProduccion = DATOS.ordenesProduccion;
let listaOrdenesMantenimiento = DATOS.ordenesMantenimiento;
let listaOrdenesCompra = DATOS.ordenesCompra;
let stockMateriaPrima = DATOS.stockMateriaPrima;
let totalCajaAcumulado = DATOS.cajaDiaria;

let numReciboContador = DATOS.contadores.recibo;
let numOrdenCompraContador = DATOS.contadores.ordenCompra;
let numLoteContador = DATOS.contadores.lote;
let numPedidoContador = DATOS.contadores.pedido;
let numEmpleadoContador = DATOS.contadores.empleado;
let numMaquinariaContador = DATOS.contadores.maquinaria;
let numOrdenMantContador = DATOS.contadores.ordenMant;
let numOrdenProduccionContador = DATOS.contadores.ordenProduccion;
let numComprobanteVentaContador = DATOS.contadores.comprobanteVenta;
let numComprobantePagoContador = DATOS.contadores.comprobantePago;

function guardarDatos() {
    const serializado = {
        clientes: listaClientes,
        proveedores: listaProveedores,
        empleados: listaEmpleados,
        maquinaria: listaMaquinaria,
        recetas: listaRecetas,
        ordenesProduccion: listaOrdenesProduccion,
        ordenesMantenimiento: listaOrdenesMantenimiento,
        ordenesCompra: listaOrdenesCompra,
        stockMateriaPrima: stockMateriaPrima,
        cajaDiaria: totalCajaAcumulado,
        contadores: {
            recibo: numReciboContador, ordenCompra: numOrdenCompraContador, lote: numLoteContador,
            pedido: numPedidoContador, empleado: numEmpleadoContador, maquinaria: numMaquinariaContador,
            ordenMant: numOrdenMantContador, ordenProduccion: numOrdenProduccionContador,
            comprobanteVenta: numComprobanteVentaContador, comprobantePago: numComprobantePagoContador
        },
        pedidos: listaPedidos.map(p => {
            const { clienteObj, ...resto } = p;
            return { ...resto, clienteDocumento: clienteObj ? clienteObj.numero_documento : null };
        }),
        comprobantesVenta: listaComprobantesVenta.map(cv => {
            const { clienteObj, ...resto } = cv;
            return { ...resto, clienteDocumento: clienteObj ? clienteObj.numero_documento : null };
        }),
        comprobantesPago: listaComprobantesPago.map(cp => {
            const { clienteObj, ...resto } = cp;
            return { ...resto, clienteDocumento: clienteObj ? clienteObj.numero_documento : null };
        })
    };
    sessionStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(serializado));
}

// ==========================================
// UTILIDADES GEOGRÁFICAS COMPARTIDAS (Clientes / Proveedores / Empleados)
// ==========================================
function inicializarCombosUbicacion() {
    const prefijos = ['cli', 'prov', 'emp'];
    prefijos.forEach(prefijo => {
        const selectProv = document.getElementById(`${prefijo}-provincia`);
        if (selectProv) {
            selectProv.innerHTML = '<option value="">-- Seleccione Provincia --</option>';
            dbProvincias.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id_provincia;
                opt.innerText = p.nombre;
                selectProv.appendChild(opt);
            });
        }
    });
}

function cargarLocalidadesCascada(prefijo) {
    const idProv = parseInt(document.getElementById(`${prefijo}-provincia`).value);
    const selectLoc = document.getElementById(`${prefijo}-localidad`);
    const selectCalle = document.getElementById(`${prefijo}-calle`);

    selectLoc.innerHTML = '<option value="">-- Seleccione Localidad --</option>';
    selectCalle.innerHTML = '<option value="">-- Seleccione Calle --</option>';
    selectCalle.disabled = true;

    if (!idProv) {
        selectLoc.disabled = true;
        return;
    }

    const locsFiltradas = dbLocalidades.filter(l => l.id_provincia === idProv);
    locsFiltradas.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id_localidad;
        opt.innerText = l.nombre;
        selectLoc.appendChild(opt);
    });
    selectLoc.disabled = false;
}

function cargarCallesCascada(prefijo) {
    const idLoc = parseInt(document.getElementById(`${prefijo}-localidad`).value);
    const selectCalle = document.getElementById(`${prefijo}-calle`);

    selectCalle.innerHTML = '<option value="">-- Seleccione Calle --</option>';

    if (!idLoc) {
        selectCalle.disabled = true;
        return;
    }

    const callesFiltradas = dbCalles.filter(c => c.id_localidad === idLoc);
    callesFiltradas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id_calle;
        opt.innerText = c.nombre;
        selectCalle.appendChild(opt);
    });
    selectCalle.disabled = false;
}

function obtenerCalleSeleccionada(prefijo) {
    const idCalle = parseInt(document.getElementById(`${prefijo}-calle`).value);
    return dbCalles.find(c => c.id_calle === idCalle) || null;
}

// ==========================================
// RENDERS COMPARTIDOS (alimentan tablas propias y selects de otras páginas)
// ==========================================
function renderizarClientesUI() {
    document.querySelectorAll('.select-cliente-dinamico').forEach(select => {
        select.innerHTML = '<option value="">-- Seleccionar de la lista --</option>';
        listaClientes.forEach(cli => {
            const opt = document.createElement('option');
            opt.value = `${cli.nombreMostrado}|${cli.tipo_cliente}|${cli.nombreMostrado.toLowerCase().includes('hotel') ? 'hotel' : 'normal'}`;
            opt.innerText = `${cli.nombreMostrado} (${cli.tipo_cliente})`;
            select.appendChild(opt);
        });
        const optOtro = document.createElement('option');
        optOtro.value = 'OTRO';
        optOtro.innerText = '— Registrar o ingresar manualmente —';
        select.appendChild(optOtro);
    });
}

function renderizarProveedoresUI() {
    document.querySelectorAll('.select-proveedor-dinamico').forEach(select => {
        select.innerHTML = '';
        listaProveedores.forEach(prov => {
            const opt = document.createElement('option');
            opt.value = prov.nombreMostrado;
            opt.innerText = prov.nombreMostrado;
            select.appendChild(opt);
        });
    });
}

function renderizarEmpleadosUI() {
    ['mant-empleado'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Seleccioná un empleado</option>';
        listaEmpleados.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.nombreCompleto; opt.innerText = `${emp.nombreCompleto} (${emp.cargo})`;
            select.appendChild(opt);
        });
    });
}
