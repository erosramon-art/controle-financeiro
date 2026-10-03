
const firebaseConfig = {
  apiKey: "AIzaSyAQjfrjAThP69iKfX3iKn-czPNR_JHl2LQ",
  authDomain: "controle-financeiro-8955a.firebaseapp.com",
  projectId: "controle-financeiro-8955a",
  storageBucket: "controle-financeiro-8955a.firebasestorage.app",
  messagingSenderId: "1012107734869",
  appId: "1:1012107734869:web:573eb9871d4f56c08189dc"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const NATUREZAS = {
  entrada: ["Salário", "Investimentos", "Freelance", "Presente", "Outros"],
  saida: ["Aluguel/Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"]
};

let lancamentos = [];
let pieChart, lineChart;

const formLancamento = document.querySelector('#form-lancamento');
const tipoSelect = document.querySelector('#tipo');
const categoriaSelect = document.querySelector('#categoria');
const filterCategoria = document.querySelector('#filter-categoria');
const filterDateStart = document.querySelector('#filter-date-start');
const filterDateEnd = document.querySelector('#filter-date-end');
const btnExport = document.querySelector('#btn-export');
const btnClear = document.querySelector('#btn-clear');

window.onload = async () => {
  updateCategorias();
  populateFilterCategories();
  
  // 1. MIGRAÇÃO: Move dados do localStorage para o Firebase se existirem
  await migrateLocalDataToCloud();
  
  initRealtimeListener();
  initCharts();
};

async function migrateLocalDataToCloud() {
  const localData = localStorage.getItem('finance_data');
  if (localData) {
    try {
      const parsedData = JSON.parse(localData);
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        console.log("Migrando dados locais para a nuvem...");
        for (const item of parsedData) {
          // Só adiciona se não tiver ID de Firestore (para evitar duplicatas)
          // Note: Local ID era Date.now(), Firestore ID é alfanumérico
          if (typeof item.id === 'number') {
            await db.collection('lancamentos').add(item);
          }
        }
        // Limpa o local storage após migrar com sucesso
        localStorage.removeItem('finance_data');
        console.log("Migração concluída!");
      }
    } catch (e) {
      console.error("Erro na migração:", e);
    }
  }
}

function initRealtimeListener() {
  db.collection('lancamentos').orderBy('data', 'desc')
    .onSnapshot((snapshot) => {
      lancamentos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      renderDashboard();
    }, (error) => {
      console.error("Erro de permissão: ", error);
      alert("Atenção: Verifique se as Regras do Firestore estão em 'Modo Teste' no Console do Firebase.");
    });
}

async function adicionarAoEstado(lancamento) {
  try {
    await db.collection('lancamentos').add(lancamento);
  } catch (e) {
    alert("Erro ao salvar: Verifique as Regras do Firestore.");
  }
}

async function removerLancamento(id) {
  try {
    await db.collection('lancamentos').doc(id).delete();
  } catch (e) {
    console.error(e);
  }
}

function updateCategorias() {
  const tipo = tipoSelect.value;
  const options = NATUREZAS[tipo].map(cat => `<option value="${cat}">${cat}</option>`).join('');
  categoriaSelect.innerHTML = options;
}

function populateFilterCategories() {
  const allCats = [...new Set(NATUREZAS.entrada.concat(NATUREZAS.saida))];
  filterCategoria.innerHTML = '<option value="all">Todas</option>' + 
    allCats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

tipoSelect.addEventListener('change', updateCategorias);
updateCategorias();

formLancamento.addEventListener('submit', async (e) => {
  e.preventDefault();
  const novo = {
    descricao: document.querySelector('#descricao').value.trim(),
    valor: parseFloat(document.querySelector('#valor').value),
    tipo: tipoSelect.value,
    categoria: categoriaSelect.value,
    data: document.querySelector('#data').value
  };
  await adicionarAoEstado(novo);
  formLancamento.reset();
  updateCategorias();
});

function getFilteredData() {
  const cat = filterCategoria.value;
  const start = filterDateStart.value;
  const end = filterDateEnd.value;

  return lancamentos.filter(l => {
    const matchCat = cat === 'all' || l.categoria === cat;
    const matchStart = !start || l.data >= start;
    const matchEnd = !end || l.data <= end;
    return matchCat && matchStart && matchEnd;
  });
}

function renderDashboard() {
  const data = getFilteredData();
  const tbody = document.querySelector('#tabela-lancamentos');
  tbody.innerHTML = '';

  let entries = 0, exits = 0;
  const catTotals = {};

  data.forEach(l => {
    if (l.tipo === 'entrada') entries += l.valor;
    else {
      exits += l.valor;
      catTotals[l.categoria] = (catTotals[l.categoria] || 0) + l.valor;
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.data.split('-').reverse().join('/')}</td>
      <td>${l.descricao}</td>
      <td>${l.categoria}</td>
      <td class="${l.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida'}">
        ${l.tipo === 'entrada' ? '+' : '-'} ${l.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
      </td>
      <td><button class="btn-deletar" onclick="removerLancamento('${l.id}')">Excluir</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelector('#total-entradas').innerText = entries.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saidas').innerText = exits.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saldo').innerText = (entries - exits).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const topCat = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];
  document.querySelector('#top-category').innerText = topCat ? topCat[0] : '-';

  updateCharts(data);
}

function initCharts() {
  const pieCtx = document.getElementById('chart-pie').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#64748b'] }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  const lineCtx = document.getElementById('chart-line').getContext('2d');
  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Saldo', data: [], borderColor: '#3b82f6', tension: 0.3, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }] },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function updateCharts(data) {
  const exits = data.filter(l => l.tipo === 'saida');
  const catMap = {};
  exits.forEach(l => catMap[l.categoria] = (catMap[l.categoria] || 0) + l.valor);
  
  pieChart.data.labels = Object.keys(catMap);
  pieChart.data.datasets[0].data = Object.values(catMap);
  pieChart.update();

  const sortedData = [...data].sort((a,b) => new Date(a.data) - new Date(b.data));
  const dates = [];
  const balances = [];
  let currentBalance = 0;

  sortedData.forEach(l => {
    dates.push(l.data);
    currentBalance += (l.tipo === 'entrada' ? l.valor : -l.valor);
    balances.push(currentBalance);
  });

  lineChart.data.labels = dates;
  lineChart.data.datasets[0].data = balances;
  lineChart.update();
}

btnExport.onclick = () => {
  const data = getFilteredData();
  let csv = 'Data,Descrição,Categoria,Tipo,Valor\\n';
  data.forEach(l => {
    csv += `${l.data},${l.descricao},${l.categoria},${l.tipo},${l.valor}\\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'relatorio_financeiro.csv');
  a.click();
};

btnClear.onclick = async () => {
  if(confirm('Tem certeza que deseja apagar TODOS os dados da nuvem?')) {
    const batch = db.batch();
    lancamentos.forEach(l => {
      batch.delete(db.collection('lancamentos').doc(l.id));
    });
    await batch.commit();
  }
};

[filterCategoria, filterDateStart, filterDateEnd].forEach(el => el.addEventListener('change', renderDashboard));

window.removerLancamento = removerLancamento;
