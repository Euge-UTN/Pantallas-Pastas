// ==========================================
// FÁBRICA DE PASTAS - CAPA DE DATOS COMPARTIDA
// Clases del dominio, datos semilla y persistencia en sessionStorage (dura
// solo mientras el navegador esté abierto; lo cargado en una prueba no debe
// acumularse para siempre). Este archivo se incluye en todas las páginas del
// panel interno para que lo cargado en una pantalla (ej. un cliente nuevo)
// esté disponible de inmediato en las demás (ej. el selector de cliente en Ventas).
// ==========================================

function formatearIdentificador(prefijo, valor) {
    const numero = String(valor ?? '').replace(/\D/g, '');
    return `${prefijo}-${numero.padStart(4, '0')}`;
}

// Normaliza texto para búsquedas insensibles a mayúsculas y acentos (ej: "gomez" encuentra "Gómez").
function normalizarTexto(valor) {
    return (valor || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Estado visual de un Presupuesto de Cliente: "Vencido" es una etiqueta calculada (no se guarda en el objeto),
// solo cambia cómo se ve - un presupuesto Pendiente vencido se sigue pudiendo editar, generar pedido o anular igual.
function estadoPresupuesto(pr) {
    if (pr.estado === 'Pendiente' && pr.fecha_vencimiento && pr.fecha_vencimiento < new Date().toISOString().slice(0, 10)) return 'Vencido';
    return pr.estado;
}

// Filtro de fecha exacta: compara el valor de un <input type="date"> (vacío = sin filtro) contra un campo 'YYYY-MM-DD'.
function coincideFechaExacta(valorInputDate, fechaCampo) {
    return !valorInputDate || valorInputDate === fechaCampo;
}

// Filtro de rango de montos: los inputs Desde/Hasta son opcionales e independientes entre sí.
function coincideRangoMonto(desde, hasta, monto) {
    const d = parseFloat(desde);
    const h = parseFloat(hasta);
    if (!isNaN(d) && monto < d) return false;
    if (!isNaN(h) && monto > h) return false;
    return true;
}

// Filtro de rango de fechas: los inputs Desde/Hasta (type="date", formato YYYY-MM-DD) son opcionales e
// independientes entre sí; la comparación de strings ISO funciona igual que una comparación numérica.
function coincideRangoFecha(desde, hasta, fechaCampo) {
    if (!fechaCampo) return !desde && !hasta;
    if (desde && fechaCampo < desde) return false;
    if (hasta && fechaCampo > hasta) return false;
    return true;
}

// ---------- Paginación de listados (5 registros por página) ----------
// Cada listado sigue renderizando todas sus filas; un MutationObserver sobre el <tbody> oculta las que no
// pertenecen a la página actual y dibuja los números de página debajo de la tabla. Si cambia la cantidad de
// filas (filtro, alta, baja) vuelve a la página 1; si no (ordenar, cambiar un estado) se queda en la actual.
const REGISTROS_POR_PAGINA = 5;
const TABLAS_PAGINADAS = [
    'tabla-presupuestos', 'tabla-pedidos-registrados', 'tabla-comprobantes-venta', 'tabla-lista-clientes',
    'tabla-pagos', 'tabla-presupuestos-proveedor', 'tabla-ordenes-compra', 'tabla-remitos', 'tabla-lista-proveedores',
    'tabla-ordenes-produccion', 'tabla-productos', 'tabla-materias-primas', 'tabla-maquinaria',
    'tabla-ordenes-mantenimiento', 'tabla-lista-empleados'
];
const estadoPaginacion = {};

function paginarTabla(tbody) {
    const filas = [...tbody.rows];
    const estado = estadoPaginacion[tbody.id] || (estadoPaginacion[tbody.id] = { pagina: 1, total: -1 });
    if (filas.length !== estado.total) { estado.pagina = 1; estado.total = filas.length; }
    const totalPaginas = Math.max(1, Math.ceil(filas.length / REGISTROS_POR_PAGINA));
    estado.pagina = Math.min(estado.pagina, totalPaginas);

    filas.forEach((tr, i) => tr.classList.toggle('hidden', Math.floor(i / REGISTROS_POR_PAGINA) + 1 !== estado.pagina));

    let nav = document.getElementById(`paginacion-${tbody.id}`);
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = `paginacion-${tbody.id}`;
        nav.className = 'no-print flex justify-center items-center gap-1.5 px-4 py-3 border-t border-slate-100';
        (tbody.closest('.overflow-x-auto') || tbody.closest('table')).insertAdjacentElement('afterend', nav);
    }
    nav.classList.toggle('hidden', totalPaginas <= 1);
    nav.innerHTML = totalPaginas <= 1 ? '' : Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => `
        <button type="button" onclick="irAPaginaTabla('${tbody.id}', ${n})" aria-label="Página ${n}"${n === estado.pagina ? ' aria-current="page"' : ''}
            class="min-w-[2rem] h-8 px-2 rounded-lg text-xs font-semibold transition ${n === estado.pagina ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100 border border-slate-200'}">${n}</button>`).join('');
}

function irAPaginaTabla(idTabla, pagina) {
    estadoPaginacion[idTabla].pagina = pagina;
    paginarTabla(document.getElementById(idTabla));
}

document.addEventListener('DOMContentLoaded', () => {
    TABLAS_PAGINADAS.forEach(id => {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        new MutationObserver(() => paginarTabla(tbody)).observe(tbody, { childList: true });
        paginarTabla(tbody);
    });
});

// ---------- Teléfonos múltiples (botón "+" en Clientes, Proveedores y Empleados) ----------
// Agrega una fila de teléfono adicional al formulario identificado por "prefijo" (ej: 'cli', 'prov', 'emp').
function agregarCampoTelefono(prefijo) {
    const cont = document.getElementById(`${prefijo}-telefonos-wrap`);
    if (!cont) return;
    const fila = document.createElement('div');
    fila.className = 'flex gap-2 mt-2';
    fila.innerHTML = `
        <input type="text" class="telefono-adicional-${prefijo} w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none" placeholder="Otro teléfono">
        <button type="button" onclick="this.closest('div').remove()" title="Quitar teléfono" class="shrink-0 w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition"><i data-lucide="x" class="w-4 h-4"></i></button>`;
    cont.appendChild(fila);
    lucide.createIcons();
}

function obtenerTelefonosAdicionales(prefijo) {
    return [...document.querySelectorAll(`.telefono-adicional-${prefijo}`)].map(i => i.value.trim()).filter(Boolean);
}

function limpiarCamposTelefono(prefijo) {
    const cont = document.getElementById(`${prefijo}-telefonos-wrap`);
    if (!cont) return;
    [...cont.querySelectorAll(`.telefono-adicional-${prefijo}`)].forEach(i => i.closest('div').remove());
}

// Reconstruye las filas de teléfonos adicionales al abrir un formulario en modo edición.
function precargarTelefonosAdicionales(prefijo, telefonos) {
    limpiarCamposTelefono(prefijo);
    (telefonos || []).forEach(tel => {
        agregarCampoTelefono(prefijo);
        const inputs = document.querySelectorAll(`.telefono-adicional-${prefijo}`);
        inputs[inputs.length - 1].value = tel;
    });
}

// Muestra/oculta y marca como obligatorio el Límite de Crédito según si el cliente tiene cuenta corriente habilitada.
// Prefijo genérico para poder reusarla en cualquier formulario de alta de cliente (Clientes, el modal rápido de Ventas, etc.).
function actualizarVisibilidadLimiteCliente(prefijo = 'cli') {
    const tieneCtaCte = document.getElementById(`${prefijo}-cuenta-corriente`).checked;
    document.getElementById(`wrap-${prefijo}-limite`).classList.toggle('hidden', !tieneCtaCte);
    if (!tieneCtaCte) document.getElementById(`${prefijo}-limite`).value = 0;
    else if (!parseFloat(document.getElementById(`${prefijo}-limite`).value)) document.getElementById(`${prefijo}-limite`).value = 50000;
}

// Si el cliente es Mayorista, la Razón Social deja de ser opcional (se usa como nombreMostrado en toda facturación
// mayorista) y, a la inversa, Nombre/Apellido pasan a ser opcionales (muchos mayoristas se dan de alta solo con
// la razón social de la empresa, sin una persona de contacto puntual).
function actualizarVisibilidadRazonSocialCliente(prefijo = 'cli') {
    const select = document.getElementById(`${prefijo}-tipo-cliente`) || document.getElementById(`${prefijo}-tipo`);
    const esMayorista = select.value === 'Mayorista';

    const inputRazonSocial = document.getElementById(`${prefijo}-razon-social`);
    const marcadorRazonSocial = document.getElementById(`${prefijo}-razon-social-requerido`);
    inputRazonSocial.required = esMayorista;
    if (marcadorRazonSocial) marcadorRazonSocial.classList.toggle('hidden', !esMayorista);

    ['nombre', 'apellido'].forEach(campo => {
        const input = document.getElementById(`${prefijo}-${campo}`);
        const marcador = document.getElementById(`${prefijo}-${campo}-requerido`);
        if (!input) return;
        input.required = !esMayorista;
        if (marcador) marcador.classList.toggle('hidden', esMayorista);
    });
}

// Redondea una cantidad a un máximo de 2 decimales (sin ceros de relleno), usado en las grillas de materia
// prima y maquinaria de Producción para evitar números largos tras sumas/restas de stock.
function formatearCantidad(n) {
    return (Math.round((Number(n) || 0) * 100) / 100).toString();
}

// Badge con el teléfono principal + "+N" si hay adicionales, usado en las tablas de Clientes/Proveedores/Empleados.
function badgeTelefonos(persona) {
    const completos = persona.telefonosCompletos;
    if (!completos.length) return '-';
    if (completos.length === 1) return completos[0];
    return `${completos[0]} <span class="text-slate-400" title="${completos.slice(1).join(', ')}">+${completos.length - 1}</span>`;
}

// ---------- Popovers de búsqueda/filtro por columna y combos con búsqueda (Ventas, Cobranzas, Compras) ----------
// Se posicionan con position:fixed calculada por JS (no absolute) para que floten por encima de todo
// sin que el contenedor con scroll horizontal de la tabla les agregue una barra de scroll vertical.
function togglePopoverColumna(id) {
    document.querySelectorAll('.popover-columna').forEach(p => { if (p.id !== id) p.classList.add('hidden'); });
    const panel = document.getElementById(id);
    const abrir = panel.classList.contains('hidden');

    if (abrir) {
        const wrapper = panel.closest('.popover-trigger');
        const rect = wrapper.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.left = `${rect.left}px`;
        if (id.startsWith('combo-')) panel.style.width = `${rect.width}px`;
    }
    panel.classList.toggle('hidden');

    // Los combos con búsqueda (Cliente/Empleado/Producto) siempre reabren con el buscador vacío y la lista completa actualizada.
    if (abrir && id.startsWith('combo-')) {
        const input = panel.querySelector('input');
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            input.focus();
        }
    }
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.popover-trigger')) {
        document.querySelectorAll('.popover-columna').forEach(p => p.classList.add('hidden'));
    }
});

