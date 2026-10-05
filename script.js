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
const auth = firebase.auth();

const NATUREZAS = {
  entrada: ["Salário", "Investimentos", "Freelance", "Presente", "Outros"],
  saida: ["Aluguel/Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"]
};

let currentUser = null;
let lancamentos = [];
let agenda = [];
let pieChart, lineChart;

// DOM - General
const authView = document.querySelector('#auth-view');
const mainApp = document.querySelector('#main-app');
const statusDot = document.querySelector('#status-dot');
const statusText = document.querySelector('#status-text');
const diagBanner = document.querySelector('#diag-banner');
const logContent = document.querySelector('#log-content');
const userEmailDisplay = document.querySelector('#user-email');

// DOM - Lançamentos
const formLancamento = document.querySelector('#form-lancamento');
const tipoSelect = document.querySelector('#tipo');
const categoriaSelect = document.querySelector('#categoria');
const filterCategoria = document.querySelector('#filter-categoria');
const filterDateStart = document.querySelector('#filter-date-start');
const filterDateEnd = document.querySelector('#filter-date-end');
const btnExport = document.querySelector('#btn-export');
const btnClear = document.querySelector('#btn-clear');
const btnForceSync = document.querySelector('#btn-force-sync');

// DOM - Agenda
const formAgenda = document.querySelector('#form-agenda');
const agendaTipoSelect = document.querySelector('#agenda-tipo');
const agendaCategoriaSelect = document.querySelector('#agenda-categoria');
const tabelaAgenda = document.querySelector('#tabela-agenda');

// DOM - Dashboard Summaries
const summaryLastLaunches = document.querySelector('#summary-last-launches');
const summaryNextAccounts = document.querySelector('#summary-next-accounts');

function log(msg) {
    if (!logContent) return;
    const div = document.createElement('div');
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContent.appendChild(div);
    logContent.scrollTop = logContent.scrollHeight;
    console.log(msg);
}

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================

window.onload = () => {
  log("Iniciando Sistema de Autenticação...");
  
  auth.onAuthStateChanged(user => {
    if (user) {
      log(`Usuário autenticado: ${user.email}`);
      currentUser = user;
      showMainApp();
    } else {
      log("Nenhum usuário logado.");
      currentUser = null;
      showAuthView();
    }
  });

  updateCategorias(tipoSelect, categoriaSelect);
  updateCategorias(agendaTipoSelect, agendaCategoriaSelect);
  populateFilterCategories();
};

function showAuthView() {
  authView.style.display = 'flex';
  mainApp.style.display = 'none';
}

function showMainApp() {
  authView.style.display = 'none';
  mainApp.style.display = 'block';
  userEmailDisplay.innerText = currentUser.email;
  
  initRealtimeListener();
  initAgendaListener();
  initCharts();
}

document.querySelector('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.querySelector('#login-email').value;
  const password = document.querySelector('#login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    log("Login realizado com sucesso!");
  } catch (e) {
    alert("Erro ao entrar: " + e.message);
    log("Erro de Login: " + e.message);
  }
});

document.querySelector('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.querySelector('#signup-email').value;
  const password = document.querySelector('#signup-password').value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    log("Conta criada com sucesso!");
  } catch (e) {
    alert("Erro ao cadastrar: " + e.message);
    log("Erro de Cadastro: " + e.message);
  }
});

document.querySelector('#btn-logout').addEventListener('click', () => {
  auth.signOut();
  log("Saindo do sistema...");
});

// ==========================================
// DATA LOGIC (WITH USER ISOLATION)
// ==========================================

function initRealtimeListener() {
  log("Sincronizando lançamentos do seu perfil...");
  db.collection('lancamentos')
    .where('userId', '==', currentUser.uid)
    .orderBy('data', 'desc')
    .onSnapshot((snapshot) => {
      statusDot.style.background = "#10b981";
      statusText.innerText = "Sincronizado";
      diagBanner.style.display = "none";
      log(`Seus lançamentos atualizados: ${snapshot.size} itens.`);
      lancamentos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderDashboard();
    }, (error) => {
      statusDot.style.background = "#ef4444";
      statusText.innerText = "Erro de Conexão";
      diagBanner.style.display = "block";
      log(`ERRO CRÍTICO: ${error.message}`);
    });
}

