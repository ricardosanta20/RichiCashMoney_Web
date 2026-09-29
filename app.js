/*
const SUPABASE_URL = 'https://iabxvgribcibjeesucjy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhYnh2Z3JpYmNpYmplZXN1Y2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDIyODUsImV4cCI6MjEwMjkxODI4NX0.SwdVLygYWNYgAid_spff5aiD3gtpSxI0F5dbwON0xt8';
const FERNET_KEY = 'U2clJXDbo1ORWQHz7gA6UJkx-xSvZ-UH2LYONd0TNsU=';
*/

// V9.2 - Gráfico exclusivo y trazado de evolución para BCP Ahorro
// ==========================================
// CONFIGURACIÓN DE CREDENCIALES
// ==========================================
const SUPABASE_URL = 'https://iabxvgribcibjeesucjy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhYnh2Z3JpYmNpYmplZXN1Y2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDIyODUsImV4cCI6MjEwMjkxODI4NX0.SwdVLygYWNYgAid_spff5aiD3gtpSxI0F5dbwON0xt8';
const FERNET_KEY = 'U2clJXDbo1ORWQHz7gA6UJkx-xSvZ-UH2LYONd0TNsU=';

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const secret = new fernet.Secret(FERNET_KEY);

let todasLasCuentas = [];
let todasLasTransacciones = [];
let graficoDonaInstancia = null;
let graficoLineaInstancia = null;
let graficoAhorroInstancia = null;
let cuentaActivaId = null;