// ---------- Modelo geográfico (datos de referencia, no se persisten) ----------
class Provincia { constructor(id_provincia, nombre) { this.id_provincia = id_provincia; this.nombre = nombre; } }
class Localidad { constructor(id_localidad, nombre, id_provincia) { this.id_localidad = id_localidad; this.nombre = nombre; this.id_provincia = id_provincia; } }
class Calle { constructor(id_calle, nombre, id_localidad, codigo_postal) { this.id_calle = id_calle; this.nombre = nombre; this.id_localidad = id_localidad; this.codigo_postal = codigo_postal || ''; } }

// Arma un domicilio legible (calle, altura, localidad, provincia y CP) a partir de una calleObj + altura sueltas.
// Compartida entre Persona.direccionCompleta y cualquier domicilio "suelto" que no pertenezca a una Persona
// (ej. el domicilio de entrega propio de un Pedido, cuando difiere del domicilio registrado del cliente).
function direccionDesdeCalle(calleObj, altura) {
    if (!calleObj) return altura || '-';
    const loc = dbLocalidades.find(l => l.id_localidad === calleObj.id_localidad);
    const prov = loc ? dbProvincias.find(p => p.id_provincia === loc.id_provincia) : null;
    const nomLoc = loc ? loc.nombre : '';
    const nomProv = prov ? prov.nombre : '';
    const cp = calleObj.codigo_postal ? ` - CP ${calleObj.codigo_postal}` : '';
    return `${calleObj.nombre} ${altura || ''}, ${nomLoc} (${nomProv})${cp}`.trim();
}

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
    new Calle(1001, 'Av. Villegas', 101, '6400'),
    new Calle(1002, 'Calle 9 de Julio', 101, '6400'),
    new Calle(1003, 'Calle 7', 102, '1900'),
    new Calle(1004, 'Av. Pellegrini', 103, '2000'),
    new Calle(1005, 'Av. Colón', 104, '5000')
];

// ---------- Modelo de personas (Cliente / Proveedor / Empleado) ----------
class Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, telefonos_adicionales) {
        this.nombre = nombre;
        this.apellido = apellido || '';
        this.tipo_documento = tipo_documento || 'DNI';
        this.numero_documento = numero_documento;
        this.calleObj = calleObj;
        this.altura = altura;
        this.telefono = telefono;
        this.telefonos_adicionales = telefonos_adicionales || [];
        this.email = email;
        this.condicion_iva = condicion_iva || 'Consumidor Final';
    }

    get nombreCompleto() {
        return `${this.nombre} ${this.apellido}`.trim();
    }

    get telefonosCompletos() {
        return [this.telefono, ...this.telefonos_adicionales].filter(Boolean);
    }

    get documentoCompleto() {
        return `${this.tipo_documento} ${this.numero_documento || '-'}`;
    }

    get direccionCompleta() {
        return direccionDesdeCalle(this.calleObj, this.altura);
    }
}

class Cliente extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, tipo_cliente, limite_credito, razon_social, fecha_alta, tiene_cuenta_corriente, telefonos_adicionales, usuario, contrasena) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, telefonos_adicionales);
        this.tipo_cliente = tipo_cliente;
        this.limite_credito = limite_credito;
        this.razon_social = razon_social || '';
        this.fecha_alta = fecha_alta || new Date().toISOString().slice(0, 10);
        this.tiene_cuenta_corriente = !!tiene_cuenta_corriente;
        this.usuario = usuario || '';
        this.contrasena = contrasena || '';
    }

    get nombreMostrado() {
        return this.razon_social ? this.razon_social : this.nombreCompleto;
    }
}

class Proveedor extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, rubro, razon_social, fecha_alta, tiempo_entrega_estimado, estado_activo, telefonos_adicionales) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, condicion_iva, telefonos_adicionales);
        this.rubro = rubro;
        this.razon_social = razon_social;
        this.fecha_alta = fecha_alta || new Date().toISOString().slice(0, 10);
        this.tiempo_entrega_estimado = tiempo_entrega_estimado || '';
        this.estado_activo = estado_activo === undefined ? true : !!estado_activo;
    }

    get nombreMostrado() {
        return this.razon_social || this.nombreCompleto;
    }
}

class Empleado extends Persona {
    constructor(nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, calleObj, altura, telefono, email, legajo, cargo, fecha_ingreso, sueldo, fecha_alta, turno, telefonos_adicionales, estado_activo) {
        super(nombre, apellido, tipo_documento, numero_documento, calleObj, altura, telefono, email, 'Exento', telefonos_adicionales);
        this.fecha_nacimiento = fecha_nacimiento;
        this.legajo = legajo;
        this.cargo = cargo;
        this.fecha_ingreso = fecha_ingreso;
        this.sueldo = sueldo;
        this.fecha_alta = fecha_alta || fecha_ingreso;
        this.turno = turno || 'Mañana';
        this.estado_activo = estado_activo === undefined ? true : !!estado_activo;
    }
}

// ---------- Modelo de producción (Receta / Maquinaria) ----------
class Receta {
    constructor(id_receta, nombre_receta, nombre_producto, detalleReceta) {
        this.id_receta = id_receta; this.nombre_receta = nombre_receta; this.nombre_producto = nombre_producto;
        this.detalle = detalleReceta; // [{ clave_mp, cantidad_por_kg }]
    }
}

// Marca: entidad compartida entre Maquinaria y Materia Prima (Marca_Maquinaria / Materia_Prima -> Marca del diagrama).
class Marca { constructor(id_marca, nombre) { this.id_marca = id_marca; this.nombre = nombre; } }
const dbMarcas = [
    { id_marca: 1, nombre: 'Imperia' }, { id_marca: 2, nombre: 'Audionvac' }, { id_marca: 3, nombre: 'Famiglia' }, { id_marca: 4, nombre: 'Reggiani' },
    { id_marca: 5, nombre: 'Molinos Cañuelas' }, { id_marca: 6, nombre: 'Avícola Sur' }, { id_marca: 7, nombre: 'Genérica' }
];
function nombreMarca(id_marca) {
    const m = dbMarcas.find(x => x.id_marca === id_marca);
    return m ? m.nombre : '-';
}

class Maquinaria {
    constructor(id_maquinaria, nombre, descripcion, fecha_adquisicion, id_unidad_tiempo, estado, id_marca, modelo) {
        this.id_maquinaria = id_maquinaria; this.nombre = nombre; this.descripcion = descripcion;
        this.fecha_adquisicion = fecha_adquisicion; this.id_unidad_tiempo = id_unidad_tiempo; this.estado = estado || 'Operativa';
        this.id_marca = id_marca || null; this.modelo = modelo || '';
    }
}

// ---------- Producción: catálogos de Producto y Materia Prima (propios del módulo, independientes de los
// catálogos simplificados que ya usan Ventas para vender y Compras/Producción para la lógica de stock) ----------
const dbUnidadesMedida = [
    { id_unidad_medida: 1, nombre: 'Kilogramo (Kg)' }, { id_unidad_medida: 2, nombre: 'Unidad (Un)' },
    { id_unidad_medida: 3, nombre: 'Docena (Dz)' }, { id_unidad_medida: 4, nombre: 'Litro (Lt)' }
];
function nombreUnidadMedida(id_unidad_medida) {
    const u = dbUnidadesMedida.find(x => x.id_unidad_medida === id_unidad_medida);
    return u ? u.nombre : '-';
}

// Subtipo de Producto: mismo vocabulario Tipo/Subtipo que ya usan Pedidos, Presupuestos y Comprobantes de Venta.
const dbSubtiposProducto = [
    { id_subtipo_producto: 1, tipo: 'Pasta', subtipo: 'Fresca' }, { id_subtipo_producto: 2, tipo: 'Pasta', subtipo: 'Seca' },
    { id_subtipo_producto: 3, tipo: 'Pasta', subtipo: 'Rellena' }, { id_subtipo_producto: 4, tipo: 'Salsa', subtipo: 'Clásica' }
];
function subtipoProducto(id_subtipo_producto) {
    return dbSubtiposProducto.find(x => x.id_subtipo_producto === id_subtipo_producto) || null;
}

class Producto {
    constructor(id_producto, id_subtipo_producto, id_unidad_medida, nombre, descripcion, precio_unitario, stock_actual, stock_minimo, estado_activo) {
        this.id_producto = id_producto; this.id_subtipo_producto = id_subtipo_producto; this.id_unidad_medida = id_unidad_medida;
        this.nombre = nombre; this.descripcion = descripcion || ''; this.precio_unitario = precio_unitario;
        this.stock_actual = stock_actual || 0; this.stock_minimo = stock_minimo || 0;
        this.estado_activo = estado_activo === undefined ? true : !!estado_activo;
    }
}

class MateriaPrima {
    constructor(id_materia_prima, id_unidad_medida, id_tipo_materia_prima, id_marca, nombre_materia_prima, descripcion, estado_activa, factor_conversion, stock_actual, stock_minimo, stock_maximo, tiene_vencimiento, fecha_vencimiento, precio_unitario) {
        this.id_materia_prima = id_materia_prima; this.id_unidad_medida = id_unidad_medida; this.id_tipo_materia_prima = id_tipo_materia_prima;
        this.id_marca = id_marca || null;
        this.nombre_materia_prima = nombre_materia_prima; this.descripcion = descripcion || '';
        this.estado_activa = estado_activa === undefined ? true : !!estado_activa;
        this.factor_conversion = factor_conversion || 1;
        this.stock_actual = stock_actual || 0; this.stock_minimo = stock_minimo || 0; this.stock_maximo = stock_maximo || 0;
        this.tiene_vencimiento = !!tiene_vencimiento; this.fecha_vencimiento = fecha_vencimiento || null;
        this.precio_unitario = precio_unitario;
    }
}

const ESTADOS_PEDIDO = ['Pendiente', 'En preparación', 'Listo', 'Entregado'];
const COLOR_ESTADO_PEDIDO = {
    'Pendiente': 'bg-amber-100 text-amber-800', 'En preparación': 'bg-blue-100 text-blue-800',
    'Listo': 'bg-indigo-100 text-indigo-800', 'Entregado': 'bg-emerald-100 text-emerald-800', 'Cancelado': 'bg-slate-200 text-slate-600',
    'Devuelto': 'bg-orange-100 text-orange-800'
};

// ---------- Producción: estados de Orden de Producción ----------
const ESTADOS_ORDEN_PRODUCCION = ['A iniciar', 'En Proceso', 'Finalizada', 'Cancelada'];
const COLOR_ESTADO_ORDEN_PRODUCCION = {
    'A iniciar': 'bg-amber-100 text-amber-800', 'En Proceso': 'bg-blue-100 text-blue-800',
    'Finalizada': 'bg-emerald-100 text-emerald-800', 'Cancelada': 'bg-red-100 text-red-700'
};

// ---------- Mantenimiento: estados de Orden de Mantenimiento (según diagrama de estados del TP) ----------
const ESTADOS_ORDEN_MANTENIMIENTO = ['Pendiente', 'En proceso', 'Suspendida', 'Finalizada', 'Cancelada'];
const COLOR_ESTADO_ORDEN_MANTENIMIENTO = {
    'Pendiente': 'bg-amber-100 text-amber-800', 'En proceso': 'bg-blue-100 text-blue-800',
    'Suspendida': 'bg-orange-100 text-orange-800', 'Finalizada': 'bg-emerald-100 text-emerald-800', 'Cancelada': 'bg-red-100 text-red-700'
};

