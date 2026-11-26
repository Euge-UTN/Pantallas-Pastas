// ==========================================
// TABLAS DEL SISTEMA (tablas paramétricas del diagrama de clases)
// Un mismo ABM genérico para todas: cada tabla se describe en TABLAS_SISTEMA (campos, cómo contar sus usos y,
// si los registros guardan el nombre en vez del id, cómo propagar un cambio de nombre).
// Se usa en tablas.html y también desde otras pantallas para el alta rápida ("+") de una fila
// (ej. Tipo y Subtipo de producto en Producción) - ver abrirAltaParametrica.
// ==========================================

const personasDelSistema = () => [...listaClientes, ...listaProveedores, ...listaEmpleados];
const contar = (lista, condicion) => lista.filter(condicion).length;

// Renombra un valor guardado como texto en los registros que lo usan.
function renombrarEnRegistros(listas, campo, viejo, nuevo) {
    listas.forEach(lista => lista.forEach(r => { if (r[campo] === viejo) r[campo] = nuevo; }));
}

const TABLAS_SISTEMA = [
    // ---------- Clientes, proveedores y empleados ----------
    {
        clave: 'tiposIva', slug: 'tipos-iva', grupo: 'Personas', titulo: 'Tipos de IVA', singular: 'Tipo de IVA', entidad: 'Tipo_Iva', icono: 'percent',
        filas: () => dbTiposIva, id: 'id_tipo_iva', nombre: f => f.nombre_tipo_iva,
        campos: [{ k: 'nombre_tipo_iva', label: 'Nombre', tipo: 'texto' }],
        protegidos: ['Responsable Inscripto', 'Monotributo', 'Exento', 'Consumidor Final'],
        usos: f => contar(personasDelSistema(), p => p.condicion_iva === f.nombre_tipo_iva),
        renombrar: (viejo, nuevo) => renombrarEnRegistros([listaClientes, listaProveedores, listaEmpleados], 'condicion_iva', viejo, nuevo)
    },
    {
        clave: 'tiposDocumento', slug: 'tipos-documento', grupo: 'Personas', titulo: 'Tipos de Documento', singular: 'Tipo de Documento', entidad: 'Tipo_Documento', icono: 'id-card',
        filas: () => dbTiposDocumento, id: 'id_tipo_documento', nombre: f => f.tipo,
        campos: [{ k: 'tipo', label: 'Tipo', tipo: 'texto' }],
        protegidos: ['DNI'],
        usos: f => contar(personasDelSistema(), p => p.tipo_documento === f.tipo),
        renombrar: (viejo, nuevo) => renombrarEnRegistros([listaClientes, listaProveedores, listaEmpleados], 'tipo_documento', viejo, nuevo)
    },
    {
        clave: 'tiposCliente', slug: 'tipos-cliente', grupo: 'Personas', titulo: 'Tipos de Cliente', singular: 'Tipo de Cliente', entidad: 'Tipo_Cliente', icono: 'users-round',
        filas: () => dbTiposCliente, id: 'id_tipo_cliente', nombre: f => f.tipo_cliente,
        campos: [{ k: 'tipo_cliente', label: 'Tipo de cliente', tipo: 'texto' }],
        protegidos: ['Mostrador', 'Mayorista'],
        usos: f => contar(listaClientes, c => c.tipo_cliente === f.tipo_cliente),
        renombrar: (viejo, nuevo) => renombrarEnRegistros([listaClientes], 'tipo_cliente', viejo, nuevo)
    },

    // ---------- Ventas y cobranzas ----------
    {
        clave: 'tiposPedido', slug: 'tipos-pedido', grupo: 'Ventas y Cobranzas', titulo: 'Tipos de Pedido', singular: 'Tipo de Pedido', entidad: 'Tipo_Pedido', icono: 'clipboard-list',
        filas: () => dbTiposPedido, id: 'id_tipo_pedido', nombre: f => f.tipo,
        campos: [{ k: 'tipo', label: 'Tipo', tipo: 'texto' }],
        protegidos: ['Normal', 'Evento', 'Donación', 'Web'],
        usos: f => contar(listaPedidos, p => tipoPedidoTexto(p) === f.tipo)
    },
    {
        clave: 'tiposPresupuesto', slug: 'tipos-presupuesto', grupo: 'Ventas y Cobranzas', titulo: 'Tipos de Presupuesto', singular: 'Tipo de Presupuesto', entidad: 'Tipo_Presupuesto', icono: 'file-text',
        filas: () => dbTiposPresupuesto, id: 'id_tipo_presupuesto', nombre: f => f.tipo,
        campos: [{ k: 'tipo', label: 'Tipo', tipo: 'texto' }],
        protegidos: ['Normal', 'Evento', 'Donación'],
        usos: f => contar(listaPresupuestos, p => tipoPedidoTexto(p) === f.tipo)
    },
    {
        clave: 'mediosPago', slug: 'medios-pago', grupo: 'Ventas y Cobranzas', titulo: 'Medios de Pago', singular: 'Medio de Pago', entidad: 'Medio_Pago', icono: 'wallet',
        filas: () => MEDIOS_PAGO, id: 'id', nombre: f => f.nombre,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto' }, { k: 'estado_activo', label: 'Activo', tipo: 'booleano' }],
        usos: f => contar(listaComprobantesPago, cp => cp.id_medio_pago === f.id)
    },
    {
        clave: 'tiposComprobanteVenta', slug: 'tipos-comprobante-venta', grupo: 'Ventas y Cobranzas', titulo: 'Tipos de Comprobante de Venta', singular: 'Tipo de Comprobante de Venta', entidad: 'Tipo_Comprobante_Venta', icono: 'file-stack',
        filas: () => TIPOS_COMPROBANTE_VENTA, id: 'id', nombre: f => f.nombre,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto' }, { k: 'letra', label: 'Letra', tipo: 'texto', max: 1 }, { k: 'codigoAfip', label: 'Código AFIP', tipo: 'texto', max: 3 }],
        // Factura A y B se eligen automáticamente según la condición de IVA del cliente (por id).
        protegidosId: [1, 2],
        usos: f => contar(listaComprobantesVenta, cv => cv.id_tipo_comprobante_venta === f.id)
    },

    // ---------- Producción y compras ----------
    {
        clave: 'tiposProducto', slug: 'tipos-producto', grupo: 'Producción y Compras', titulo: 'Tipos de Producto', singular: 'Tipo de Producto', entidad: 'Tipo_Producto', icono: 'package',
        filas: () => dbTiposProducto, id: 'id_tipo_producto', nombre: f => f.nombre_tipo_producto, Clase: TipoProducto,
        campos: [{ k: 'nombre_tipo_producto', label: 'Nombre', tipo: 'texto' }],
        usos: f => contar(dbSubtiposProducto, s => s.id_tipo_producto === f.id_tipo_producto),
        textoUsos: 'subtipos'
    },
    {
        clave: 'subtiposProducto', slug: 'subtipos-producto', grupo: 'Producción y Compras', titulo: 'Subtipos de Producto', singular: 'Subtipo de Producto', entidad: 'Subtipo_Producto', icono: 'boxes',
        filas: () => dbSubtiposProducto, id: 'id_subtipo_producto', nombre: f => f.nombre_subtipo_producto, Clase: SubtipoProducto,
        campos: [
            { k: 'id_tipo_producto', label: 'Tipo de producto', tipo: 'fk', opciones: () => dbTiposProducto.map(t => [t.id_tipo_producto, t.nombre_tipo_producto]), altaRapida: 'tiposProducto' },
            { k: 'nombre_subtipo_producto', label: 'Nombre', tipo: 'texto' }
        ],
        usos: f => contar(listaProductos, p => p.id_subtipo_producto === f.id_subtipo_producto),
        textoUsos: 'productos'
    },
    {
        clave: 'unidadesMedida', slug: 'unidades-medida', grupo: 'Producción y Compras', titulo: 'Unidades de Medida', singular: 'Unidad de Medida', entidad: 'Unidad_Medida', icono: 'ruler',
        filas: () => dbUnidadesMedida, id: 'id_unidad_medida', nombre: f => f.nombre,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto', ayuda: 'Con la abreviatura entre paréntesis, ej. Gramo (Gr)' }],
        usos: f => contar(listaProductos, p => p.id_unidad_medida === f.id_unidad_medida) + contar(listaMateriasPrimas, m => m.id_unidad_medida === f.id_unidad_medida)
            + listaRecetas.reduce((acc, r) => acc + (r.detalle || []).filter(d => d.id_unidad_medida === f.id_unidad_medida).length, 0)
    },
    {
        clave: 'tiposMateriaPrima', slug: 'tipos-materia-prima', grupo: 'Producción y Compras', titulo: 'Tipos de Materia Prima', singular: 'Tipo de Materia Prima', entidad: 'Tipo_Materia_Prima', icono: 'wheat',
        filas: () => dbTiposMateriaPrima, id: 'id_tipo_materia_prima', nombre: f => f.nombre,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto' }, { k: 'modalidad_compra', label: 'Modalidad de compra', tipo: 'lista', opciones: () => MODALIDADES_COMPRA.map(m => [m, m]) }],
        usos: f => contar(listaMateriasPrimas, m => m.id_tipo_materia_prima === f.id_tipo_materia_prima),
        textoUsos: 'materias primas'
    },
    {
        clave: 'marcas', slug: 'marcas', grupo: 'Producción y Compras', titulo: 'Marcas', singular: 'Marca', entidad: 'Marca', icono: 'tag',
        filas: () => dbMarcas, id: 'id_marca', nombre: f => f.nombre,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto' }],
        usos: f => contar(listaMaquinaria, m => m.id_marca === f.id_marca) + contar(listaMateriasPrimas, m => m.id_marca === f.id_marca)
    },

    // ---------- Mantenimiento ----------
    {
        clave: 'tiposMantenimiento', slug: 'tipos-mantenimiento', grupo: 'Mantenimiento', titulo: 'Tipos de Mantenimiento', singular: 'Tipo de Mantenimiento', entidad: 'Tipo_Mantenimiento', icono: 'wrench',
        filas: () => dbTiposMantenimiento, id: 'id_tipo_mantenimiento', nombre: f => f.nombre_tipo,
        campos: [{ k: 'nombre_tipo', label: 'Nombre', tipo: 'texto' }],
        protegidos: ['Preventivo', 'Correctivo'],
        usos: f => contar(listaOrdenesMantenimiento, o => o.id_tipo_mantenimiento === f.nombre_tipo),
        renombrar: (viejo, nuevo) => renombrarEnRegistros([listaOrdenesMantenimiento], 'id_tipo_mantenimiento', viejo, nuevo)
    },
    {
        clave: 'unidadesTiempo', slug: 'unidades-tiempo', grupo: 'Mantenimiento', titulo: 'Unidades de Tiempo', singular: 'Unidad de Tiempo', entidad: 'Unidad_Tiempo', icono: 'timer',
        filas: () => dbUnidadesTiempo, id: 'id_unidad_tiempo', nombre: f => f.nombre_unidad_tiempo,
        campos: [{ k: 'nombre_unidad_tiempo', label: 'Nombre', tipo: 'texto' }],
        usos: f => contar(listaMaquinaria, m => m.id_unidad_tiempo === f.nombre_unidad_tiempo),
        renombrar: (viejo, nuevo) => renombrarEnRegistros([listaMaquinaria], 'id_unidad_tiempo', viejo, nuevo)
    },

    // ---------- Ubicaciones ----------
    {
        clave: 'provincias', slug: 'provincias', grupo: 'Ubicaciones', titulo: 'Provincias', singular: 'Provincia', entidad: 'Provincia', icono: 'map',
        filas: () => dbProvincias, id: 'id_provincia', nombre: f => f.nombre, Clase: Provincia,
        campos: [{ k: 'nombre', label: 'Nombre', tipo: 'texto' }],
        usos: f => contar(dbLocalidades, l => l.id_provincia === f.id_provincia),
        textoUsos: 'localidades'
    },
    {
        clave: 'localidades', slug: 'localidades', grupo: 'Ubicaciones', titulo: 'Localidades', singular: 'Localidad', entidad: 'Localidad', icono: 'map-pin',
        filas: () => dbLocalidades, id: 'id_localidad', nombre: f => f.nombre, Clase: Localidad,
        campos: [
            { k: 'id_provincia', label: 'Provincia', tipo: 'fk', opciones: () => dbProvincias.map(p => [p.id_provincia, p.nombre]), altaRapida: 'provincias' },
            { k: 'nombre', label: 'Nombre', tipo: 'texto' }
        ],
        usos: f => contar(dbCalles, c => c.id_localidad === f.id_localidad),
        textoUsos: 'calles'
    },
    {
        clave: 'calles', slug: 'calles', grupo: 'Ubicaciones', titulo: 'Calles', singular: 'Calle', entidad: 'Calle', icono: 'signpost',
        filas: () => dbCalles, id: 'id_calle', nombre: f => f.nombre, Clase: Calle,
        campos: [
            { k: 'id_localidad', label: 'Localidad', tipo: 'fk', opciones: () => dbLocalidades.map(l => [l.id_localidad, `${l.nombre} (${(dbProvincias.find(p => p.id_provincia === l.id_provincia) || {}).nombre || '-'})`]), altaRapida: 'localidades' },
            { k: 'nombre', label: 'Nombre', tipo: 'texto' }
        ],
        usos: f => contar(dbCodigosPostales, cp => cp.id_calle === f.id_calle)
            + contar(personasDelSistema(), p => p.calleObj && p.calleObj.id_calle === f.id_calle)
            + contar(listaPedidos, p => p.calleEntregaObj && p.calleEntregaObj.id_calle === f.id_calle)
    },
    {
        clave: 'codigosPostales', slug: 'codigos-postales', grupo: 'Ubicaciones', titulo: 'Códigos Postales', singular: 'Código Postal', entidad: 'Código_Postal', icono: 'mail',
        filas: () => dbCodigosPostales, id: 'id_codigo_postal', nombre: f => f.codigo, Clase: CodigoPostal,
        campos: [
            { k: 'id_calle', label: 'Calle', tipo: 'fk', opciones: () => dbCalles.map(c => [c.id_calle, `${c.nombre} (${(dbLocalidades.find(l => l.id_localidad === c.id_localidad) || {}).nombre || '-'})`]), altaRapida: 'calles' },
            { k: 'codigo', label: 'Código', tipo: 'texto', max: 8 },
            { k: 'altura_desde', label: 'Altura desde', tipo: 'numero' },
            { k: 'altura_hasta', label: 'Altura hasta', tipo: 'numero' }
        ],
        validar: f => f.altura_desde > f.altura_hasta ? 'La altura "desde" no puede ser mayor que la altura "hasta".' : null,
        usos: () => 0
    }
];