function initAgendaListener() {
  log("Sincronizando sua agenda...");
  db.collection('agenda')
    .where('userId', '==', currentUser.uid)
    .orderBy('data', 'asc')
    .onSnapshot((snapshot) => {
      log(`Sua agenda atualizada: ${snapshot.size} contas.`);
      agenda = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderAgenda();
      renderDashboardSummaries();
    });
}

async function adicionarAoEstado(lancamento) {
  try {
    log("Salvando lançamento no seu perfil...");
    await db.collection('lancamentos').add({
      ...lancamento,
      userId: currentUser.uid
    });
    log("Lançamento salvo!");
  } catch (e) {
    log(`Erro: ${e.message}`);
    alert("Erro ao salvar. Verifique as Regras do Firebase.");
  }
}

async function removerLancamento(id) {
  try {
    log(`Removendo item ${id}...`);
    await db.collection('lancamentos').doc(id).delete();
    log("Removido.");
  } catch (e) { log(`Erro: ${e.message}`); }
}

function updateCategorias(tipoEl, catEl) {
  const tipo = tipoEl.value;
  const options = NATUREZAS[tipo].map(cat => `<option value=\"${cat}\">${cat}</option>`).join('');
  catEl.innerHTML = options;
}

function populateFilterCategories() {
  const allCats = [...new Set(NATUREZAS.entrada.concat(NATUREZAS.saida))];
  filterCategoria.innerHTML = '<option value=\"all\">Todas</option>' + 
    allCats.map(cat => `<option value=\"${cat}\">${cat}</option>`).join('');
}

tipoSelect.addEventListener('change', () => updateCategorias(tipoSelect, categoriaSelect));
agendaTipoSelect.addEventListener('change', () => updateCategorias(agendaTipoSelect, agendaCategoriaSelect));

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
  updateCategorias(tipoSelect, categoriaSelect);
});

formAgenda.addEventListener('submit', async (e) => {
  e.preventDefault();
  const conta = {
    descricao: document.querySelector('#agenda-descricao').value.trim(),
    valor: parseFloat(document.querySelector('#agenda-valor').value),
    tipo: agendaTipoSelect.value,
    categoria: agendaCategoriaSelect.value,
    data: document.querySelector('#agenda-data').value,
    status: 'pendente',
    userId: currentUser.uid
  };
  try {
    log("Agendando conta no seu perfil...");
    await db.collection('agenda').add(conta);
    log("Conta agendada com sucesso!");
    formAgenda.reset();
    updateCategorias(agendaTipoSelect, agendaCategoriaSelect);
  } catch (e) {
    log(`Erro ao agendar: ${e.message}`);
  }
});

async function baixaAgenda(id) {
  try {
    log(`Dando baixa na conta ${id}...`);
    const doc = await db.collection('agenda').doc(id).get();
    if (!doc.exists) return;
    
    const dados = doc.data();
    await db.collection('lancamentos').add({
      descricao: `[BAIXA] ${dados.descricao}`,
      valor: dados.valor,
      tipo: dados.tipo,
      categoria: dados.categoria,
      data: new Date().toISOString().split('T')[0],
      userId: currentUser.uid
    });
    
    await db.collection('agenda').doc(id).delete();
    log("Conta liquidada e movida para lançamentos!");
  } catch (e) { log(`Erro na baixa: ${e.message}`); }
}