// Badge de categoría de cliente: el pill principal lleva solo la categoría (Mostrador/Mayorista);
// Evento y Donación se muestran aparte como íconos chicos con tooltip, para que nunca desborden la columna.
// Se usa en las tablas de Pedidos, Presupuestos y Comprobantes de Venta.
// Tipo de Comprobante de Venta según condición de IVA del cliente al momento de emitirlo (ver generarComprobanteVenta).
const TIPO_COMPROBANTE_VENTA = { 1: 'Factura A', 2: 'Factura B' };

const COLOR_TIPO_CLIENTE = { 'Mayorista': 'bg-indigo-100 text-indigo-800', 'Mostrador': 'bg-teal-100 text-teal-800' };
function badgeTipoCliente(tipo) {
    return `<span class="text-xs ${COLOR_TIPO_CLIENTE[tipo] || 'bg-slate-100 text-slate-700'} px-2 py-1 rounded whitespace-nowrap">${tipo}</span>`;
}

// Clasificación de un Pedido (y, por extensión, de su Comprobante de Venta) en una sola etiqueta.
// Prioridad Donación > Evento > Web > Normal: un pedido puede tildar varias banderas a la vez
// (ej. evento + web), pero esta etiqueta muestra la que más condiciona su circuito administrativo.
const COLOR_TIPO_PEDIDO = { 'Donación': 'bg-pink-100 text-pink-800', 'Evento': 'bg-violet-100 text-violet-800', 'Web': 'bg-sky-100 text-sky-800', 'Normal': 'bg-slate-100 text-slate-600' };
function tipoPedidoTexto(obj) {
    if (obj.esDonacion) return 'Donación';
    if (obj.esEvento) return 'Evento';
    if (obj.esWeb) return 'Web';
    return 'Normal';
}
function badgeTipoPedido(obj) {
    const texto = tipoPedidoTexto(obj);
    return `<span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_TIPO_PEDIDO[texto]}">${texto}</span>`;
}

// ---------- Compras: catálogo de materias primas y estados de Orden de Compra ----------
// Tipo de Materia Prima: entidad propia (Tipo_Materia_Prima del diagrama), referenciada por id desde el catálogo.
class TipoMateriaPrima { constructor(id_tipo_materia_prima, nombre) { this.id_tipo_materia_prima = id_tipo_materia_prima; this.nombre = nombre; } }
const dbTiposMateriaPrima = [
    { id_tipo_materia_prima: 1, nombre: 'Harina' }, { id_tipo_materia_prima: 2, nombre: 'Huevos' },
    { id_tipo_materia_prima: 3, nombre: 'Lácteos' }, { id_tipo_materia_prima: 4, nombre: 'Envases' }
];
function nombreTipoMateriaPrima(id_tipo_materia_prima) {
    const t = dbTiposMateriaPrima.find(x => x.id_tipo_materia_prima === id_tipo_materia_prima);
    return t ? t.nombre : '-';
}

const CATALOGO_MATERIAS_PRIMAS = [
    { clave: 'harina', id_tipo_materia_prima: 1, id_marca: 5, nombre: 'Harina 0000 (Bolsa 50kg)', precio: 25000 },
    { clave: 'huevos', id_tipo_materia_prima: 2, id_marca: 6, nombre: 'Huevos Frescos (Cajón 30 dzn)', precio: 18000 },
    { clave: 'ricotta', id_tipo_materia_prima: 3, id_marca: 7, nombre: 'Ricotta Fresca (Balde 10kg)', precio: 14000 },
    { clave: 'mozzarella', id_tipo_materia_prima: 3, id_marca: 7, nombre: 'Queso Mozzarella (Bloque 5kg)', precio: 22000 },
    { clave: 'cajas', id_tipo_materia_prima: 4, id_marca: 7, nombre: 'Cajas para Ravioles (Pack x100)', precio: 8500 }
];

const ESTADOS_ORDEN_COMPRA = ['Enviada', 'Recibida'];
const COLOR_ESTADO_ORDEN_COMPRA = {
    'Enviada': 'bg-amber-100 text-amber-800', 'Recibida': 'bg-emerald-100 text-emerald-800', 'Cancelada': 'bg-slate-200 text-slate-600'
};

// ---------- Comprobantes de venta y de pago (surgen de la Orden de Pedido) ----------
const MEDIOS_PAGO = [
    { id: 1, nombre: 'Efectivo' },
    { id: 2, nombre: 'Tarjeta de Débito' },
    { id: 3, nombre: 'Transferencia Bancaria' },
    { id: 4, nombre: 'QR' }
];
const TIPOS_COMPROBANTE_VENTA = [
    { id: 1, nombre: 'Factura A', letra: 'A', codigoAfip: '01' },
    { id: 2, nombre: 'Factura B', letra: 'B', codigoAfip: '06' }
];

function nombreMedioPago(id) {
    const medio = MEDIOS_PAGO.find(m => m.id === id);
    return medio ? medio.nombre : '-';
}

function nombreTipoComprobanteVenta(id) {
    const tipo = TIPOS_COMPROBANTE_VENTA.find(t => t.id === id);
    return tipo ? tipo.nombre : '-';
}

// ---------- Datos fiscales de la empresa (datos de ejemplo - reemplazar por los reales) ----------
const DATOS_EMPRESA = {
    razonSocial: 'Fábrica de Pastas S.R.L.',
    domicilioComercial: 'Av. Villegas 450, Trenque Lauquen (Buenos Aires)',
    condicionIva: 'Responsable Inscripto',
    cuit: '30-71234567-8',
    fechaInicioActividades: '01/07/2015'
};

// Encabezado estilo "comprobante fiscal" (letra/código + datos de la empresa), reutilizado por
// Comprobante de Venta y Comprobante de Pago. `datos` = { letra, codigoAfip, numero, fecha, hora, empleado }.
// CUIT y Fecha de Inicio de Actividades van en el bloque izquierdo (datos de la empresa, no del documento puntual).
function encabezadoFiscalHTML(datos) {
    return `
        <div class="grid grid-cols-[1fr_auto_1fr] gap-4 items-start border-b border-slate-200 pb-4">
            <div class="text-xs text-slate-600 space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${DATOS_EMPRESA.razonSocial}</p>
                <p>${DATOS_EMPRESA.domicilioComercial}</p>
                <p>Condición frente al IVA: ${DATOS_EMPRESA.condicionIva}</p>
                <p>CUIT: ${DATOS_EMPRESA.cuit}</p>
                <p>Fecha de Inicio de Actividades: ${DATOS_EMPRESA.fechaInicioActividades}</p>
            </div>
            <div class="text-center border border-slate-300 rounded-md px-4 py-1">
                <p class="text-2xl font-bold text-slate-800 leading-none">${datos.letra}</p>
                <p class="text-[10px] text-slate-500">Cód. ${datos.codigoAfip}</p>
            </div>
            <div class="text-xs text-slate-600 text-right space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${datos.numero}</p>
                <p>Fecha Emisión: ${datos.fecha}</p>
                ${datos.hora ? `<p>Hora de Emisión: ${datos.hora}</p>` : ''}
                ${datos.empleado ? `<p>Responsable: ${datos.empleado}</p>` : ''}
            </div>
        </div>`;
}