function tablaSistema(clave) {
    return TABLAS_SISTEMA.find(t => t.clave === clave || t.slug === clave);
}

function filaProtegida(tabla, fila) {
    return (tabla.protegidos || []).includes(tabla.nombre(fila)) || (tabla.protegidosId || []).includes(fila[tabla.id]);
}

function valorCampoTexto(campo, fila) {
    const v = fila[campo.k];
    if (campo.tipo === 'fk') {
        const op = campo.opciones().find(([id]) => id === v);
        return op ? op[1] : '-';
    }
    if (campo.tipo === 'booleano') return v === false ? 'Inactivo' : 'Activo';
    return v === undefined || v === null || v === '' ? '-' : v;
}

// ==========================================
// Modal de alta / edición (compartido por tablas.html y por las altas rápidas de otras pantallas)
// ==========================================
let tablaEnFormulario = null;
let filaEnEdicion = null;
let alGuardarFilaParametrica = null;

function asegurarModalParametrico() {
    if (document.getElementById('modal-tabla-parametrica')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-tabla-parametrica" class="hidden fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4" onclick="if (event.target === this) cerrarModalParametrico()">
            <form id="form-tabla-parametrica" onsubmit="event.preventDefault(); guardarFilaParametrica()" class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h3 id="titulo-modal-parametrico" class="text-lg font-bold text-slate-900"></h3>
                        <p id="subtitulo-modal-parametrico" class="text-xs text-slate-400 font-mono"></p>
                    </div>
                    <button type="button" onclick="cerrarModalParametrico()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
                <div id="campos-modal-parametrico" class="px-6 py-5 space-y-4"></div>
                <div class="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <button type="button" onclick="cerrarModalParametrico()" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
                    <button type="submit" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i><span>Guardar</span></button>
                </div>
            </form>
        </div>`);
}

function inputCampoParametrico(campo, fila, protegida) {
    const base = 'w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500';
    const valor = fila ? fila[campo.k] : undefined;
    const id = `param-${campo.k}`;
    if (campo.tipo === 'booleano') {
        return `<label class="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" id="${id}" ${valor === false ? '' : 'checked'} class="w-4 h-4 accent-red-600"> ${campo.label}</label>`;
    }
    let control;
    if (campo.tipo === 'fk' || campo.tipo === 'lista') {
        const opciones = campo.opciones();
        control = `<div class="flex gap-2">
            <select id="${id}" required class="${base}">
                <option value="" disabled ${valor === undefined ? 'selected' : ''}>Elegí una opción</option>
                ${opciones.map(([v, t]) => `<option value="${v}" ${v === valor ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            ${campo.altaRapida ? `<button type="button" onclick="altaRapidaDesdeCampo('${campo.altaRapida}', '${id}')" title="Agregar ${tablaSistema(campo.altaRapida).singular.toLowerCase()}" class="shrink-0 w-10 border border-slate-300 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center"><i data-lucide="plus" class="w-4 h-4"></i></button>` : ''}
        </div>`;
    } else {
        const tipoInput = campo.tipo === 'numero' ? 'number' : 'text';
        control = `<input id="${id}" type="${tipoInput}" required ${campo.max ? `maxlength="${campo.max}"` : ''} ${campo.tipo === 'numero' ? 'min="0" step="1"' : ''}
            value="${valor ?? ''}" ${protegida && campo === tablaEnFormulario.campos.find(c => c.tipo === 'texto') ? 'disabled' : ''} class="${base} disabled:bg-slate-100 disabled:text-slate-500">`;
    }
    return `<div>
        <label class="block text-sm font-medium text-slate-700 mb-1">${campo.label}</label>
        ${control}
        ${campo.ayuda ? `<p class="text-xs text-slate-400 mt-1">${campo.ayuda}</p>` : ''}
    </div>`;
}

// Abre el formulario de alta de una tabla. `alGuardar(fila)` se llama con la fila creada (altas rápidas).
function abrirAltaParametrica(clave, alGuardar) {
    abrirFormularioParametrico(tablaSistema(clave), null, alGuardar);
}

function abrirFormularioParametrico(tabla, fila, alGuardar) {
    asegurarModalParametrico();
    tablaEnFormulario = tabla;
    filaEnEdicion = fila;
    alGuardarFilaParametrica = alGuardar || null;
    const protegida = fila && filaProtegida(tabla, fila);
    document.getElementById('titulo-modal-parametrico').textContent = `${fila ? 'Editar' : 'Agregar'} ${tabla.singular}`;
    document.getElementById('subtitulo-modal-parametrico').textContent = fila ? `${tabla.entidad} · ${tabla.id} = ${fila[tabla.id]}` : tabla.entidad;
    document.getElementById('campos-modal-parametrico').innerHTML =
        tabla.campos.map(c => inputCampoParametrico(c, fila, protegida)).join('') +
        (protegida ? `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2"><i data-lucide="lock" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i>El nombre de esta fila lo usa la lógica del sistema, por eso no se puede cambiar.</p>` : '');
    document.getElementById('modal-tabla-parametrica').classList.remove('hidden');
    lucide.createIcons();
    const primero = document.querySelector('#campos-modal-parametrico input:not([disabled]):not([type=checkbox]), #campos-modal-parametrico select');
    if (primero) primero.focus();
}

function cerrarModalParametrico() {
    document.getElementById('modal-tabla-parametrica').classList.add('hidden');
    pilaAltasRapidas.length = 0;
}

function leerCampoParametrico(campo) {
    const el = document.getElementById(`param-${campo.k}`);
    if (campo.tipo === 'booleano') return el.checked;
    if (campo.tipo === 'fk' || campo.tipo === 'numero') return el.value === '' ? NaN : Number(el.value);
    return el.value.trim();
}

function guardarFilaParametrica() {
    const tabla = tablaEnFormulario;
    const valores = {};
    for (const campo of tabla.campos) {
        const v = leerCampoParametrico(campo);
        if (campo.tipo !== 'booleano' && (v === '' || (typeof v === 'number' && isNaN(v)))) return alert(`Completá el campo "${campo.label}".`);
        valores[campo.k] = v;
    }
    const error = tabla.validar && tabla.validar(valores);
    if (error) return alert(error);

    // No se permiten dos filas con el mismo nombre (dentro del mismo tipo / localidad / calle cuando hay clave foránea).
    const campoFk = tabla.campos.find(c => c.tipo === 'fk');
    const nombreNuevo = tabla.nombre({ ...filaEnEdicion, ...valores });
    const duplicada = tabla.filas().find(f => f !== filaEnEdicion && normalizarTexto(String(tabla.nombre(f))) === normalizarTexto(String(nombreNuevo))
        && (!campoFk || f[campoFk.k] === valores[campoFk.k])
        && (tabla.clave !== 'codigosPostales' || (f.altura_desde <= valores.altura_hasta && valores.altura_desde <= f.altura_hasta)));
    if (duplicada) return alert(tabla.clave === 'codigosPostales' ? 'Esa calle ya tiene un código postal para ese rango de alturas.' : `Ya existe ${tabla.singular.toLowerCase()} "${nombreNuevo}".`);

    let fila = filaEnEdicion;
    if (fila) {
        const nombreViejo = tabla.nombre(fila);
        Object.assign(fila, valores);
        if (tabla.renombrar && nombreViejo !== tabla.nombre(fila)) tabla.renombrar(nombreViejo, tabla.nombre(fila));
    } else {
        const nuevoId = Math.max(0, ...tabla.filas().map(f => Number(f[tabla.id]) || 0)) + 1;
        fila = { [tabla.id]: nuevoId, ...valores };
        if (tabla.Clase) fila = Object.setPrototypeOf(fila, tabla.Clase.prototype);
        tabla.filas().push(fila);
    }
    guardarDatos();
    poblarSelectsParametricos();

    const callback = alGuardarFilaParametrica;
    const anterior = pilaAltasRapidas.pop();
    if (anterior) {
        // Volvemos al formulario desde el que se pidió el alta rápida, con la nueva fila ya elegida.
        abrirFormularioParametrico(anterior.tabla, anterior.fila, anterior.alGuardar);
        Object.entries(anterior.valores).forEach(([k, v]) => { const el = document.getElementById(`param-${k}`); if (el) el.type === 'checkbox' ? el.checked = v : el.value = v; });
        const select = document.getElementById(anterior.selectId);
        if (select) select.value = fila[tabla.id];
    } else {
        document.getElementById('modal-tabla-parametrica').classList.add('hidden');
    }
    if (typeof renderizarTablaSistema === 'function') renderizarTablaSistema();
    if (callback) callback(fila);
}

// "+" al lado de un campo con clave foránea dentro del propio modal (ej. Subtipo -> agregar Tipo de producto):
// se guarda lo que se venía cargando, se da de alta la fila referenciada y se vuelve con ella elegida.
const pilaAltasRapidas = [];
function altaRapidaDesdeCampo(claveReferenciada, selectId) {
    const valores = {};
    tablaEnFormulario.campos.forEach(c => {
        const el = document.getElementById(`param-${c.k}`);
        if (el) valores[c.k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    pilaAltasRapidas.push({ tabla: tablaEnFormulario, fila: filaEnEdicion, alGuardar: alGuardarFilaParametrica, valores, selectId });
    abrirFormularioParametrico(tablaSistema(claveReferenciada), null, null);
}

function eliminarFilaParametrica(clave, id) {
    const tabla = tablaSistema(clave);
    const filas = tabla.filas();
    const fila = filas.find(f => f[tabla.id] === id);
    if (!fila) return;
    if (filaProtegida(tabla, fila)) return alert('Esta fila la usa la lógica del sistema y no se puede eliminar.');
    const usos = tabla.usos(fila);
    if (usos) return alert(`No se puede eliminar "${tabla.nombre(fila)}": está en uso en ${usos} registro${usos === 1 ? '' : 's'}.`);
    if (!confirm(`¿Eliminar ${tabla.singular.toLowerCase()} "${tabla.nombre(fila)}"?`)) return;
    filas.splice(filas.indexOf(fila), 1);
    guardarDatos();
    renderizarTablaSistema();
}

// ==========================================
// Pantalla tablas.html
// ==========================================
let tablaSistemaActual = TABLAS_SISTEMA[0];

function renderizarMenuTablasSistema() {
    const menu = document.getElementById('menu-tablas-sistema');
    if (!menu) return;
    const grupos = [...new Set(TABLAS_SISTEMA.map(t => t.grupo))];
    menu.innerHTML = grupos.map(g => `
        <div>
            <p class="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">${g}</p>
            ${TABLAS_SISTEMA.filter(t => t.grupo === g).map(t => `
                <button type="button" onclick="elegirTablaSistema('${t.clave}')" class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${t === tablaSistemaActual ? 'bg-red-50 text-red-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'}">
                    <span class="flex items-center gap-2 min-w-0"><i data-lucide="${t.icono}" class="w-4 h-4 shrink-0"></i><span class="truncate">${t.titulo}</span></span>
                    <span class="text-xs ${t === tablaSistemaActual ? 'text-red-500' : 'text-slate-400'}">${t.filas().length}</span>
                </button>`).join('')}
        </div>`).join('');
}

function elegirTablaSistema(clave) {
    tablaSistemaActual = tablaSistema(clave);
    delete estadoPaginacion['tabla-sistema'];
    const buscador = document.getElementById('buscar-tabla-sistema');
    if (buscador) buscador.value = '';
    renderizarTablaSistema();
}

function renderizarTablaSistema() {
    const tbody = document.getElementById('tabla-sistema');
    if (!tbody) return;
    const tabla = tablaSistemaActual;
    renderizarMenuTablasSistema();
    document.getElementById('titulo-tabla-sistema').textContent = tabla.titulo;
    document.getElementById('entidad-tabla-sistema').textContent = tabla.entidad;
    document.getElementById('texto-boton-agregar-tabla').textContent = 'Agregar';
    document.getElementById('texto-boton-agregar-tabla').parentElement.title = `Agregar ${tabla.singular.toLowerCase()}`;
    document.getElementById('encabezado-tabla-sistema').innerHTML = `
        <th class="px-6 py-3" title="${tabla.id}">ID</th>
        ${tabla.campos.map(c => `<th class="px-6 py-3">${c.label}</th>`).join('')}
        <th class="px-6 py-3">En uso</th>
        <th class="px-6 py-3 text-right">Acciones</th>`;

    const texto = normalizarTexto(document.getElementById('buscar-tabla-sistema').value || '');
    const filas = tabla.filas().filter(f => !texto || tabla.campos.some(c => normalizarTexto(String(valorCampoTexto(c, f))).includes(texto)));
    const columnas = tabla.campos.length + 3;
    tbody.innerHTML = filas.length ? filas.map(f => {
        const protegida = filaProtegida(tabla, f);
        const usos = tabla.usos(f);
        const bloqueoEliminar = protegida ? 'La usa la lógica del sistema' : (usos ? 'Está en uso: no se puede eliminar' : '');
        return `<tr class="hover:bg-slate-50">
            <td class="px-6 py-3 font-mono text-xs text-slate-500">${f[tabla.id]}</td>
            ${tabla.campos.map((c, i) => {
                const v = valorCampoTexto(c, f);
                if (c.tipo === 'booleano') return `<td class="px-6 py-3"><span class="text-xs px-2.5 py-0.5 rounded-full ${f[c.k] === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}">${v}</span></td>`;
                return `<td class="px-6 py-3 ${i === tabla.campos.length - 1 || c.tipo === 'texto' ? 'font-medium text-slate-800' : 'text-slate-600'}">${v}${protegida && c === tabla.campos.find(x => x.tipo === 'texto') ? ' <i data-lucide="lock" class="inline w-3 h-3 text-slate-400" title="La usa la lógica del sistema"></i>' : ''}</td>`;
            }).join('')}
            <td class="px-6 py-3 text-slate-500">${usos ? `${usos} ${tabla.textoUsos || (usos === 1 ? 'registro' : 'registros')}` : '-'}</td>
            <td class="px-6 py-3">
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="editarFilaTablaSistema(${JSON.stringify(f[tabla.id])})" class="text-orange-600 hover:text-orange-800 text-xs font-semibold flex items-center gap-1"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>
                    <button type="button" ${bloqueoEliminar ? `disabled title="${bloqueoEliminar}"` : ''} onclick="eliminarFilaParametrica('${tabla.clave}', ${JSON.stringify(f[tabla.id])})" class="text-red-600 hover:text-red-800 disabled:text-slate-300 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Eliminar</button>
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="${columnas}" class="px-6 py-10 text-center text-slate-400">No hay filas${texto ? ' que coincidan con la búsqueda' : ''}.</td></tr>`;
    lucide.createIcons();
}

function editarFilaTablaSistema(id) {
    const tabla = tablaSistemaActual;
    abrirFormularioParametrico(tabla, tabla.filas().find(f => f[tabla.id] === id));
}

function initPaginaTablas() {
    const slug = (window.location.hash || '').replace('#', '');
    const pedida = TABLAS_SISTEMA.find(t => t.slug === slug);
    if (pedida) tablaSistemaActual = pedida;
    // El submenú resalta "Tablas paramétricas" (#parametricas); la tabla pedida por link ya quedó elegida.
    history.replaceState(null, '', '#parametricas');
    actualizarSubnavActivo();
    renderizarTablaSistema();
}
