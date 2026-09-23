/*
const SUPABASE_URL = 'https://iabxvgribcibjeesucjy.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhYnh2Z3JpYmNpYmplZXN1Y2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDIyODUsImV4cCI6MjEwMjkxODI4NX0.SwdVLygYWNYgAid_spff5aiD3gtpSxI0F5dbwON0xt8';
*/

// V1.3
const SUPABASE_URL = 'https://iabxvgribcibjeesucjy.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhYnh2Z3JpYmNpYmplZXN1Y2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDIyODUsImV4cCI6MjEwMjkxODI4NX0.SwdVLygYWNYgAid_spff5aiD3gtpSxI0F5dbwON0xt8';

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let graficoActual = null; 

async function cargarDashboard() {
    try {
        // 1. Cargar y mostrar los saldos de las cuentas
        const { data: cuentas, error: errorCuentas } = await clienteSupabase.from('cuentas').select('nombre, saldo');
        if (errorCuentas) throw errorCuentas;

        const grid = document.getElementById('grid-cuentas');
        const elementoTotal = document.getElementById('saldo-total');
        grid.innerHTML = ''; 
        let sumaTotal = 0;

        cuentas.forEach(cuenta => {
            const saldoNum = parseFloat(cuenta.saldo);
            sumaTotal += saldoNum;
            
            const card = document.createElement('div');
            card.className = 'card';
            const claseMonto = saldoNum < 0 ? 'card-monto negativo' : 'card-monto';

            card.innerHTML = `
                <div class="card-title">${cuenta.nombre}</div>
                <div class="${claseMonto}">S/ ${saldoNum.toFixed(2)}</div>
            `;
            grid.appendChild(card);
        });

        elementoTotal.textContent = `S/ ${sumaTotal.toFixed(2)}`;

        // 2. Cargar transacciones de tipo 'gasto' con el nombre de su categoría
        const { data: transacciones, error: errorTrans } = await clienteSupabase
            .from('transacciones')
            .select('monto, conceptos(nombre)')
            .eq('tipo', 'gasto');

        if (errorTrans) throw errorTrans;

        // 3. Procesar y agrupar la información para el gráfico
        const gastosPorCategoria = {};
        
        transacciones.forEach(t => {
            const categoria = t.conceptos ? t.conceptos.nombre : 'Otros';
            const monto = parseFloat(t.monto);
            
            if (gastosPorCategoria[categoria]) {
                gastosPorCategoria[categoria] += monto;
            } else {
                gastosPorCategoria[categoria] = monto;
            }
        });

        renderizarGrafico(gastosPorCategoria);

    } catch (error) {
        console.error('Error al conectar con Supabase:', error);
        document.getElementById('grid-cuentas').innerHTML = '<p>Error al cargar los datos</p>';
    }
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('graficoGastos').getContext('2d');
    
    if (graficoActual) {
        graficoActual.destroy();
    }

    const etiquetas = Object.keys(datos);
    const valores = Object.values(datos);

    // Si no hay datos, mostrar un gráfico vacío representativo
    if (etiquetas.length === 0) {
        etiquetas.push('Sin gastos');
        valores.push(1);
    }

    graficoActual = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

cargarDashboard();
// V1.4 (Fragmento para añadir al final de app.js)

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito.', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker.', err));
    });
}