// Tarjeta de datos del cliente estilo "Pedidos" (caja gris con ícono + título), usada en Presupuestos y
// en Comprobante de Venta para compartir el mismo lenguaje visual. `filasExtra` son líneas <p> ya armadas
// (ej. Tipo de Cliente, Teléfono, Condición de Venta) que se agregan después de los datos base.
function tarjetaClienteHTML(cliente, nombreFallback, filasExtra = []) {
    const filas = cliente
        ? [
            `<b class="text-slate-700">Nombre:</b> ${cliente.nombreMostrado}`,
            `<b class="text-slate-700">Documento:</b> ${cliente.documentoCompleto}`,
            `<b class="text-slate-700">Domicilio:</b> ${cliente.direccionCompleta}`,
            `<b class="text-slate-700">Condición frente al IVA:</b> ${cliente.condicion_iva}`,
            ...filasExtra
          ]
        : [nombreFallback];
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-xs">
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i>Cliente ${cliente ? badgeTipoCliente(cliente.tipo_cliente) : ''}</h3>
            ${filas.map(f => `<p>${f}</p>`).join('')}
        </div>`;
}

// Arma el HTML completo del Comprobante de Venta (encabezado fiscal + cliente + detalle + totales).
// Se usa tanto desde Ventas como desde Cobranzas para no duplicar el formato del documento.
function construirHTMLComprobanteVenta(cv) {
    const tipo = TIPOS_COMPROBANTE_VENTA.find(t => t.id === cv.id_tipo_comprobante_venta) || TIPOS_COMPROBANTE_VENTA[1];
    const fechaFormateada = cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const descuentoMonto = cv.subtotal * ((cv.porcentaje_bonificacion || 0) / 100);

    const filas = (cv.detalle || []).map(i => `
        <tr class="border-b border-slate-100">
            <td class="py-2 text-slate-500">${i.tipo || '-'}</td>
            <td class="py-2 text-slate-500">${i.subtipo || '-'}</td>
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precio_unitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${i.total.toLocaleString()}</td>
        </tr>`).join('');

    return `
        ${encabezadoFiscalHTML({ letra: tipo.letra, codigoAfip: tipo.codigoAfip, numero: `${formatearIdentificador("CV", String(cv.id_comprobante_venta_cliente).padStart(4, '0'))}`, fecha: fechaFormateada, hora: cv.hora_emision, empleado: cv.id_empleado })}
        ${cv.es_anulado ? `<span class="inline-block px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">Anulado</span>` : ''}
        <p class="no-print text-xs text-slate-400">Pedido asociado: ${formatearIdentificador("PED", cv.id_orden_pedido_cliente)}</p>
        ${tarjetaClienteHTML(cv.clienteObj, cv.cliente, [`<b class="text-slate-700">Condición de Venta:</b> ${cv.condicion_venta}`])}
        <table class="w-full text-xs text-left">
            <thead class="border-b border-slate-300 uppercase text-slate-500">
                <tr><th class="py-2">Tipo</th><th class="py-2">Subtipo</th><th class="py-2">Producto</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        <div class="border-t border-slate-200 pt-4 space-y-1">
            ${cv.observaciones ? `<p class="text-xs text-slate-500"><b class="text-slate-700">Observaciones:</b> ${cv.observaciones}</p>` : ''}
            <p class="text-xs text-slate-500 text-right">Subtotal: $ ${cv.subtotal.toLocaleString()}</p>
            <p class="text-xs text-emerald-600 text-right">Bonificación (${cv.porcentaje_bonificacion}%): -$ ${descuentoMonto.toLocaleString()}</p>
            <div class="flex items-baseline gap-2"><span class="text-sm font-semibold text-slate-500">Total:</span><span class="text-lg font-bold text-slate-900">$ ${cv.total.toLocaleString()}</span></div>
        </div>`;
}

// Arma el detalle + subtotal de un Comprobante de Venta a partir del detalle de la Orden de Pedido.
function construirDetalleComprobanteVenta(pedido, idComprobante) {
    return (pedido.detalle || []).map(i => ({
        id_comprobante_venta_cliente: idComprobante,
        id_producto: i.nombre,
        tipo: i.tipo,
        subtipo: i.subtipo,
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
        esEvento: !!pedido.esEvento,
        esDonacion: !!pedido.esDonacion,
        esWeb: !!pedido.esWeb,
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
    existente.esEvento = !!pedido.esEvento;
    existente.esDonacion = !!pedido.esDonacion;
    existente.esWeb = !!pedido.esWeb;
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
    return comprobanteVentaEstaCobrado(comprobante.id_comprobante_venta_cliente);
}

// Suma de los cobros vigentes (no anulados) asociados a un Comprobante de Venta. Permite cobros parciales
// (ej. una seña) sin perder noción de cuánto falta cobrar todavía.
function totalCobradoComprobanteVenta(idComprobanteVenta) {
    return listaComprobantesPago
        .filter(cp => cp.id_comprobante_venta_cliente === idComprobanteVenta && !cp.es_anulado)
        .reduce((acc, cp) => acc + cp.importe, 0);
}

function comprobanteVentaEstaCobrado(idComprobanteVenta) {
    const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === idComprobanteVenta);
    if (!cv) return false;
    return totalCobradoComprobanteVenta(idComprobanteVenta) >= cv.total;
}

// Estado de un Comprobante de Venta para el listado de Ventas > Comprobantes de Venta.
function estadoComprobanteVenta(cv) {
    if (cv.es_anulado) return 'Anulada';
    return comprobanteVentaEstaCobrado(cv.id_comprobante_venta_cliente) ? 'Cobrada' : 'Pendiente';
}

// Comprobante de venta "cobrable": no anulado, con saldo (las donaciones emiten un comprobante de $0) y
// todavía no cobrado. Usado tanto por el listado de Ventas (ícono "Registrar cobro") como por Cobranzas > Registrar Cobro.
function comprobanteVentaEsCobrable(cv) {
    return !cv.es_anulado && cv.total > 0 && !comprobanteVentaEstaCobrado(cv.id_comprobante_venta_cliente);
}

// Total cobrado en una fecha dada (YYYY-MM-DD), agrupado por medio de pago. Reemplaza al antiguo
// "Cierre de Caja" (que solo acumulaba un contador en memoria): esto se recalcula siempre en vivo
// a partir de los comprobantes de pago realmente registrados, por eso no hace falta "cerrar" nada.
function totalesCobradosPorMedio(fecha) {
    const cobrosDelDia = listaComprobantesPago.filter(cp => cp.fecha_pago === fecha && !cp.es_anulado);
    return MEDIOS_PAGO.map(medio => ({
        medio: medio.nombre,
        total: cobrosDelDia.filter(cp => cp.id_medio_pago === medio.id).reduce((acc, cp) => acc + cp.importe, 0)
    }));
}

function registrarComprobantePago({ comprobanteVenta, idMedioPago, condicionPago, importe, observaciones, fechaPago, horaPago, empleado }) {
    const ahora = new Date();
    const comprobantePago = {
        id_comprobante_pago_cliente: numComprobantePagoContador++,
        id_comprobante_venta_cliente: comprobanteVenta.id_comprobante_venta_cliente,
        id_cliente: comprobanteVenta.id_cliente,
        clienteObj: comprobanteVenta.clienteObj,
        cliente: comprobanteVenta.cliente,
        esEvento: !!comprobanteVenta.esEvento,
        esDonacion: !!comprobanteVenta.esDonacion,
        esWeb: !!comprobanteVenta.esWeb,
        id_medio_pago: idMedioPago,
        fecha_pago: fechaPago || ahora.toISOString().slice(0, 10),
        hora_pago: horaPago || ahora.toTimeString().slice(0, 5),
        condicion_pago: condicionPago,
        empleado: empleado || '',
        importe,
        observaciones: observaciones || '',
        es_anulado: false
    };
    listaComprobantesPago.unshift(comprobantePago);
    return comprobantePago;
}

// ==========================================
// PERSISTENCIA (sessionStorage) - así lo cargado en una pantalla se ve
// reflejado en el resto de las páginas del panel durante la sesión del
// navegador. Al cerrar el navegador/pestaña los datos de prueba se
// descartan y la próxima sesión vuelve a arrancar con los datos semilla.
// ==========================================
const CLAVE_ALMACENAMIENTO = 'fabricaPastasDB_v1';

function crearDatosIniciales() {
    const clientes = [
        new Cliente('', '', 'CUIT', '30712345678', dbCalles[0], '450', '(02392) 456789', 'compras@hotelplaza.com', 'Responsable Inscripto', 'Mayorista', 150000, 'Hotel Plaza S.A.', '2023-02-10', true, [], 'hotelplaza', 'hotelplaza123'),
        new Cliente('', '', 'CUIT', '30889911224', dbCalles[2], '890', '11-4567-1234', 'donmosa@gmail.com', 'Responsable Inscripto', 'Mayorista', 80000, 'Restaurante Don Mosa', '2023-06-18', true, [], 'donmosa', 'donmosa123'),
        new Cliente('María', 'Gómez', 'DNI', '28554433', dbCalles[1], '245', '11-2233-4455', 'mariagomez@gmail.com', 'Consumidor Final', 'Mostrador', 0, '', '2024-01-05', false, [], 'mariagomez', 'mariagomez123'),
        new Cliente('Lucas', 'Fernández', 'DNI', '35667788', dbCalles[4], '120', '0351-556677', 'lucasf@gmail.com', 'Consumidor Final', 'Mostrador', 0, '', '2024-03-22', false, [], 'lucasf', 'lucasf123')
    ];
    const proveedores = [
        new Proveedor('Jorge', 'Funes', 'CUIT', '30501234567', dbCalles[3], '100', '(0341) 4321000', 'ventas@molinos.com', 'Responsable Inscripto', 'Harinas y Sémolas', 'Molinos Cañuelas S.A.', '2021-05-03', '5 días hábiles', true),
        new Proveedor('Marcela', 'Díaz', 'CUIT', '30612398742', dbCalles[1], '1200', '(02392) 489112', 'pedidos@avicolasur.com', 'Responsable Inscripto', 'Huevos Frescos', 'Distribuidora Avícola Sur', '2022-01-20', '2 días hábiles', true),
        new Proveedor('Natalia', 'Pereyra', 'CUIT', '30778899001', dbCalles[2], '340', '0341-455-7788', 'ventas@lacteossanta.com', 'Responsable Inscripto', 'Lácteos y Quesos', 'Lácteos Santa Rosa S.R.L.', '2020-11-12', '3 días hábiles', true),
        new Proveedor('Diego', 'Ibarra', 'CUIT', '30445566778', dbCalles[0], '78', '02392-442211', 'contacto@embalajesnorte.com', 'Monotributo', 'Embalajes y Packaging', 'Embalajes del Norte', '2023-04-02', '7 días hábiles', true),
        new Proveedor('Sofía', 'Molina', 'CUIT', '30667788990', dbCalles[4], '910', '0351-478-2233', 'pedidos@condimentoscba.com', 'Responsable Inscripto', 'Condimentos y Especias', 'Condimentos Córdoba S.A.', '2019-08-25', '4 días hábiles', false),
        new Proveedor('Ramiro', 'Suárez', 'CUIT', '30889900112', dbCalles[1], '560', '011-4890-3344', 'logistica@transpastas.com', 'Responsable Inscripto', 'Logística y Transporte', 'TransPastas Logística', '2022-06-30', '1 día hábil', true)
    ];
    const empleados = [
        new Empleado('Carlos', 'Gómez', 'CUIL', '20334455669', '1988-05-14', dbCalles[0], '1234', '(02392) 15-443322', 'cgomez@pastas.com', 'EMP-0001', 'Maestro Pastero (Producción)', '2021-03-15', 450000, '2021-03-10', 'Mañana'),
        new Empleado('Laura', 'Rodríguez', 'CUIL', '27389900114', '1995-11-20', dbCalles[1], '567', '(02392) 15-887766', 'lrodriguez@pastas.com', 'EMP-0002', 'Atención al Cliente / Mostrador', '2022-08-01', 380000, '2022-07-28', 'Tarde'),
        new Empleado('Martín', 'Acosta', 'CUIL', '23456789012', '1992-02-18', dbCalles[2], '233', '0341-555-9988', 'macosta@pastas.com', 'EMP-0003', 'Ayudante de Cocina', '2022-11-05', 350000, '2022-11-01', 'Mañana'),
        new Empleado('Valentina', 'Suárez', 'CUIL', '28901234567', '1998-07-09', dbCalles[3], '45', '0341-444-1122', 'vsuarez@pastas.com', 'EMP-0004', 'Atención al Cliente / Mostrador', '2023-02-20', 360000, '2023-02-15', 'Tarde'),
        new Empleado('Franco', 'Benítez', 'CUIL', '21345678901', '1985-09-30', dbCalles[4], '820', '0351-333-7766', 'fbenitez@pastas.com', 'EMP-0005', 'Repartidor / Logística', '2020-05-10', 400000, '2020-05-05', 'Mañana'),
        new Empleado('Camila', 'Torres', 'CUIL', '26789012345', '2000-01-25', dbCalles[0], '150', '02392-556-4433', 'ctorres@pastas.com', 'EMP-0006', 'Administrador / Contador', '2024-03-01', 470000, '2024-02-25', 'Noche', [], false)
    ];
    const maquinaria = [
        new Maquinaria(1, 'Sobadora Industrial', 'Laminadora de masa para pastas secas y rellenas', '2019-03-10', 'Horas', 'Operativa', 1, 'IM-450'),
        new Maquinaria(2, 'Envasadora al Vacío', 'Envasado de productos frescos para conservación', '2021-07-22', 'Turnos', 'Operativa', 2, 'VMS-25'),
        new Maquinaria(3, 'Amasadora Doble Brazo', 'Amasado de grandes volúmenes de masa', '2017-11-05', 'Horas', 'En reparación', 3, 'DB-120'),
        new Maquinaria(4, 'Cortadora de Ravioles', 'Formado y corte de pastas rellenas', '2022-04-18', 'Turnos', 'Operativa', 4, 'RV-300')
    ];
    const productos = [
        new Producto(1, 1, 1, 'Fideos Frescos al Huevo', 'Pasta fresca laminada, lista para cocinar.', 2600, 42, 15, true),
        new Producto(2, 1, 1, 'Tagliatelle Fresco', 'Cinta ancha de pasta fresca al huevo.', 2900, 30, 15, true),
        new Producto(3, 2, 1, 'Tallarines al Huevo', 'Pasta seca de larga duración.', 2800, 85, 20, true),
        new Producto(4, 2, 1, 'Ñoquis de Papa', 'Pasta seca a base de papa.', 3000, 60, 20, true),
        new Producto(5, 3, 1, 'Ravioles de Ricotta y Verdura', 'Pasta rellena, porción familiar.', 3500, 25, 10, true),
        new Producto(6, 3, 1, 'Sorrentinos de Jamón y Queso', 'Pasta rellena, porción familiar.', 4200, 18, 10, true),
        new Producto(7, 4, 4, 'Salsa Fileto en Pote', 'Salsa clásica de tomate.', 1200, 54, 15, true),
        new Producto(8, 4, 4, 'Salsa Bolognesa en Pote', 'Salsa clásica con carne.', 1800, 8, 15, true),
        new Producto(9, 3, 1, 'Sorrentinos de Jamón y Queso (edición anterior)', 'Receta descontinuada, reemplazada por la actual.', 3900, 0, 10, false)
    ];
    const materiasPrimas = [
        new MateriaPrima(1, 1, 1, 5, 'Harina 0000', 'Harina de trigo tipo 0000 para masas.', true, 1, 89.4, 30, 200, false, null, 500),
        new MateriaPrima(2, 3, 2, 6, 'Huevos Frescos', 'Huevos de granja para pasta al huevo.', true, 12, 79.8, 20, 150, true, '2026-11-05', 1500),
        new MateriaPrima(3, 1, 3, 7, 'Ricotta Fresca', 'Ricotta fresca para rellenos.', true, 1, 47, 15, 80, true, '2026-10-28', 2800),
        new MateriaPrima(4, 1, 3, 7, 'Queso Mozzarella', 'Mozzarella en bloque para rellenos.', true, 1, 12, 15, 60, true, '2026-11-10', 4400),
        new MateriaPrima(5, 2, 4, 7, 'Cajas para Ravioles', 'Packaging de cartón para pastas rellenas.', true, 100, 340, 100, 1000, false, null, 85),
        new MateriaPrima(6, 1, 1, 5, 'Sémola de Trigo', 'Sémola para pastas secas de mayor cuerpo.', false, 1, 0, 20, 150, false, null, 550)
    ];
    const recetas = [
        new Receta(1, 'Receta Ravioles de Ricotta', 'Ravioles de Ricotta y Verdura', [{ clave_mp: 'harina', cantidad_por_kg: 0.4 }, { clave_mp: 'ricotta', cantidad_por_kg: 0.3 }]),
        new Receta(2, 'Receta Tallarines al Huevo', 'Tallarines al Huevo', [{ clave_mp: 'harina', cantidad_por_kg: 0.6 }, { clave_mp: 'huevos', cantidad_por_kg: 0.1 }]),
        new Receta(3, 'Receta Ñoquis de Papa', 'Ñoquis de Papa', [{ clave_mp: 'harina', cantidad_por_kg: 0.3 }])
    ];
    const pedidos = [
        { id: 1052, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esEvento: true, esDonacion: false, esWeb: true, bonificacion: 20,
          empleado: 'Sistema Web', observaciones: 'Pedido ingresado automáticamente desde tienda-online.html.', estado: 'Pendiente', fecha: '2026-10-09', hora: '20:15',
          fechaEntregaEstimada: '2026-10-18', horaEntregaEstimada: '19:00',
          detalle: [{ id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pastas Rellenas', cantidad: 25, precioUnitario: 4200, subtotal: 105000 }], total: 84000 },

        { id: 1051, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, esWeb: true, bonificacion: 0,
          empleado: 'Sistema Web', observaciones: 'Pedido ingresado automáticamente desde tienda-online.html.', estado: 'Listo', fecha: '2026-10-08', hora: '21:40',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 3, precioUnitario: 2800, subtotal: 8400 }], total: 8400 },

        { id: 1050, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 15,
          empleado: 'Carlos Gómez', observaciones: 'Evento de fin de semana, retira el chef.', estado: 'Pendiente', fecha: '2026-10-07', hora: '09:30',
          fechaEntregaEstimada: '2026-10-20', horaEntregaEstimada: '10:00',
          detalle: [
              { id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pastas Rellenas', cantidad: 15, precioUnitario: 3500, subtotal: 52500 },
              { id: 2, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 10, precioUnitario: 2800, subtotal: 28000 }
          ], total: 68425 },

        { id: 1049, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esDonacion: false, bonificacion: 10,
          empleado: 'Eugenia Fernández', observaciones: 'Pedido habitual quincenal.', estado: 'Pendiente', fecha: '2026-10-06', hora: '14:10',
          fechaEntregaEstimada: '2026-10-17', horaEntregaEstimada: '15:30',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 8, precioUnitario: 2800, subtotal: 22400 }], total: 20160 },

        // Mostrador normal (ni evento ni donación): nace directamente "Listo" para facturar, no pasa por Pendiente.
        { id: 1048, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Listo', fecha: '2026-10-06', hora: '10:45',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 6, precioUnitario: 3000, subtotal: 18000 }], total: 18000 },

        { id: 1047, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Listo', fecha: '2026-10-04', hora: '16:20',
          detalle: [{ id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pastas Rellenas', cantidad: 5, precioUnitario: 3500, subtotal: 17500 }], total: 17500 },

        { id: 1046, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 15,
          empleado: 'Carlos Gómez', observaciones: 'Reposición semanal de salón.', estado: 'Pendiente', fecha: '2026-10-02', hora: '08:50',
          detalle: [
              { id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 12, precioUnitario: 3000, subtotal: 36000 },
              { id: 2, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pastas Rellenas', cantidad: 8, precioUnitario: 3500, subtotal: 28000 }
          ], total: 54400 },

        { id: 1045, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Listo', fecha: '2026-10-01', hora: '11:00',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 4, precioUnitario: 3000, subtotal: 12000 }], total: 12000 },

        { id: 1044, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'En preparación', fecha: '2026-09-30', hora: '09:15',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 2, precioUnitario: 2800, subtotal: 5600 }], total: 5600 },

        { id: 1043, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'En preparación', fecha: '2026-09-29', hora: '17:40',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 3, precioUnitario: 3000, subtotal: 9000 }], total: 9000 },

        { id: 1042, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esDonacion: false, bonificacion: 10,
          empleado: 'Eugenia Fernández', observaciones: 'Entrega habitual de los lunes.', estado: 'Listo', fecha: '2026-09-29', hora: '10:30',
          detalle: [{ id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pastas Rellenas', cantidad: 10, precioUnitario: 4200, subtotal: 42000 }], total: 37800 },

        { id: 1041, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esDonacion: false, bonificacion: 15, idPresupuestoOrigen: 5,
          empleado: 'Carlos Gómez', observaciones: 'Entregar en la cocina del hotel, preguntar por el chef Darío.', estado: 'Listo', fecha: '2026-09-27', hora: '11:00',
          detalle: [
              { id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pastas Rellenas', cantidad: 15, precioUnitario: 4200, subtotal: 63000 },
              { id: 2, nombre: 'Salsa Bolognesa en Pote', tipo: 'Salsas', cantidad: 15, precioUnitario: 1800, subtotal: 27000 }
          ], total: 76500 },

        { id: 1040, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esEvento: true, esDonacion: false, bonificacion: 20, idPresupuestoOrigen: 2,
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
          empleado: 'Carlos Gómez', observaciones: '', estado: 'Listo', fecha: '2026-09-21', hora: '10:00',
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
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pastas Secas', cantidad: 1, precioUnitario: 2800, subtotal: 2800 }], total: 2800 },

        // Pedido con devolución parcial ya registrada, para tener un caso real de estado "Devuelto" en los datos de ejemplo.
        { id: 1033, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esDonacion: false, bonificacion: 0,
          empleado: 'Laura Rodríguez', observaciones: '', estado: 'Devuelto', fecha: '2026-09-17', hora: '10:30',
          fechaEntrega: '2026-09-17', horaEntrega: '11:15',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 4, precioUnitario: 3000, subtotal: 12000 }], total: 12000,
          devoluciones: [{ id: 1, registradoPor: 'Laura Rodríguez', motivo: 'El cliente encontró 1 unidad en mal estado.',
              items: [{ nombre: 'Ñoquis de Papa', tipo: 'Pastas Secas', cantidad: 1 }], fecha: '2026-09-18', hora: '09:40' }] }
    ];

    // Presupuestos: cotizaciones previas a confirmar un pedido. Algunos ya se convirtieron en una de las órdenes de arriba.
    const presupuestos = [
        { id: 7, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esEvento: false,
          observaciones: '', estado: 'Pendiente', idPedidoGenerado: null, creadoPor: 'Eugenia Fernández', fecha: '2026-10-06', hora: '11:20', fecha_vencimiento: '2026-10-13',
          detalle: [{ id: 1, nombre: 'Tallarines al Huevo', tipo: 'Pasta', subtipo: 'Seca', cantidad: 2, precioUnitario: 2800, subtotal: 5600 }], total: 5600 },

        { id: 6, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esEvento: true,
          observaciones: 'Presupuesto para evento de cumpleaños empresarial.', estado: 'Pendiente', idPedidoGenerado: null, creadoPor: 'Josefina Silva', fecha: '2026-10-05', hora: '16:40', fecha_vencimiento: '2026-10-25',
          detalle: [
              { id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pasta', subtipo: 'Rellena', cantidad: 25, precioUnitario: 3500, subtotal: 87500 },
              { id: 2, nombre: 'Salsa Fileto en Pote', tipo: 'Salsa', subtipo: 'Clásica', cantidad: 10, precioUnitario: 1200, subtotal: 12000 }
          ], total: 99500 },

        { id: 5, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esEvento: false,
          observaciones: 'Pedido habitual quincenal del hotel.', estado: 'Convertido', idPedidoGenerado: 1041, creadoPor: 'Carlos Gómez', fecha: '2026-09-26', hora: '09:15', fecha_vencimiento: '2026-10-10',
          detalle: [
              { id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pasta', subtipo: 'Rellena', cantidad: 15, precioUnitario: 4200, subtotal: 63000 },
              { id: 2, nombre: 'Salsa Bolognesa en Pote', tipo: 'Salsa', subtipo: 'Clásica', cantidad: 15, precioUnitario: 1800, subtotal: 27000 }
          ], total: 90000 },

        { id: 4, clienteObj: clientes[3], cliente: 'Lucas Fernández', tipo: 'Mostrador', esEvento: true,
          observaciones: 'Reunión familiar de cumpleaños.', estado: 'Pendiente', idPedidoGenerado: null, creadoPor: 'Eugenia Fernández', fecha: '2026-09-25', hora: '14:00', fecha_vencimiento: '2026-10-30',
          detalle: [{ id: 1, nombre: 'Ñoquis de Papa', tipo: 'Pasta', subtipo: 'Seca', cantidad: 6, precioUnitario: 3000, subtotal: 18000 }], total: 18000 },

        { id: 3, clienteObj: clientes[2], cliente: 'María Gómez', tipo: 'Mostrador', esEvento: false,
          observaciones: '', estado: 'Pendiente', idPedidoGenerado: null, creadoPor: 'Josefina Silva', fecha: '2026-09-23', hora: '10:05', fecha_vencimiento: '2026-10-20',
          detalle: [{ id: 1, nombre: 'Salsa Fileto en Pote', tipo: 'Salsa', subtipo: 'Clásica', cantidad: 3, precioUnitario: 1200, subtotal: 3600 }], total: 3600 },

        { id: 2, clienteObj: clientes[1], cliente: 'Restaurante Don Mosa', tipo: 'Mayorista', esEvento: true,
          observaciones: 'Pedido para evento de fin de mes.', estado: 'Convertido', idPedidoGenerado: 1040, creadoPor: 'Carlos Gómez', fecha: '2026-09-22', hora: '08:00', fecha_vencimiento: '2026-10-07',
          detalle: [{ id: 1, nombre: 'Ravioles de Ricotta y Verdura', tipo: 'Pasta', subtipo: 'Rellena', cantidad: 20, precioUnitario: 3500, subtotal: 70000 }], total: 70000 },

        { id: 1, clienteObj: clientes[0], cliente: 'Hotel Plaza S.A.', tipo: 'Mayorista', esEvento: true,
          observaciones: 'Evento de fin de año para el personal del hotel.', estado: 'Pendiente', idPedidoGenerado: null, creadoPor: 'Josefina Silva', fecha: '2026-09-20', hora: '17:30', fecha_vencimiento: '2026-10-05',
          detalle: [
              { id: 1, nombre: 'Sorrentinos de Jamón y Queso', tipo: 'Pasta', subtipo: 'Rellena', cantidad: 30, precioUnitario: 4200, subtotal: 126000 },
              { id: 2, nombre: 'Salsa Fileto en Pote', tipo: 'Salsa', subtipo: 'Clásica', cantidad: 20, precioUnitario: 1200, subtotal: 24000 }
          ], total: 150000 }
    ];

    // El Comprobante de Venta recién nace cuando el pedido llega a "Listo" (ver actualizarComprobanteVenta);
    // los que siguen Pendiente o En preparación todavía no tienen uno.
    let contadorComprobanteVenta = 1;
    const comprobantesVenta = pedidos.slice().reverse().filter(pedido => !['Pendiente', 'En preparación'].includes(pedido.estado)).map(pedido => {
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
            esEvento: !!pedido.esEvento,
            esDonacion: !!pedido.esDonacion,
            esWeb: !!pedido.esWeb,
            es_anulado: pedido.estado === 'Cancelado',
            subtotal: (pedido.detalle || []).reduce((acc, i) => acc + i.subtotal, 0),
            porcentaje_bonificacion: pedido.esDonacion ? 100 : (pedido.bonificacion || 0),
            total: pedido.total,
            observaciones: pedido.observaciones || '',
            detalle: (pedido.detalle || []).map(i => ({
                id_comprobante_venta_cliente: idComprobante, id_producto: i.nombre, tipo: i.tipo, subtipo: i.subtipo, nombre: i.nombre,
                cantidad: i.cantidad, precio_unitario: i.precioUnitario, total: i.subtotal
            }))
        };
    }).reverse();

    // Pagos ya recibidos para los pedidos que llegaron a "Entregado" (simulan cobros históricos previos a esta sesión).
    let contadorComprobantePago = 1;
    const comprobantesPago = [];
    const pagosHistoricos = [
        { idPedido: 1034, idMedioPago: 1, fecha: '2026-09-18', hora: '18:35', condicionPago: 'Contado', empleado: 'Laura Rodríguez' },
        { idPedido: 1040, idMedioPago: 3, fecha: '2026-09-25', hora: '14:10', condicionPago: 'Cuenta Corriente', empleado: 'Carlos Gómez' },
        { idPedido: 1035, idMedioPago: 2, fecha: '2026-09-19', hora: '10:05', condicionPago: 'Contado', empleado: 'Laura Rodríguez' },
        { idPedido: 1036, idMedioPago: 1, fecha: '2026-09-20', hora: '13:50', condicionPago: 'Contado', empleado: 'Valentina Suárez' },
        { idPedido: 1037, idMedioPago: 4, fecha: '2026-09-21', hora: '11:15', condicionPago: 'Contado', empleado: 'Laura Rodríguez' },
        { idPedido: 1041, idMedioPago: 3, fecha: '2026-09-27', hora: '12:00', condicionPago: 'Cuenta Corriente', empleado: 'Carlos Gómez' },
        { idPedido: 1042, idMedioPago: 1, fecha: '2026-09-29', hora: '11:00', condicionPago: 'Contado', empleado: 'Josefina Silva' }
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
            esEvento: !!cv.esEvento,
            esDonacion: !!cv.esDonacion,
            esWeb: !!cv.esWeb,
            id_medio_pago: pago.idMedioPago,
            fecha_pago: pago.fecha,
            hora_pago: pago.hora,
            condicion_pago: pago.condicionPago,
            empleado: pago.empleado,
            importe: cv.total,
            observaciones: '',
            es_anulado: false
        });
    });

    // Presupuestos de Proveedores: cotizaciones de materia prima previas a confirmar una orden de compra.
    const presupuestosProveedor = [
        { id_presupuesto_proveedor: 6, proveedorObj: proveedores[2], proveedor: proveedores[2].nombreMostrado,
          fecha_emision: '2026-10-04', hora_emision: '10:00', condicion_entrega: 'Entrega en fábrica', fecha_vencimiento: '2026-10-25',
          estado: 'Pendiente', empleado: 'Laura Rodríguez', idOrdenCompraGenerada: null, observaciones: '',
          detalle: [{ clave: 'ricotta', tipo: 'Ricotta', marca: 'Lácteos Santa Rosa', nombre: 'Ricotta Fresca (Balde 10kg)', cantidad: 6, precio_unitario: 15000, subtotal: 90000 }],
          total_estimado: 90000 },

        { id_presupuesto_proveedor: 5, proveedorObj: proveedores[4], proveedor: proveedores[4].nombreMostrado,
          fecha_emision: '2026-09-30', hora_emision: '15:40', condicion_entrega: 'Entrega en fábrica', fecha_vencimiento: '2026-10-18',
          estado: 'Convertido', empleado: 'Carlos Gómez', idOrdenCompraGenerada: 104, observaciones: 'Reposición de condimentos para la línea de salsas.',
          detalle: [{ clave: 'condimentos', tipo: 'Condimentos', marca: 'Condimentos Córdoba', nombre: 'Surtido de Especias (Caja 20kg)', cantidad: 2, precio_unitario: 45000, subtotal: 90000 }],
          total_estimado: 90000 },

        { id_presupuesto_proveedor: 4, proveedorObj: proveedores[3], proveedor: proveedores[3].nombreMostrado,
          fecha_emision: '2026-09-18', hora_emision: '09:50', condicion_entrega: 'Retira el proveedor habitual', fecha_vencimiento: '2026-10-05',
          estado: 'Pendiente', empleado: 'Martín Acosta', idOrdenCompraGenerada: null, observaciones: '',
          detalle: [{ clave: 'embalajes', tipo: 'Embalajes', marca: 'Embalajes del Norte', nombre: 'Cajas de Packaging (Pack x200)', cantidad: 3, precio_unitario: 30000, subtotal: 90000 }],
          total_estimado: 90000 },

        { id_presupuesto_proveedor: 3, proveedorObj: proveedores[1], proveedor: proveedores[1].nombreMostrado,
          fecha_emision: '2026-10-02', hora_emision: '09:30', condicion_entrega: 'Entrega en fábrica', fecha_vencimiento: '2026-10-20',
          estado: 'Pendiente', empleado: 'Laura Rodríguez', idOrdenCompraGenerada: null, observaciones: '',
          detalle: [{ clave: 'huevos', tipo: 'Huevos', marca: 'Avícola Sur', nombre: 'Huevos Frescos (Cajón 30 dzn)', cantidad: 4, precio_unitario: 18000, subtotal: 72000 }],
          total_estimado: 72000 },

        { id_presupuesto_proveedor: 2, proveedorObj: proveedores[0], proveedor: proveedores[0].nombreMostrado,
          fecha_emision: '2026-09-28', hora_emision: '11:00', condicion_entrega: 'Retira el proveedor habitual', fecha_vencimiento: '2026-10-15',
          estado: 'Convertido', empleado: 'Carlos Gómez', idOrdenCompraGenerada: 102, observaciones: 'Pedido mensual de harina.',
          detalle: [{ clave: 'harina', tipo: 'Harina', marca: 'Molinos Cañuelas', nombre: 'Harina 0000 (Bolsa 50kg)', cantidad: 10, precio_unitario: 25000, subtotal: 250000 }],
          total_estimado: 250000 },

        { id_presupuesto_proveedor: 1, proveedorObj: proveedores[0], proveedor: proveedores[0].nombreMostrado,
          fecha_emision: '2026-09-15', hora_emision: '10:15', condicion_entrega: 'Entrega en fábrica', fecha_vencimiento: '2026-09-30',
          estado: 'Pendiente', empleado: 'Martín Acosta', idOrdenCompraGenerada: null, observaciones: '',
          detalle: [{ clave: 'harina', tipo: 'Harina', marca: 'Molinos Cañuelas', nombre: 'Harina 0000 (Bolsa 50kg)', cantidad: 5, precio_unitario: 25000, subtotal: 125000 }],
          total_estimado: 125000 }
    ];

    // Órdenes de Compra: algunas surgen de un presupuesto ya convertido, otras se emiten directamente.
    const ordenesCompra = [
        { id: 105, id_presupuesto_proveedor: null, proveedorObj: proveedores[5], proveedor: proveedores[5].nombreMostrado,
          fecha_emision: '2026-10-06', hora_emision: '08:30', condicion_pago: 'Contado', estado: 'Enviada', observaciones: 'Flete para distribución semanal.',
          detalle: [{ clave: 'logistica', tipo: 'Servicio', marca: 'TransPastas', nombre: 'Flete de Distribución', cantidad: 1, precioUnitario: 45000, subtotal: 45000 }],
          total: 45000 },

        { id: 104, id_presupuesto_proveedor: 5, proveedorObj: proveedores[4], proveedor: proveedores[4].nombreMostrado,
          fecha_emision: '2026-10-01', hora_emision: '16:00', condicion_pago: 'Cuenta Corriente', estado: 'Recibida', observaciones: 'Reposición de condimentos para la línea de salsas.',
          detalle: [{ clave: 'condimentos', tipo: 'Condimentos', marca: 'Condimentos Córdoba', nombre: 'Surtido de Especias (Caja 20kg)', cantidad: 2, precioUnitario: 45000, subtotal: 90000 }],
          total: 90000 },

        { id: 103, id_presupuesto_proveedor: null, proveedorObj: proveedores[2], proveedor: proveedores[2].nombreMostrado,
          fecha_emision: '2026-09-22', hora_emision: '11:30', condicion_pago: 'Contado', estado: 'Cancelada', observaciones: 'Se canceló por error en el pedido.',
          detalle: [{ clave: 'ricotta', tipo: 'Ricotta', marca: 'Lácteos Santa Rosa', nombre: 'Ricotta Fresca (Balde 10kg)', cantidad: 4, precioUnitario: 15000, subtotal: 60000 }],
          total: 60000 },

        { id: 102, id_presupuesto_proveedor: 2, proveedorObj: proveedores[0], proveedor: proveedores[0].nombreMostrado,
          fecha_emision: '2026-09-29', hora_emision: '09:00', condicion_pago: 'Cuenta Corriente', estado: 'Enviada', observaciones: 'Pedido mensual de harina.',
          detalle: [{ clave: 'harina', tipo: 'Harina', marca: 'Molinos Cañuelas', nombre: 'Harina 0000 (Bolsa 50kg)', cantidad: 10, precioUnitario: 25000, subtotal: 250000 }],
          total: 250000 },

        { id: 101, id_presupuesto_proveedor: null, proveedorObj: proveedores[1], proveedor: proveedores[1].nombreMostrado,
          fecha_emision: '2026-09-10', hora_emision: '15:20', condicion_pago: 'Contado', estado: 'Recibida', observaciones: '',
          detalle: [{ clave: 'huevos', tipo: 'Huevos', marca: 'Avícola Sur', nombre: 'Huevos Frescos (Cajón 30 dzn)', cantidad: 2, precioUnitario: 18000, subtotal: 36000 }],
          total: 36000 }
    ];

    // Remitos de Proveedores: mercadería ya recibida contra una Orden de Compra (las Órdenes "Enviada" todavía no tienen remito).
    const remitos = [
        { id_remito_proveedor: 2, id_proveedor: proveedores[4].numero_documento, proveedorObj: proveedores[4], proveedor: proveedores[4].nombreMostrado,
          id_orden_compra_proveedor: 104, fecha_emision: '2026-10-01', hora_emision: '16:05', fecha_entrega: '2026-10-02', hora_entrega: '10:30',
          firma_recepcion: 'Carlos Gómez', observaciones: '',
          detalle: [{ clave: 'condimentos', tipo: 'Condimentos', marca: 'Condimentos Córdoba', nombre: 'Surtido de Especias (Caja 20kg)', cantidad: 2 }] },

        { id_remito_proveedor: 1, id_proveedor: proveedores[1].numero_documento, proveedorObj: proveedores[1], proveedor: proveedores[1].nombreMostrado,
          id_orden_compra_proveedor: 101, fecha_emision: '2026-09-10', hora_emision: '15:25', fecha_entrega: '2026-09-11', hora_entrega: '09:00',
          firma_recepcion: 'Laura Rodríguez', observaciones: 'Entrega completa, sin faltantes.',
          detalle: [{ clave: 'huevos', tipo: 'Huevos', marca: 'Avícola Sur', nombre: 'Huevos Frescos (Cajón 30 dzn)', cantidad: 2 }] }
    ];

    // Órdenes de Producción: datos de prueba. Toda OP nace "A iniciar" (todavía sin descontar stock); al marcarla
    // "En Proceso" descuenta la MP planificada, y las Finalizadas ya pasaron por el Cierre.
    const ordenesProduccion = [
        { id_orden_produccion: 7, id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-12', hora_emision: '09:30', fecha_inicio: '2026-10-13', hora_inicio: '08:00', fecha_fin: '2026-10-13', hora_fin: '16:00',
          fecha_vencimiento: '2026-11-12', estado: 'Finalizada', observaciones: 'Producción semanal de pastas secas.', stockDescontado: true,
          detalleProductos: [
              { id_receta: 2, nombre_producto: 'Tallarines al Huevo', nombre_receta: 'Receta Tallarines al Huevo', cantidad_planificada: 10, cantidad_real: 9.8, numero_lote_proyectado: 'LOT-8', numero_lote_definitivo: null, fecha_vencimiento: '2026-11-12' },
              { id_receta: 3, nombre_producto: 'Ñoquis de Papa', nombre_receta: 'Receta Ñoquis de Papa', cantidad_planificada: 8, cantidad_real: 8, numero_lote_proyectado: 'LOT-9', numero_lote_definitivo: null, fecha_vencimiento: '2026-11-12' }
          ],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 8.4, cantidad_real: 8.6 }, { clave_mp: 'huevos', nombre: 'Huevos Frescos', cantidad_planificada: 1, cantidad_real: 1 }] },

        { id_orden_produccion: 6, id_empleado: 'Laura Rodríguez',
          fecha_emision: '2026-10-10', hora_emision: '11:00', fecha_inicio: '2026-10-11', hora_inicio: '07:30', fecha_fin: '2026-10-11', hora_fin: '13:00',
          fecha_vencimiento: '2026-10-26', estado: 'Finalizada', observaciones: '', stockDescontado: true,
          detalleProductos: [
              { id_receta: 1, nombre_producto: 'Ravioles de Ricotta y Verdura', nombre_receta: 'Receta Ravioles de Ricotta', cantidad_planificada: 6, cantidad_real: 6, numero_lote_proyectado: 'LOT-6', numero_lote_definitivo: null, fecha_vencimiento: '2026-10-26' },
              { id_receta: 3, nombre_producto: 'Ñoquis de Papa', nombre_receta: 'Receta Ñoquis de Papa', cantidad_planificada: 5, cantidad_real: 4.5, numero_lote_proyectado: 'LOT-7', numero_lote_definitivo: null, fecha_vencimiento: '2026-11-10' }
          ],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 3.9, cantidad_real: 3.9 }, { clave_mp: 'ricotta', nombre: 'Ricotta Fresca', cantidad_planificada: 1.8, cantidad_real: 1.9 }] },

        { id_orden_produccion: 5, id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-08', hora_emision: '08:15', fecha_inicio: '2026-10-08', hora_inicio: '09:00', fecha_fin: '2026-10-08', hora_fin: '12:00',
          fecha_vencimiento: '2026-11-07', estado: 'Finalizada', observaciones: 'Reposición de stock de pastas secas.', stockDescontado: true,
          detalleProductos: [{ id_receta: 2, nombre_producto: 'Tallarines al Huevo', nombre_receta: 'Receta Tallarines al Huevo', cantidad_planificada: 5, cantidad_real: 5, numero_lote_proyectado: 'LOT-5', numero_lote_definitivo: null, fecha_vencimiento: '2026-11-07' }],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 3, cantidad_real: 3.1 }, { clave_mp: 'huevos', nombre: 'Huevos Frescos', cantidad_planificada: 0.5, cantidad_real: 0.5 }] },

        { id_orden_produccion: 4, id_empleado: 'Laura Rodríguez',
          fecha_emision: '2026-10-07', hora_emision: '09:00', fecha_inicio: '2026-11-03', hora_inicio: '08:00', fecha_fin: '2026-11-03', hora_fin: '12:00',
          estado: 'A iniciar', observaciones: '', stockDescontado: false,
          detalleProductos: [{ id_receta: 2, nombre_producto: 'Tallarines al Huevo', nombre_receta: 'Receta Tallarines al Huevo', cantidad_planificada: 2, cantidad_real: null, numero_lote_proyectado: 'LOT-4', numero_lote_definitivo: null, fecha_vencimiento: null }],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 1.2 }, { clave_mp: 'huevos', nombre: 'Huevos Frescos', cantidad_planificada: 0.2 }] },

        { id_orden_produccion: 3, id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-06', hora_emision: '10:30', fecha_inicio: '2026-11-04', hora_inicio: '07:00', fecha_fin: '2026-11-04', hora_fin: '10:00',
          estado: 'A iniciar', observaciones: '', stockDescontado: false,
          detalleProductos: [{ id_receta: 3, nombre_producto: 'Ñoquis de Papa', nombre_receta: 'Receta Ñoquis de Papa', cantidad_planificada: 3, cantidad_real: null, numero_lote_proyectado: 'LOT-3', numero_lote_definitivo: null, fecha_vencimiento: null }],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 0.9 }] },

        { id_orden_produccion: 2, id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-05', hora_emision: '08:00', fecha_inicio: '2026-10-06', hora_inicio: '07:00', fecha_fin: '2026-10-06', hora_fin: '11:00',
          estado: 'En Proceso', observaciones: 'Producción para reponer stock de góndola.', stockDescontado: true,
          detalleProductos: [{ id_receta: 1, nombre_producto: 'Ravioles de Ricotta y Verdura', nombre_receta: 'Receta Ravioles de Ricotta', cantidad_planificada: 10, cantidad_real: null, numero_lote_proyectado: 'LOT-2', numero_lote_definitivo: null, fecha_vencimiento: null }],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 4 }, { clave_mp: 'ricotta', nombre: 'Ricotta Fresca', cantidad_planificada: 3 }] },

        { id_orden_produccion: 1, id_empleado: 'Laura Rodríguez',
          fecha_emision: '2026-10-04', hora_emision: '14:00', fecha_inicio: '2026-10-09', hora_inicio: '08:00', fecha_fin: '2026-10-09', hora_fin: '11:00',
          estado: 'En Proceso', observaciones: '', stockDescontado: true,
          detalleProductos: [{ id_receta: 3, nombre_producto: 'Ñoquis de Papa', nombre_receta: 'Receta Ñoquis de Papa', cantidad_planificada: 15, cantidad_real: null, numero_lote_proyectado: 'LOT-1', numero_lote_definitivo: null, fecha_vencimiento: null }],
          detalleMateriaPrima: [{ clave_mp: 'harina', nombre: 'Harina 0000', cantidad_planificada: 4.5 }] }
    ];

    // Órdenes de Mantenimiento: datos de prueba cubriendo los 5 estados del diagrama de estados del TP.
    const ordenesMantenimiento = [
        { id_orden_mantenimiento: 5, id_tipo_mantenimiento: 'Preventivo', id_empleado: 'Laura Rodríguez',
          fecha_emision: '2026-09-15', estado: 'Cancelada', observaciones: 'Se canceló por falta de disponibilidad de la línea.',
          detalle: [{ id_maquinaria: 1, nombre_maquinaria: 'Sobadora Industrial', fecha_inicio: '2026-09-15', hora_inicio: '08:00', fecha_fin: '', hora_fin: '', tareas_realizadas: 'Mantenimiento programado' }] },

        { id_orden_mantenimiento: 4, id_tipo_mantenimiento: 'Correctivo', id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-09-20', estado: 'Suspendida', observaciones: 'Se espera repuesto importado.',
          detalle: [{ id_maquinaria: 4, nombre_maquinaria: 'Cortadora de Ravioles', fecha_inicio: '2026-09-20', hora_inicio: '09:30', fecha_fin: '', hora_fin: '', tareas_realizadas: 'Cambio de cuchillas de corte' }] },

        { id_orden_mantenimiento: 3, id_tipo_mantenimiento: 'Preventivo', id_empleado: 'Laura Rodríguez',
          fecha_emision: '2026-10-05', estado: 'Pendiente', observaciones: '',
          detalle: [{ id_maquinaria: 2, nombre_maquinaria: 'Envasadora al Vacío', fecha_inicio: '2026-10-09', hora_inicio: '08:00', fecha_fin: '', hora_fin: '', tareas_realizadas: 'Revisión de sellado y bomba de vacío' }] },

        { id_orden_mantenimiento: 2, id_tipo_mantenimiento: 'Correctivo', id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-03', estado: 'En proceso', observaciones: 'La máquina quedó fuera de servicio hasta finalizar.',
          detalle: [{ id_maquinaria: 3, nombre_maquinaria: 'Amasadora Doble Brazo', fecha_inicio: '2026-10-03', hora_inicio: '09:00', fecha_fin: '', hora_fin: '', tareas_realizadas: 'Reemplazo de motor reductor' }] },

        { id_orden_mantenimiento: 1, id_tipo_mantenimiento: 'Preventivo', id_empleado: 'Carlos Gómez',
          fecha_emision: '2026-10-01', estado: 'Finalizada', observaciones: '',
          detalle: [{ id_maquinaria: 1, nombre_maquinaria: 'Sobadora Industrial', fecha_inicio: '2026-10-01', hora_inicio: '08:00', fecha_fin: '2026-10-01', hora_fin: '10:00', tareas_realizadas: 'Lubricación y ajuste de rodillos' }] }
    ];

    return {
        clientes, proveedores, empleados, maquinaria, productos, materiasPrimas, recetas, pedidos, comprobantesVenta, comprobantesPago,
        presupuestos, presupuestosProveedor, remitos,
        ordenesProduccion, ordenesMantenimiento, ordenesCompra,
        stockMateriaPrima: {
            harina: { nombre: 'Harina 0000', cantidad_actual: 89.4, unidad_medida: 'kg' },
            huevos: { nombre: 'Huevos Frescos', cantidad_actual: 79.8, unidad_medida: 'dzn' },
            ricotta: { nombre: 'Ricotta Fresca', cantidad_actual: 47, unidad_medida: 'kg' }
        },
        cajaDiaria: 0,
        contadores: {
            recibo: 1, ordenCompra: 106, lote: 10, pedido: 1053, empleado: 7, maquinaria: 5, ordenMant: 6, ordenProduccion: 8,
            comprobanteVenta: contadorComprobanteVenta, comprobantePago: contadorComprobantePago, presupuesto: 8, presupuestoProveedor: 7, remito: 3,
            producto: productos.length + 1, materiaPrima: materiasPrimas.length + 1
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
        datos.presupuestos = (datos.presupuestos || []).map(pr => {
            const { clienteDocumento, ...resto } = pr;
            resto.clienteObj = datos.clientes.find(c => c.numero_documento === clienteDocumento) || null;
            return resto;
        });
        // Las órdenes de compra y los presupuestos de proveedor guardan el documento del proveedor para
        // volver a enlazar la MISMA instancia tras recargar (mismo patrón que clienteDocumento).
        datos.ordenesCompra = (datos.ordenesCompra || []).map(oc => {
            const { proveedorDocumento, ...resto } = oc;
            resto.proveedorObj = datos.proveedores.find(p => p.numero_documento === proveedorDocumento) || null;
            return resto;
        });
        datos.presupuestosProveedor = (datos.presupuestosProveedor || []).map(pr => {
            const { proveedorDocumento, ...resto } = pr;
            resto.proveedorObj = datos.proveedores.find(p => p.numero_documento === proveedorDocumento) || null;
            return resto;
        });
        // Completa presupuestos ya guardados en la sesión que no tengan empleado asignado.
        datos.presupuestosProveedor.forEach((pr, indice) => {
            if (!pr.empleado) pr.empleado = datos.empleados[indice % datos.empleados.length]?.nombreMostrado || datos.empleados[indice % datos.empleados.length]?.nombre || '-';
            delete pr.tipo;
        });
        datos.remitos = (datos.remitos || []).map(r => {
            const { proveedorDocumento, ...resto } = r;
            resto.proveedorObj = datos.proveedores.find(p => p.numero_documento === proveedorDocumento) || null;
            return resto;
        });
        datos.maquinaria = datos.maquinaria || [];
        datos.productos = datos.productos && datos.productos.length ? datos.productos : crearDatosIniciales().productos;
        datos.materiasPrimas = datos.materiasPrimas && datos.materiasPrimas.length ? datos.materiasPrimas : crearDatosIniciales().materiasPrimas;
        datos.recetas = (datos.recetas || []).map(r => Object.setPrototypeOf(r, Receta.prototype));
        datos.ordenesProduccion = datos.ordenesProduccion || [];
        datos.ordenesMantenimiento = datos.ordenesMantenimiento || [];
        datos.cajaDiaria = datos.cajaDiaria || 0;
        datos.contadores = datos.contadores || crearDatosIniciales().contadores;
        datos.contadores.presupuesto = datos.contadores.presupuesto || 1;
        datos.contadores.presupuestoProveedor = datos.contadores.presupuestoProveedor || 1;
        datos.contadores.presupuestoProveedor = Math.max(datos.contadores.presupuestoProveedor, ...datos.presupuestosProveedor.map(pr => (Number(pr.id_presupuesto_proveedor) || 0) + 1));
        datos.contadores.remito = datos.contadores.remito || 1;
        datos.contadores.producto = datos.contadores.producto || (datos.productos.length + 1);
        datos.contadores.materiaPrima = datos.contadores.materiaPrima || (datos.materiasPrimas.length + 1);
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
let listaProductos = DATOS.productos;
let listaMateriasPrimas = DATOS.materiasPrimas;
let listaRecetas = DATOS.recetas;
let listaPedidos = DATOS.pedidos;
let listaPresupuestos = DATOS.presupuestos;
let listaComprobantesVenta = DATOS.comprobantesVenta;
let listaComprobantesPago = DATOS.comprobantesPago;
let listaOrdenesProduccion = DATOS.ordenesProduccion;
let listaOrdenesMantenimiento = DATOS.ordenesMantenimiento;
let listaOrdenesCompra = DATOS.ordenesCompra;
let listaPresupuestosProveedor = DATOS.presupuestosProveedor;
let listaRemitos = DATOS.remitos;
let stockMateriaPrima = DATOS.stockMateriaPrima;
let totalCajaAcumulado = DATOS.cajaDiaria;

let numReciboContador = DATOS.contadores.recibo;
let numOrdenCompraContador = DATOS.contadores.ordenCompra;
let numLoteContador = DATOS.contadores.lote;
let numPedidoContador = DATOS.contadores.pedido;
let numEmpleadoContador = DATOS.contadores.empleado;
let numMaquinariaContador = DATOS.contadores.maquinaria;
let numProductoContador = DATOS.contadores.producto;
let numMateriaPrimaContador = DATOS.contadores.materiaPrima;
let numOrdenMantContador = DATOS.contadores.ordenMant;
let numOrdenProduccionContador = DATOS.contadores.ordenProduccion;
let numComprobanteVentaContador = DATOS.contadores.comprobanteVenta;
let numComprobantePagoContador = DATOS.contadores.comprobantePago;
let numPresupuestoContador = DATOS.contadores.presupuesto;
let numPresupuestoProveedorContador = DATOS.contadores.presupuestoProveedor;
let numRemitoContador = DATOS.contadores.remito;

function guardarDatos() {
    const serializado = {
        clientes: listaClientes,
        proveedores: listaProveedores,
        empleados: listaEmpleados,
        maquinaria: listaMaquinaria,
        productos: listaProductos,
        materiasPrimas: listaMateriasPrimas,
        recetas: listaRecetas,
        ordenesProduccion: listaOrdenesProduccion,
        ordenesMantenimiento: listaOrdenesMantenimiento,
        stockMateriaPrima: stockMateriaPrima,
        cajaDiaria: totalCajaAcumulado,
        contadores: {
            recibo: numReciboContador, ordenCompra: numOrdenCompraContador, lote: numLoteContador,
            pedido: numPedidoContador, empleado: numEmpleadoContador, maquinaria: numMaquinariaContador,
            ordenMant: numOrdenMantContador, ordenProduccion: numOrdenProduccionContador,
            comprobanteVenta: numComprobanteVentaContador, comprobantePago: numComprobantePagoContador,
            presupuesto: numPresupuestoContador, presupuestoProveedor: numPresupuestoProveedorContador,
            remito: numRemitoContador, producto: numProductoContador, materiaPrima: numMateriaPrimaContador
        },
        ordenesCompra: listaOrdenesCompra.map(oc => {
            const { proveedorObj, ...resto } = oc;
            return { ...resto, proveedorDocumento: proveedorObj ? proveedorObj.numero_documento : null };
        }),
        presupuestosProveedor: listaPresupuestosProveedor.map(pr => {
            const { proveedorObj, ...resto } = pr;
            return { ...resto, proveedorDocumento: proveedorObj ? proveedorObj.numero_documento : null };
        }),
        remitos: listaRemitos.map(r => {
            const { proveedorObj, ...resto } = r;
            return { ...resto, proveedorDocumento: proveedorObj ? proveedorObj.numero_documento : null };
        }),
        pedidos: listaPedidos.map(p => {
            const { clienteObj, ...resto } = p;
            return { ...resto, clienteDocumento: clienteObj ? clienteObj.numero_documento : null };
        }),
        presupuestos: listaPresupuestos.map(pr => {
            const { clienteObj, ...resto } = pr;
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
    const prefijos = ['cli', 'prov', 'emp', 'mcli', 'mprov', 'pedEntrega'];
    prefijos.forEach(prefijo => {
        const selectProv = document.getElementById(`${prefijo}-provincia`);
        if (selectProv) {
            selectProv.innerHTML = '<option value="" disabled selected>Seleccioná una provincia</option>';
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

    selectLoc.innerHTML = '<option value="" disabled selected>Seleccioná una localidad</option>';
    selectCalle.innerHTML = '<option value="" disabled selected>Seleccioná una calle</option>';
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

    selectCalle.innerHTML = '<option value="" disabled selected>Seleccioná una calle</option>';

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

// El Código Postal depende directamente de la Calle elegida (no se tipea a mano): se autocompleta, de solo
// lectura, apenas se selecciona la calle. Usado en todos los formularios de alta/edición con domicilio.
function actualizarCodigoPostal(prefijo) {
    const campo = document.getElementById(`${prefijo}-cp`);
    if (!campo) return;
    const calle = obtenerCalleSeleccionada(prefijo);
    campo.value = calle ? calle.codigo_postal : '';
}

// Reconstruye la cascada Provincia -> Localidad -> Calle a partir de una calleObj guardada (usado al editar un registro existente).
function precargarUbicacionCascada(prefijo, calleObj) {
    if (!calleObj) return;
    const localidad = dbLocalidades.find(l => l.id_localidad === calleObj.id_localidad);
    if (!localidad) return;
    document.getElementById(`${prefijo}-provincia`).value = localidad.id_provincia;
    cargarLocalidadesCascada(prefijo);
    document.getElementById(`${prefijo}-localidad`).value = localidad.id_localidad;
    cargarCallesCascada(prefijo);
    document.getElementById(`${prefijo}-calle`).value = calleObj.id_calle;
    actualizarCodigoPostal(prefijo);
}

// ==========================================
// RENDERS COMPARTIDOS (alimentan tablas propias y selects de otras páginas)
// ==========================================
function renderizarClientesUI() {
    document.querySelectorAll('.select-cliente-dinamico').forEach(select => {
        select.innerHTML = '<option value="" disabled selected>Seleccioná un cliente</option>';
        listaClientes.forEach(cli => {
            const opt = document.createElement('option');
            opt.value = `${cli.nombreMostrado}|${cli.tipo_cliente}|${cli.nombreMostrado.toLowerCase().includes('hotel') ? 'hotel' : 'normal'}`;
            opt.innerText = `${cli.nombreMostrado} (${cli.tipo_cliente})`;
            select.appendChild(opt);
        });
        const optOtro = document.createElement('option');
        optOtro.value = 'OTRO';
        optOtro.innerText = '- Registrar o ingresar manualmente -';
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
