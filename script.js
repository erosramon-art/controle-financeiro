// ============================================================
// ECOA FINANCEIRO — SCRIPT.JS (FIREBASE CLOUD VERSION)
// ============================================================

const NATUREZAS = {
  entrada: ["Salário", "Investimentos", "Freelance", "Presente", "Outros"],
  saida: ["Aluguel/Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"]
};

// Configurações do Firebase (Sincronizado com auth.js)
const firebaseConfig = {
  apiKey: "AIzaSyCydCOks5WvLKO8P58lZ75izFcXApa30xM",
  authDomain: "ecoa2-5196f.firebaseapp.com",
  projectId: "ecoa2-5196f",
  storageBucket: "ecoa2-5196f.firebasestorage.app",
  messagingSenderId: "324378435787",
  appId: "1:324378435787:web:595f2bc24bfe52ec713b4e"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let lancamentos = [];
let pieChart, lineChart;

// Elements
const formLancamento = document.querySelector('#form-lancamento');
const tipoSelect = document.querySelector('#tipo');
const categoriaSelect = document.querySelector('#categoria');
const btnExport = document.querySelector('#btn-export');
const btnClear = document.querySelector('#btn-clear');
const btnLogout = document.querySelector('#btn-logout');

// Init
window.onload = async () => {
  updateCategorias();
  await loadDataFromFirebase();
  renderDashboard();
  initCharts();
};

// --- Auth Logic ---

btnLogout.onclick = () => {
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  });
};

// --- Firebase Logic ---

async function loadDataFromFirebase() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snapshot = await db.collection('users').doc(user.uid).collection('finance_data').orderBy('data', 'desc').get();
    lancamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Dados carregados do Firebase");
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
  }
}

async function saveDataToFirebase(item) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection('users').doc(user.uid).collection('finance_data').add(item);
    await loadDataFromFirebase();
    renderDashboard();
  } catch (e) {
    console.error("Erro ao salvar no Firebase:", e);
  }
}

async function deleteFromFirebase(id) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection('users').doc(user.uid).collection('finance_data').doc(id).delete();
    await loadDataFromFirebase();
    renderDashboard();
  } catch (e) {
    console.error("Erro ao deletar no Firebase:", e);
  }
}

async function clearAllFirebase() {
  const user = auth.currentUser;
  if (!user) return;

  if(!confirm('Tem certeza que deseja apagar TODOS os dados da nuvem?')) return;

  try {
    const snapshot = await db.collection('users').doc(user.uid).collection('finance_data').get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    
    lancamentos = [];
    renderDashboard();
  } catch (e) {
    console.error("Erro ao limpar dados:", e);
  }
}

// --- UI Logic ---

function updateCategorias() {
  const tipo = tipoSelect.value;
  const options = NATUREZAS[tipo].map(cat => `<option value=\"${cat}\">${cat}</option>`).join('');
  categoriaSelect.innerHTML = options;
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
    data: document.querySelector('#data').value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await saveDataToFirebase(novo);
  formLancamento.reset();
  updateCategorias();
});

function renderDashboard() {
  const tbody = document.querySelector('#tabela-lancamentos');
  tbody.innerHTML = '';

  let entries = 0, exits = 0;
  const catTotals = {};

  lancamentos.forEach(l => {
    if (l.tipo === 'entrada') entries += l.valor;
    else {
      exits += l.valor;
      catTotals[l.categoria] = (catTotals[l.categoria] || 0) + l.valor;
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class=\"py-3\">${l.data.split('-').reverse().join('/')}</td>
      <td class=\"py-3\">${l.descricao}</td>
      <td class=\"py-3\">${l.categoria}</td>
      <td class=\"py-3 ${l.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'} font-bold">
        ${l.tipo === 'entrada' ? '+' : '-'} ${l.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
      </td>
      <td class=\"py-3\"><button class=\"text-red-500 hover:text-red-700 transition-all\" onclick=\"removerLancamento('${l.id}')\">Excluir</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelector('#total-entradas').innerText = entries.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saidas').innerText = exits.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saldo').innerText = (entries - exits).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const topCat = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];
  // Nota: Elemento #top-category foi removido do novo HTML, removendo a referência.

  updateCharts();
}

window.removerLancamento = (id) => deleteFromFirebase(id);
btnClear.onclick = clearAllFirebase;

// --- Charts ---

function initCharts() {
  const pieCtx = document.getElementById('chart-pie').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#64748b'] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { color: 'white' } } } }
  });

  const lineCtx = document.getElementById('chart-line').getContext('2d');
  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Saldo', data: [], borderColor: '#3b82f6', tension: 0.3, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }] },
    options: { 
        scales: { 
            y: { beginAtZero: true, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { labels: { color: 'white' } } }
    }
  });
}

function updateCharts() {
  const exits = lancamentos.filter(l => l.tipo === 'saida');
  const catMap = {};
  exits.forEach(l => catMap[l.categoria] = (catMap[l.categoria] || 0) + l.valor);
  
  pieChart.data.labels = Object.keys(catMap);
  pieChart.data.datasets[0].data = Object.values(catMap);
  pieChart.update();

  const sortedData = [...lancamentos].sort((a,b) => new Date(a.data) - new Date(b.data));
  const dates = [];
  const balances = [];
  let currentBalance = 0;

  sortedData.forEach(l => {
    dates.push(l.data.split('-').reverse().join('/'));
    currentBalance += (l.tipo === 'entrada' ? l.valor : -l.valor);
    balances.push(currentBalance);
  });

  lineChart.data.labels = dates;
  lineChart.data.datasets[0].data = balances;
  lineChart.update();
}

btnExport.onclick = () => {
  let csv = 'Data,Descrição,Categoria,Tipo,Valor\\n';
  lancamentos.forEach(l => {
    csv += `${l.data},${l.descricao},${l.categoria},${l.tipo},${l.valor}\\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'relatorio_financeiro.csv');
  a.click();
};