function renderDashboard() {
  const data = getFilteredData();
  const tbody = document.querySelector('#tabela-lancamentos');
  if(!tbody) return;
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
      <td class=\"${l.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida'}\">
        ${l.tipo === 'entrada' ? '+' : '-'} ${l.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
      </td>
      <td><button class=\"btn-deletar\" onclick=\"removerLancamento('${l.id}')\">Excluir</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelector('#total-entradas').innerText = entries.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saidas').innerText = exits.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.querySelector('#total-saldo').innerText = (entries - exits).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const topCat = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];
  document.querySelector('#top-category').innerText = topCat ? topCat[0] : '-';
  updateCharts(data);
  renderDashboardSummaries();
}

function renderAgenda() {
  const tbody = document.querySelector('#tabela-agenda');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  const hoje = new Date().toISOString().split('T')[0];

  agenda.forEach(a => {
    const isOverdue = a.data < hoje;
    const statusBadge = isOverdue 
        ? '<span style=\"color: #ef4444; font-weight: bold;\">Vencido</span>' 
        : '<span style=\"color: #f59e0b; font-weight: bold;\">Pendente</span>';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${a.data.split('-').reverse().join('/')}</td>
      <td>${a.descricao}</td>
      <td class=\"${a.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida'}\">
        ${a.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
      </td>
      <td>${statusBadge}</td>
      <td>
        <button class=\"btn-deletar\" style=\"background: #dcfce7; color: #166534; margin-right: 5px;\" onclick=\"baixaAgenda('${a.id}')\">Baixar</button>
        <button class=\"btn-deletar\" onclick=\"removerLancamentoAgenda('${a.id}')\">Excluir</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderDashboardSummaries() {
  if(!summaryLastLaunches || !summaryNextAccounts) return;

  summaryLastLaunches.innerHTML = '';
  const lastLaunches = [...lancamentos].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
  lastLaunches.forEach(l => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.data.split('-').reverse().join('/')}</td>
      <td>${l.descricao}</td>
      <td class=\"${l.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida'}\">${l.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
    `;
    summaryLastLaunches.appendChild(row);
  });

  summaryNextAccounts.innerHTML = '';
  const nextAccounts = [...agenda].sort((a,b) => new Date(a.data) - new Date(b.data)).slice(0, 5);
  nextAccounts.forEach(a => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${a.data.split('-').reverse().join('/')}</td>
      <td>${a.descricao}</td>
      <td class=\"${a.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida'}\">${a.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
    `;
    summaryNextAccounts.appendChild(row);
  });
}

window.removerLancamentoAgenda = async (id) => {
  try {
    await db.collection('agenda').doc(id).delete();
    log("Conta removida da agenda.");
  } catch (e) { log(`Erro: ${e.message}`); }
};

window.baixaAgenda = baixaAgenda;

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

function initCharts() {
  const pieCtx = document.getElementById('chart-pie')?.getContext('2d');
  if(!pieCtx) return;
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#64748b'] }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
  const lineCtx = document.getElementById('chart-line')?.getContext('2d');
  if(!lineCtx) return;
  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Saldo', data: [], borderColor: '#3b82f6', tension: 0.3, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }] },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function updateCharts(data) {
  if(!pieChart || !lineChart) return;
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
  let csv = 'Data,Descrição,Categoria,Tipo,Valor\\\\n';
  data.forEach(l => {
    csv += `${l.data},${l.descricao},${l.categoria},${l.tipo},${l.valor}\\\\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'relatorio_financeiro.csv');
  a.click();
};

btnClear.onclick = async () => {
  if(confirm('Tem certeza que deseja apagar TODOS os seus dados da nuvem?')) {
    const batch = db.batch();
    lancamentos.forEach(l => {
      batch.delete(db.collection('lancamentos').doc(l.id));
    });
    await batch.commit();
  }
};

btnForceSync.onclick = async () => {
    log("Sincronização forçada iniciada...");
    await migrateLocalDataToCloud();
    log("Processo finalizado.");
};

[filterCategoria, filterDateStart, filterDateEnd].forEach(el => el?.addEventListener('change', renderDashboard));
window.removerLancamento = removerLancamento;