// ==========================================
// DESENCRIPTACIÓN
// ==========================================
function desencriptar(textoEncriptado) {
    if (!textoEncriptado || textoEncriptado === "-") return "-";
    try {
        const token = new fernet.Token({ secret: secret, token: textoEncriptado, ttl: 0 });
        return token.decode();
    } catch (error) {
        console.error("Error al desencriptar:", error);
        return "Error";
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
async function inicializarDashboard() {
    configurarFiltroMes();
    await cargarCuentas();
    await recargarDatosYGraficos();
    limpiarCacheYServiceWorker();
}

function configurarFiltroMes() {
    const inputMes = document.getElementById('filtro-mes');
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    inputMes.value = mesActual;
    inputMes.addEventListener('change', () => recargarDatosYGraficos());
}

async function cargarCuentas() {
    const { data, error } = await clienteSupabase.from('cuentas').select('*').order('id', { ascending: true });
    if (error) {
        console.error("Error cargando cuentas:", error);
        return;
    }
    todasLasCuentas = data;
    renderizarCuentas();
}

function renderizarCuentas() {
    const contenedor = document.getElementById('contenedor-cuentas');
    contenedor.innerHTML = '';
    let liquidezReal = 0;

    todasLasCuentas.forEach(cuenta => {
        const saldo = parseFloat(cuenta.saldo);
        
        if (['BCP Débito', 'Efectivo', 'Tarjeta de alimentos'].includes(cuenta.nombre)) {
            liquidezReal += saldo;
        }

        if (cuenta.nombre === 'BCP Ahorro') {
            const badgeAhorro = document.getElementById('saldo-boveda-badge');
            if (badgeAhorro) badgeAhorro.textContent = `Bóveda: S/ ${saldo.toFixed(2)}`;
        }

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-teal-300 transition text-center";
        card.onclick = () => abrirHistorial(cuenta.id, cuenta.nombre);
        
        const colorSaldo = saldo < 0 ? 'text-red-500' : 'text-gray-800';
        
        card.innerHTML = `
            <p class="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">${cuenta.nombre}</p>
            <h3 class="text-xl font-extrabold ${colorSaldo}">S/ ${saldo.toFixed(2)}</h3>
        `;
        contenedor.appendChild(card);
    });

    document.getElementById('liquidez-total').textContent = `S/ ${liquidezReal.toFixed(2)}`;
}

async function recargarDatosYGraficos() {
    const mesSeleccionado = document.getElementById('filtro-mes').value; 
    const [año, mes] = mesSeleccionado.split('-');
    const fechaInicio = new Date(año, mes - 1, 1).toISOString();
    const fechaFin = new Date(año, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await clienteSupabase
        .from('transacciones')
        .select(`*, conceptos(nombre)`)
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error cargando transacciones:", error);
        return;
    }

    todasLasTransacciones = data.map(t => ({
        ...t,
        montoReal: parseFloat(desencriptar(t.monto)),
        notaReal: desencriptar(t.nota),
        nombreConcepto: t.conceptos ? t.conceptos.nombre : 'Sin Categoría'
    }));

    actualizarGraficosGenerales();
    await renderizarGraficoEvolucionAhorro();
    if (cuentaActivaId) abrirHistorial(cuentaActivaId, null, false);
}

// ==========================================
// HISTORIAL POR CUENTA
// ==========================================
function abrirHistorial(cuentaId, nombreCuenta, scroll = true) {
    cuentaActivaId = cuentaId;
    const seccion = document.getElementById('seccion-historial');
    const lista = document.getElementById('lista-transacciones');
    
    if (nombreCuenta) {
        document.getElementById('titulo-historial').textContent = `Historial: ${nombreCuenta}`;
    }
    
    const transaccionesFiltradas = todasLasTransacciones.filter(t => t.cuenta_afectada_id === cuentaId);

    lista.innerHTML = '';
    if (transaccionesFiltradas.length === 0) {
        lista.innerHTML = '<p class="text-gray-500 text-center py-4">No hay movimientos este mes.</p>';
    } else {
        transaccionesFiltradas.forEach(t => {
            const fecha = new Date(t.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const esGasto = t.tipo === 'gasto' || t.tipo === 'transferencia';
            const colorMonto = esGasto ? 'text-red-500' : 'text-green-600';
            const signo = esGasto ? '-' : '+';
            const notaHtml = (t.notaReal !== "-" && t.notaReal !== "Error") ? `<p class="text-sm text-gray-600 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">📝 ${t.notaReal}</p>` : `<p class="text-sm text-gray-400 mt-2 italic">Sin nota adicional.</p>`;

            const fila = document.createElement('div');
            fila.className = "border border-gray-200 rounded-xl overflow-hidden bg-white";
            fila.innerHTML = `
                <div class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition" onclick="toggleAcordeon(this)">
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-800">${t.nombreConcepto}</span>
                        <span class="text-xs text-gray-400">${fecha}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-extrabold ${colorMonto}">${signo}S/ ${t.montoReal.toFixed(2)}</span>
                        <svg class="flecha w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
                <div class="historial-nota bg-white px-4">
                    ${notaHtml}
                </div>
            `;
            lista.appendChild(fila);
        });
    }

    seccion.classList.remove('hidden');
    if (scroll) seccion.scrollIntoView({ behavior: 'smooth' });
}

window.toggleAcordeon = function(elementoHeader) {
    const flecha = elementoHeader.querySelector('.flecha');
    const contenido = elementoHeader.nextElementSibling;
    
    document.querySelectorAll('.historial-nota.abierto').forEach(el => {
        if (el !== contenido) {
            el.classList.remove('abierto');
            el.previousElementSibling.querySelector('.flecha').classList.remove('rotada');
        }
    });

    contenido.classList.toggle('abierto');
    flecha.classList.toggle('rotada');
};

document.getElementById('btn-cerrar-historial').addEventListener('click', () => {
    document.getElementById('seccion-historial').classList.add('hidden');
    cuentaActivaId = null;
});

// ==========================================
// GRÁFICOS GENERALES (DONA Y GASTO DIARIO)
// ==========================================
function actualizarGraficosGenerales() {
    const gastos = todasLasTransacciones.filter(t => t.tipo === 'gasto');

    const sumaPorCategoria = {};
    gastos.forEach(g => {
        sumaPorCategoria[g.nombreConcepto] = (sumaPorCategoria[g.nombreConcepto] || 0) + g.montoReal;
    });

    const labelsDona = Object.keys(sumaPorCategoria);
    const dataDona = Object.values(sumaPorCategoria);

    const sumaPorDia = {};
    gastos.forEach(g => {
        const dia = new Date(g.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
        sumaPorDia[dia] = (sumaPorDia[dia] || 0) + g.montoReal;
    });

    const labelsLinea = Object.keys(sumaPorDia).sort((a, b) => {
        const [d1, m1] = a.split('/');
        const [d2, m2] = b.split('/');
        return new Date(2026, m1 - 1, d1) - new Date(2026, m2 - 1, d2); 
    });
    const dataLinea = labelsLinea.map(dia => sumaPorDia[dia]);

    renderizarGraficoDona(labelsDona, dataDona);
    renderizarGraficoLinea(labelsLinea, dataLinea);
}

function renderizarGraficoDona(labels, data) {
    const ctx = document.getElementById('grafico-dona').getContext('2d');
    if (graficoDonaInstancia) graficoDonaInstancia.destroy();

    graficoDonaInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#1abc9c', '#3498db', '#9b59b6', '#e74c3c', '#f1c40f', '#34495e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } },
            cutout: '70%'
        }
    });
}

function renderizarGraficoLinea(labels, data) {
    const ctx = document.getElementById('grafico-linea').getContext('2d');
    if (graficoLineaInstancia) graficoLineaInstancia.destroy();

    graficoLineaInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto Diario (S/)',
                data: data,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#c0392b',
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// GRÁFICO EXCLUSIVO: BCP AHORRO (EVOLUCIÓN)
// ==========================================
async function renderizarGraficoEvolucionAhorro() {
    const canvas = document.getElementById('grafico-ahorro');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const cuentaAhorro = todasLasCuentas.find(c => c.nombre === 'BCP Ahorro');
    if (!cuentaAhorro) return;

    // Obtener todas las transacciones históricas de la bóveda para construir la curva completa
    const { data, error } = await clienteSupabase
        .from('transacciones')
        .select('*')
        .or(`cuenta_afectada_id.eq.${cuentaAhorro.id},medio_pago_id.eq.${cuentaAhorro.id}`)
        .order('created_at', { ascending: true });

    if (error || !data) {
        console.error("Error obteniendo transacciones de ahorro:", error);
        return;
    }

    const movimientosAhorro = data.map(t => ({
        ...t,
        montoReal: parseFloat(desencriptar(t.monto)),
        fecha: new Date(t.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    }));

    // Construcción del saldo acumulado cronológico
    let saldoAcumulado = 0;
    const labels = [];
    const datosSaldo = [];
    const coloresPuntos = [];

    movimientosAhorro.forEach((m, idx) => {
        const esRetiro = m.tipo === 'transferencia' || (m.tipo === 'gasto' && m.cuenta_afectada_id === cuentaAhorro.id);
        
        if (esRetiro) {
            saldoAcumulado -= m.montoReal;
            coloresPuntos.push('#ef4444'); // Punto rojo: caída / gasto imprevisto
        } else {
            saldoAcumulado += m.montoReal;
            coloresPuntos.push('#10b981'); // Punto verde: crecimiento del fondo
        }

        labels.push(m.fecha);
        datosSaldo.push(saldoAcumulado);
    });

    if (graficoAhorroInstancia) graficoAhorroInstancia.destroy();

    graficoAhorroInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['Inicio'],
            datasets: [{
                label: 'Fondo BCP Ahorro (S/)',
                data: datosSaldo.length ? datosSaldo : [parseFloat(cuentaAhorro.saldo)],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: coloresPuntos.length ? coloresPuntos : ['#10b981'],
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: '#f3f4f6' },
                    ticks: { callback: valor => `S/ ${valor}` }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Saldo Bóveda: S/ ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                },
                legend: { display: false }
            }
        }
    });
}

// ==========================================
// LIMPIEZA DE CACHÉ
// ==========================================
function limpiarCacheYServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let reg of registrations) reg.unregister();
        });
        caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
}

inicializarDashboard();