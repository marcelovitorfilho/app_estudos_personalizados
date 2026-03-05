let agendaRevisoes = [];
let materiasConcluidas = {};
let historicoRevisoesInteligentes = {};
let materias = {};
let revisoesGeradasPorMateria = {};
const QUESTOES_POR_REVISAO = 20;
let revisoesInteligentes = {};
let historicoExpandido = false;
let filtroMateriaHistorico = "todas";
let metasPorMateria = {};
let historicoMetas = {};
let progressoSemanal = {};
let semanaUltimaVista = null;
let streakDias = 0;
let ultimoDiaEstudo = null;
let pomoSessoes = [];

function mostrarPainel(nome, tabEl) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + nome);
  if (panel) panel.classList.add('active');
  if (tabEl) {
    tabEl.classList.add('active');
  } else {
    document.querySelectorAll('.tab').forEach(t => {
      if (t.getAttribute('onclick')?.includes(`'${nome}'`)) t.classList.add('active');
    });
  }
  if (nome === 'dashboard') atualizarDashboard();
  if (nome === 'pomodoro') atualizarPomoMaterias();
}

function toast(msg, tipo = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icons[tipo] || 'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3300);
}

function atualizarStreak() {
  const hoje = new Date().toDateString();
  if (!ultimoDiaEstudo) {
    ultimoDiaEstudo = hoje; streakDias = 1;
  } else {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (ultimoDiaEstudo === hoje) {
        } else if (ultimoDiaEstudo === ontem.toDateString()) {
      streakDias++;
      ultimoDiaEstudo = hoje;
    } else {
      streakDias = 1;
      ultimoDiaEstudo = hoje;
    }
  }
  document.getElementById('streakCount').textContent = streakDias;
  salvarDados();
}

function atualizarStatsSummary() {
  let totalAcertos = 0, totalErros = 0;
  for (let n in materias) {
    totalAcertos += materias[n].totalAcertos || 0;
    totalErros   += materias[n].totalErros   || 0;
  }
  const total = totalAcertos + totalErros;
  const media = total > 0 ? ((totalAcertos / total) * 100).toFixed(1) + '%' : '—';
  document.getElementById('statMaterias').textContent = Object.keys(materias).length;
  document.getElementById('statAcertos').textContent  = totalAcertos;
  document.getElementById('statErros').textContent    = totalErros;
  document.getElementById('statMedia').textContent    = media;
}

function atualizarDatalist() {
  const dl = document.getElementById('materiasList');
  if (!dl) return;
  const todos = [...Object.keys(materias), ...Object.keys(materiasConcluidas)];
  dl.innerHTML = todos.map(n => `<option value="${n}">`).join('');
}

function calcularPrioridade(percentual) {
  if (percentual < 60) return "alta";
  if (percentual < 80) return "media";
  return "baixa";
}

function limparCampos() {
  document.getElementById("materia").value = "";
  document.getElementById("acertos").value = "";
  document.getElementById("erros").value   = "";
}

function obterSemanaAtual() {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
  return Math.ceil((hoje.getDay() + 1 + dias) / 7);
}

function metaAutomatica(nome) {
  const dados = materias[nome];
  const totalResolvido = (dados?.totalAcertos || 0) + (dados?.totalErros || 0);
  if (totalResolvido === 0) return 10;
  const percentual = (dados.totalAcertos / totalResolvido) * 100;
  let metaBase;
  if      (percentual < 60) metaBase = Math.ceil(totalResolvido * 0.5);
  else if (percentual < 80) metaBase = Math.ceil(totalResolvido * 0.35);
  else                      metaBase = Math.ceil(totalResolvido * 0.25);
  return Math.max(metaBase, 10);
}

function gerarMetasAutomaticas() {
  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    if (total === 0) continue;
    metasPorMateria[nome] = metaAutomatica(nome);
  }
  atualizarMetasVisuais();
  salvarDados(); atualizarDashboard();
  toast('Metas geradas automaticamente!', 'success');
}

function limparMetasOrfas() {
  for (let nome in metasPorMateria) {
    if (!materias[nome]) delete metasPorMateria[nome];
  }
}

function registrarProgressoSemanal(nome, quantidade) {
  const semana = obterSemanaAtual();
  if (!progressoSemanal[semana])       progressoSemanal[semana] = {};
  if (!progressoSemanal[semana][nome]) progressoSemanal[semana][nome] = 0;
  progressoSemanal[semana][nome] += quantidade;
}

function atualizarInfoSemana() {
  const el = document.getElementById('semanaInfoMetas');
  if (!el) return;
  const semana = obterSemanaAtual();
  const hoje = new Date();
  const diasSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  el.innerHTML = `📅 <strong>Semana ${semana}</strong> &nbsp;·&nbsp; Hoje é ${diasSemana[hoje.getDay()]}, ${hoje.toLocaleDateString('pt-BR')}`;
}

function atualizarMetasVisuais() {
  const container = document.getElementById("progressoMeta");
  if (!container) return;

  const semana = obterSemanaAtual();
  const progressoAtual = progressoSemanal[semana] || {};

  if (Object.keys(metasPorMateria).length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><div class="empty-text">Nenhuma meta definida.</div></div>';
    return;
  }

  const lista = Object.keys(metasPorMateria).map(nome => {
    const meta  = metasPorMateria[nome];
    const feito = progressoAtual[nome] || 0;
    const pct   = meta > 0 ? (feito / meta) * 100 : 0;
    return { nome, meta, feito, pct };
  }).sort((a, b) => b.pct - a.pct);

  container.innerHTML = lista.map(item => {
    let statusClasse, statusTexto, fillClass;
    if      (item.pct < 50)  { statusClasse = 'meta-atrasado'; statusTexto = '⚠ Abaixo';    fillClass = 'fill-red'; }
    else if (item.pct < 100) { statusClasse = 'meta-ritmo';    statusTexto = '↗ No ritmo';  fillClass = 'fill-yellow'; }
    else                     { statusClasse = 'meta-batida';   statusTexto = '✔ Concluída'; fillClass = 'fill-green'; }

    return `
      <div class="meta-card">
        <div class="meta-header">
          <span class="meta-name">${item.nome}</span>
          <span class="meta-status ${statusClasse}">${statusTexto}</span>
        </div>
        <div class="meta-nums">
          <span>${item.feito} / ${item.meta} questões</span>
          <span>${item.pct.toFixed(1)}%</span>
        </div>
        <div class="meta-track">
          <div class="meta-fill ${fillClass}" style="width:${Math.min(item.pct, 100)}%"></div>
        </div>
        <div class="meta-actions">
          <button class="btn btn-secondary btn-sm" onclick="editarMeta('${item.nome}')">✏ Editar</button>
          <button class="btn btn-danger btn-sm"    onclick="excluirMeta('${item.nome}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function excluirMeta(nome) {
  if (!confirm(`Excluir a meta de "${nome}"?`)) return;
  delete metasPorMateria[nome];
  salvarDados(); atualizarMetasVisuais(); atualizarDashboard();
  toast(`Meta de "${nome}" excluída.`, 'info');
}

function editarMeta(nome) {
  const nova = prompt(`Nova meta semanal para "${nome}":`, metasPorMateria[nome]);
  if (!nova) return;
  const valor = parseInt(nova, 10);
  if (isNaN(valor) || valor <= 0) { toast('Valor inválido.', 'error'); return; }
  metasPorMateria[nome] = valor;
  salvarDados(); atualizarMetasVisuais(); atualizarDashboard();
  toast(`Meta de "${nome}" → ${valor} questões!`, 'success');
}

function obterSnapshotSemana(semana) {
  return {
    metas:             { ...metasPorMateria },
    progresso:         { ...(progressoSemanal[semana] || {}) },
    dataFechamentoISO: new Date().toISOString()
  };
}

function salvarHistoricoSemana(semanaParaSalvar) {
  if (!semanaParaSalvar || historicoMetas[semanaParaSalvar]) return;
  historicoMetas[semanaParaSalvar] = obterSnapshotSemana(semanaParaSalvar);
}

function detectarTrocaDeSemanaEFechar() {
  const semanaAtual = obterSemanaAtual();
  if (semanaUltimaVista === null) { semanaUltimaVista = semanaAtual; return; }
  if (semanaAtual !== semanaUltimaVista) {
    salvarHistoricoSemana(semanaUltimaVista);
    progressoSemanal[semanaAtual] = progressoSemanal[semanaAtual] || {};
    semanaUltimaVista = semanaAtual;
    salvarDados(); atualizarHistorico(); atualizarMetasVisuais(); atualizarDashboard();
  }
}

function fecharSemanaAgora() {
  const semanaAtual = obterSemanaAtual();
  if (!confirm(`Salvar a Semana ${semanaAtual} no histórico e zerar o progresso?`)) return;
  historicoMetas[semanaAtual] = obterSnapshotSemana(semanaAtual);
  progressoSemanal[semanaAtual] = {};
  salvarDados(); atualizarHistorico(); atualizarMetasVisuais(); atualizarDashboard();
  toast(`Semana ${semanaAtual} arquivada!`, 'success');
}

function atualizarHistorico() {
  const container = document.getElementById("historicoMetas");
  if (!container) return;

  const semanas = Object.keys(historicoMetas)
    .map(n => parseInt(n)).filter(n => !isNaN(n)).sort((a, b) => b - a);

  if (!semanas.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📂</div><div class="empty-text">Nenhum histórico ainda.</div></div>';
    return;
  }

  container.innerHTML = semanas.map(semana => {
    const dados = historicoMetas[semana];
    const metas = dados.metas    || {};
    const prog  = dados.progresso || {};
    const data  = dados.dataFechamentoISO
      ? new Date(dados.dataFechamentoISO).toLocaleDateString("pt-BR") : '';

    const rows = Object.keys(metas).map(nome => {
      const meta = metas[nome] || 0;
      const feito = prog[nome] || 0;
      const pct = meta > 0 ? ((feito / meta) * 100).toFixed(1) : '0.0';
      const cor = parseFloat(pct) >= 100 ? 'var(--success)' : parseFloat(pct) >= 50 ? 'var(--warning)' : 'var(--danger)';
      return `<div class="hist-meta-row"><span>${nome}</span><span style="color:${cor};font-weight:600;">${feito}/${meta} (${pct}%)</span></div>`;
    }).join('');

    return `
      <div class="hist-meta-card">
        <div class="hist-meta-header">Semana ${semana}${data ? ` — fechada em ${data}` : ''}</div>
        ${rows || '<span style="color:var(--muted);font-size:12.5px;">Sem metas.</span>'}
      </div>
    `;
  }).join('');
}

function registrarBloco() {
  const nome    = document.getElementById("materia").value.trim();
  const acertos = parseInt(document.getElementById("acertos").value, 10);
  const erros   = parseInt(document.getElementById("erros").value, 10);

  if (!nome)                          { toast('Informe o nome da matéria.', 'warning'); return; }
  if (isNaN(acertos) || isNaN(erros)) { toast('Informe acertos e erros válidos.', 'warning'); return; }
  if (acertos < 0 || erros < 0)       { toast('Valores não podem ser negativos.', 'warning'); return; }

  if (!materias[nome]) materias[nome] = { totalAcertos: 0, totalErros: 0 };
  materias[nome].totalAcertos += acertos;
  materias[nome].totalErros   += erros;

  if (metasPorMateria[nome] === undefined) metasPorMateria[nome] = metaAutomatica(nome);

  gerarRevisoesExtrasPorVolume(nome);
  registrarProgressoSemanal(nome, acertos + erros);
  atualizarStreak();
  atualizarDatalist();
  atualizarDesempenho();
  atualizarMetasVisuais();
  limparCampos();
  salvarDados();
  atualizarDashboard();
  renderizarGrade();
  gerarESalvarRevisoes(nome);
  renderizarProximasRevisoes();
  atualizarStatsSummary();
  atualizarPomoMaterias();

  toast(`"${nome}" registrado!`, 'success');
}

function excluirMateria(nome) {
  if (!confirm(`Deseja excluir completamente "${nome}"?`)) return;
  delete materias[nome];
  delete metasPorMateria[nome];
  delete revisoesInteligentes[nome];
  delete revisoesGeradasPorMateria[nome];
  agendaRevisoes = agendaRevisoes.filter(ev => ev.materia !== nome);
  salvarDados();
  atualizarDesempenho(); atualizarMetasVisuais(); atualizarDashboard();
  renderizarGrade(); renderizarProximasRevisoes(); atualizarStatsSummary();
  atualizarDatalist(); atualizarPomoMaterias();
  toast(`"${nome}" excluída.`, 'info');
}

function atualizarDesempenho() {
  const container   = document.getElementById("tabelaDesempenho");
  const diagnostico = document.getElementById("diagnostico");
  if (!container || !diagnostico) return;

  const nomes = Object.keys(materias);

  if (!nomes.length) {
    container.innerHTML   = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Nenhuma matéria registrada ainda.</div></div>';
    diagnostico.innerHTML = '<div class="empty"><div class="empty-icon">💡</div><div class="empty-text">Registre questões para ver o diagnóstico.</div></div>';
    return;
  }

  const lista = nomes.map(nome => {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    const pct   = total > 0 ? (dados.totalAcertos / total * 100) : 0;
    return { nome, dados, pct, prioridade: calcularPrioridade(pct) };
  }).sort((a, b) => a.pct - b.pct);

  container.innerHTML = lista.map(({ nome, dados, pct, prioridade }) => {
    let fillClass, statusClasse, statusTexto;
    if      (pct < 60) { fillClass = 'fill-red';    statusClasse = 'status-critico';   statusTexto = '⚠ Precisa reforçar'; }
    else if (pct < 80) { fillClass = 'fill-yellow'; statusClasse = 'status-bom';       statusTexto = '↗ Desempenho moderado'; }
    else               { fillClass = 'fill-green';  statusClasse = 'status-excelente'; statusTexto = '✔ Excelente domínio'; }

    const total = dados.totalAcertos + dados.totalErros;
    return `
      <div class="performance-card">
        <div class="performance-header">
          <span class="performance-name">${nome}</span>
          <span class="badge badge-${prioridade}">Prioridade ${prioridade.toUpperCase()}</span>
        </div>
        <div class="perf-stats">
          <div class="perf-stat stat-green"><strong>${dados.totalAcertos}</strong><small>Acertos</small></div>
          <div class="perf-stat stat-red"><strong>${dados.totalErros}</strong><small>Erros</small></div>
          <div class="perf-stat stat-purple"><strong>${pct.toFixed(1)}%</strong><small>Aproveit.</small></div>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div class="perf-status ${statusClasse}" style="margin-bottom:8px;">${statusTexto}</div>
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px;">Total: ${total} questões resolvidas</div>
        <div class="card-actions">
          <button class="btn btn-success btn-sm" onclick="concluirMateria('${nome}')">✔ Concluir</button>
          <button class="btn btn-danger btn-sm"  onclick="excluirMateria('${nome}')">🗑 Excluir</button>
        </div>
      </div>
    `;
  }).join('');

  gerarDiagnostico(lista);
  atualizarStatsSummary();
}

function gerarDiagnostico(lista) {
  const container = document.getElementById("diagnostico");
  if (!container || !lista.length) return;

  const configs = {
    alta:  { classe: 'diag-alta',  icone: '🔴', titulo: 'Desempenho Crítico',  plano: 'Revisar teoria imediatamente + resolver 20 questões diárias focando nos erros.' },
    media: { classe: 'diag-media', icone: '🟡', titulo: 'Desempenho Moderado', plano: 'Aumentar volume de questões e revisar os principais pontos de erro.' },
    baixa: { classe: 'diag-baixa', icone: '🟢', titulo: 'Bom Desempenho',      plano: 'Manter revisões periódicas e simulados para consolidar o domínio.' }
  };

  container.innerHTML = [...lista].sort((a, b) => a.pct - b.pct).map(({ nome, pct, prioridade }) => {
    const c = configs[prioridade];
    return `
      <div class="diag-card ${c.classe}">
        <div class="diag-header">
          <div class="diag-name"><span>${c.icone}</span>${nome}</div>
          <div class="diag-pct">${pct.toFixed(1)}%</div>
        </div>
        <div style="font-size:13.5px;font-weight:700;margin-bottom:4px;">${c.titulo}</div>
        <div class="diag-plan">${c.plano}</div>
      </div>
    `;
  }).join('');
}

function concluirMateria(nome) {
  if (!materias[nome]) return;
  if (!confirm(`Marcar "${nome}" como concluída?`)) return;
  materiasConcluidas[nome] = { dados: materias[nome], dataConclusao: new Date().toISOString() };
  delete materias[nome];
  delete metasPorMateria[nome];
  delete revisoesInteligentes[nome];
  delete revisoesGeradasPorMateria[nome];
  agendaRevisoes = agendaRevisoes.filter(ev => ev.materia !== nome);
  salvarDados();
  atualizarDesempenho(); atualizarMetasVisuais(); atualizarDashboard();
  renderizarGrade(); renderizarProximasRevisoes(); renderizarMateriasConcluidas();
  atualizarDatalist(); atualizarPomoMaterias();
  toast(`"${nome}" concluída! 🎓`, 'success');
}

function renderizarMateriasConcluidas() {
  const container = document.getElementById("materiasConcluidas");
  if (!container) return;
  const nomes = Object.keys(materiasConcluidas);
  if (!nomes.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">🎓</div><div class="empty-text">Nenhuma matéria concluída ainda.</div></div>';
    return;
  }
  container.innerHTML = nomes.map(nome => {
    const item = materiasConcluidas[nome];
    const data = new Date(item.dataConclusao).toLocaleDateString("pt-BR");
    const dados = item.dados;
    const total = dados.totalAcertos + dados.totalErros;
    const pct   = total > 0 ? ((dados.totalAcertos / total) * 100).toFixed(1) : '—';
    return `
      <div class="concluida-card">
        <div>
          <div class="concluida-nome">✅ ${nome}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${total} questões · ${pct}% aproveitamento</div>
        </div>
        <span class="concluida-data">Concluída em ${data}</span>
      </div>
    `;
  }).join('');
}

function gerarESalvarRevisoes(nome) {
  if (revisoesInteligentes[nome]?.length > 0) return;
  const dados = materias[nome];
  if (!dados) return;
  const total = dados.totalAcertos + dados.totalErros;
  if (total === 0) return;

  const pct        = (dados.totalAcertos / total) * 100;
  const prioridade = calcularPrioridade(pct);
  const ranges     = { alta: [3, 7], media: [10, 15], baixa: [30, 45] };
  const [min, max] = ranges[prioridade];

  const hoje = new Date();
  const dias1 = Math.floor(Math.random() * (max - min + 1)) + min;
  const dias2 = Math.floor(Math.random() * (max - min + 1)) + min;

  const d1 = new Date(hoje); d1.setDate(hoje.getDate() + dias1);
  const d2 = new Date(d1);   d2.setDate(d1.getDate()   + dias2);

  revisoesInteligentes[nome] = [
    { data: d1.toISOString(), concluida: false },
    { data: d2.toISOString(), concluida: false }
  ];
  salvarDados();
}

function gerarRevisoesInteligentesAutomaticamente() {
  for (let nome in materias) {
    const dados = materias[nome];
    const total = (dados.totalAcertos || 0) + (dados.totalErros || 0);
    if (total === 0) continue;
    if (!revisoesInteligentes[nome] || revisoesInteligentes[nome].length === 0) {
      gerarESalvarRevisoes(nome);
    }
  }
}

function renderizarProximasRevisoes() {
  const container = document.getElementById("gradeRevisoesInteligentes");
  if (!container) return;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let lista = [];

  for (let nome in revisoesInteligentes) {
    revisoesInteligentes[nome].forEach((rev, index) => {
      const dataObj = new Date(rev.data); dataObj.setHours(0, 0, 0, 0);
      let status = 'futura';
      if (!rev.concluida) {
        if      (dataObj < hoje)                            status = 'atrasada';
        else if (dataObj.getTime() === hoje.getTime()) status = 'hoje';
      }
      lista.push({ materia: nome, data: new Date(rev.data), concluida: rev.concluida, status, index });
    });
  }

  lista.sort((a, b) => a.data - b.data);

  if (!lista.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Nenhuma revisão agendada.</div></div>';
    return;
  }

  const tagLabels = { atrasada: 'Atrasada', hoje: 'Hoje', futura: 'Agendada' };

  container.innerHTML = lista.map(item => `
    <div class="rev-card rev-${item.status} ${item.concluida ? 'rev-feita' : ''}">
      <div class="rev-info">
        <div class="rev-name">${item.materia}</div>
        <div class="rev-date">📅 ${item.data.toLocaleDateString("pt-BR")}</div>
      </div>
      <span class="rev-tag tag-${item.status}">${tagLabels[item.status]}</span>
      <div class="rev-btns">
        <button class="btn btn-success btn-sm" onclick="marcarRevisaoInteligente('${item.materia}', ${item.index})">✔ Concluir</button>
        <button class="btn btn-secondary btn-sm" onclick="recalcularRevisoes('${item.materia}')" title="Recalcular">🔁</button>
      </div>
    </div>
  `).join('');
}

function marcarRevisaoInteligente(nome, index) {
  const revisao = revisoesInteligentes[nome]?.[index];
  if (!revisao) return;
  if (!historicoRevisoesInteligentes[nome]) historicoRevisoesInteligentes[nome] = [];
  historicoRevisoesInteligentes[nome].push({
    dataOriginal:  revisao.data,
    dataConclusao: new Date().toISOString()
  });
  revisoesInteligentes[nome].splice(index, 1);
  if (!revisoesInteligentes[nome].length) delete revisoesInteligentes[nome];
  salvarDados();
  renderizarProximasRevisoes();
  renderizarHistoricoRevisoesInteligentes();
  toast('Revisão concluída! ✅', 'success');
}

function renderizarHistoricoRevisoesInteligentes() {
  const container = document.getElementById("historicoRevisoesInteligentes");
  if (!container) return;

  let lista = [];
  for (let nome in historicoRevisoesInteligentes) {
    historicoRevisoesInteligentes[nome].forEach((item, index) => {
      lista.push({
        materia: nome, indexOriginal: index,
        dataOriginal:  new Date(item.dataOriginal),
        dataConclusao: new Date(item.dataConclusao)
      });
    });
  }

  if (filtroMateriaHistorico !== 'todas') {
    lista = lista.filter(i => i.materia === filtroMateriaHistorico);
  }

  lista.sort((a, b) => b.dataConclusao - a.dataConclusao);

  if (!lista.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Nenhuma revisão concluída ainda.</div></div>';
    atualizarOpcoesFiltroHistorico(); return;
  }

  const limite = historicoExpandido ? lista.length : 5;

  container.innerHTML = `<div style="margin-bottom:9px;color:var(--muted);font-size:12.5px;">Mostrando ${Math.min(limite, lista.length)} de ${lista.length}</div>`;

  container.innerHTML += lista.slice(0, limite).map(item => `
    <div class="hist-card">
      <div class="hist-name">${item.materia}</div>
      <div class="hist-dates">
        📅 Prevista: ${item.dataOriginal.toLocaleDateString("pt-BR")}<br>
        ✅ Concluída: ${item.dataConclusao.toLocaleDateString("pt-BR")}
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:9px;" onclick="desconcluirRevisao('${item.materia}', ${item.indexOriginal})">↩ Desfazer</button>
    </div>
  `).join('');

  if (lista.length > 5) {
    container.innerHTML += `
      <div style="text-align:center;margin-top:10px;">
        <button class="btn btn-secondary" onclick="toggleHistorico()">
          ${historicoExpandido ? '▲ Ver menos' : '▼ Ver mais'}
        </button>
      </div>
    `;
  }

  atualizarOpcoesFiltroHistorico();
}

function atualizarOpcoesFiltroHistorico() {
  const select = document.getElementById("filtroMateriaHistorico");
  if (!select) return;
  const materiasUnicas = Object.keys(historicoRevisoesInteligentes);
  select.innerHTML = `<option value="todas">Todas as matérias</option>`;
  materiasUnicas.forEach(nome => { select.innerHTML += `<option value="${nome}">${nome}</option>`; });
  select.value = filtroMateriaHistorico;
}

function atualizarFiltroHistorico() {
  filtroMateriaHistorico = document.getElementById("filtroMateriaHistorico").value;
  historicoExpandido = false;
  renderizarHistoricoRevisoesInteligentes();
}

function toggleHistorico() {
  historicoExpandido = !historicoExpandido;
  renderizarHistoricoRevisoesInteligentes();
}

function desconcluirRevisao(nome, index) {
  const item = historicoRevisoesInteligentes[nome]?.[index];
  if (!item) return;
  if (!revisoesInteligentes[nome]) revisoesInteligentes[nome] = [];
  revisoesInteligentes[nome].push({ data: item.dataOriginal, concluida: false });
  historicoRevisoesInteligentes[nome].splice(index, 1);
  if (!historicoRevisoesInteligentes[nome].length) delete historicoRevisoesInteligentes[nome];
  salvarDados(); renderizarProximasRevisoes(); renderizarHistoricoRevisoesInteligentes();
  toast('Revisão restaurada.', 'info');
}

function recalcularRevisoes(nome) {
  if (!materias[nome]) return;
  if (!confirm(`Recalcular revisões de "${nome}"?`)) return;
  delete revisoesInteligentes[nome];
  gerarESalvarRevisoes(nome);
  salvarDados(); renderizarProximasRevisoes();
  toast('Revisões recalculadas!', 'success');
}

function criarRevisaoSeNaoExiste(nome, prioridade, dataObj) {
  const existe = agendaRevisoes.some(ev =>
    ev.materia === nome && ev.tipo === "Revisão" &&
    new Date(ev.data).toDateString() === dataObj.toDateString()
  );
  if (existe) return false;
  agendaRevisoes.push({
    id: crypto.randomUUID(), data: dataObj.toISOString(),
    tipo: "Revisão", materia: nome, duracao: 30,
    prioridade, concluido: false, reagendamentos: 0
  });
  return true;
}

function criarAgendaInteligente() {
  const hoje        = new Date();
  const limiteFinal = new Date(); limiteFinal.setMonth(limiteFinal.getMonth() + 3);
  agendaRevisoes = agendaRevisoes.filter(ev => new Date(ev.data) >= hoje);

  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    if (total === 0) continue;
    const pct          = (dados.totalAcertos / total) * 100;
    const prioridade   = calcularPrioridade(pct);
    const duracaoEstudo = prioridade === "alta" ? 60 : 40;

    const jaExiste = agendaRevisoes.some(ev =>
      ev.tipo === "Estudo" && ev.materia === nome &&
      new Date(ev.data).toDateString() === hoje.toDateString()
    );

    if (!jaExiste) {
      agendaRevisoes.push({
        id: crypto.randomUUID(), data: hoje.toISOString(),
        tipo: "Estudo", materia: nome, duracao: duracaoEstudo,
        prioridade, concluido: false, reagendamentos: 0
      });
    }

    let dataRevisao = new Date(hoje);
    while (dataRevisao < limiteFinal) {
      const intervalo = prioridade === "alta"  ? 3  + Math.floor(Math.random() * 5)
                      : prioridade === "media" ? 10 + Math.floor(Math.random() * 6)
                      :                         30 + Math.floor(Math.random() * 16);
      dataRevisao = new Date(dataRevisao);
      dataRevisao.setDate(dataRevisao.getDate() + intervalo);
      if (dataRevisao > limiteFinal) break;
      criarRevisaoSeNaoExiste(nome, prioridade, dataRevisao);
    }
  }

  salvarDados(); renderizarGrade();
  toast('Agenda gerada!', 'success');
}

function limparAgendaConcluida() {
  const antes = agendaRevisoes.length;
  agendaRevisoes = agendaRevisoes.filter(ev => !ev.concluido);
  const removidos = antes - agendaRevisoes.length;
  salvarDados(); renderizarGrade();
  toast(`${removidos} evento(s) concluído(s) removido(s).`, 'info');
}

function renderizarGrade() {
  const grade = document.getElementById("grade");
  if (!grade) return;

  if (!agendaRevisoes.length) {
    grade.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Gere a agenda para ver os eventos.</div></div>';
    return;
  }

  const agenda = {};
  agendaRevisoes.forEach(ev => {
    const key = new Date(ev.data).toISOString().split("T")[0];
    if (!agenda[key]) agenda[key] = { carga: 0, eventos: [] };
    agenda[key].eventos.push(ev);
    agenda[key].carga += ev.duracao;
  });

  grade.innerHTML = Object.keys(agenda).sort().map(data => {
    const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString("pt-BR", {
      weekday: 'long', day: '2-digit', month: 'long'
    });
    const eventos = agenda[data].eventos.map(ev => `
      <div class="evento evento-${ev.tipo === 'Estudo' ? 'estudo' : 'revisao'} ${ev.concluido ? 'feito' : ''}">
        <span style="font-weight:600;">${ev.tipo}</span>
        <span>${ev.materia}</span>
        <span>${ev.duracao} min</span>
        <button class="btn btn-sm ${ev.concluido ? 'btn-secondary' : 'btn-primary'}" onclick="marcarConcluido('${ev.id}')">
          ${ev.concluido ? '✔ Feito' : 'Marcar'}
        </button>
      </div>
    `).join('');

    return `
      <div class="dia-card">
        <div class="dia-header">${dataFormatada}</div>
        ${eventos}
        <div class="carga-total">⏱ Carga: ${agenda[data].carga} min</div>
      </div>
    `;
  }).join('');
}

function marcarConcluido(id) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev) return;
  ev.concluido = !ev.concluido;
  salvarDados(); renderizarGrade();
}

function gerarRevisoesExtrasPorVolume(nome) {
  const limiteFinal = new Date(); limiteFinal.setMonth(limiteFinal.getMonth() + 3);
  const dados = materias[nome];
  const total = dados.totalAcertos + dados.totalErros;
  if (total === 0) return;

  const pct               = (dados.totalAcertos / total) * 100;
  const prioridade        = calcularPrioridade(pct);
  const revisoesDesejadas = Math.floor(total / QUESTOES_POR_REVISAO);
  const jaGeradas         = revisoesGeradasPorMateria[nome] || 0;
  const faltam            = revisoesDesejadas - jaGeradas;
  if (faltam <= 0) return;

  const saltos = { alta: 5, media: 10, baixa: 15 };
  const salto  = saltos[prioridade];
  const hoje   = new Date();

  for (let k = 0; k < faltam; k++) {
    const revs = agendaRevisoes
      .filter(ev => ev.tipo === "Revisão" && ev.materia === nome)
      .map(ev => new Date(ev.data)).sort((a, b) => a - b);

    let base      = revs.length ? revs[revs.length - 1] : hoje;
    let tentativa = new Date(base);
    let criada    = false;

    for (let t = 0; t < 30; t++) {
      tentativa = new Date(tentativa);
      tentativa.setDate(tentativa.getDate() + salto);
      if (tentativa > limiteFinal) break;
      if (criarRevisaoSeNaoExiste(nome, prioridade, tentativa)) { criada = true; break; }
      tentativa.setDate(tentativa.getDate() + 1);
    }

    if (criada) revisoesGeradasPorMateria[nome] = (revisoesGeradasPorMateria[nome] || 0) + 1;
    else break;
  }
}

const POMO = { focoMin: 40, pausaCurtaMin: 5, pausaLongaMin: 15, ciclosParaPausaLonga: 4 };

let pomoIntervalo        = null;
let pomoRodando          = false;
let pomoEtapa            = "foco";
let pomoSegundos         = POMO.focoMin * 60;
let pomoCiclosConcluidos = 0;

function aplicarConfigPomo() {
  POMO.focoMin       = parseInt(document.getElementById('cfgFoco').value)  || 40;
  POMO.pausaCurtaMin = parseInt(document.getElementById('cfgCurta').value) || 5;
  POMO.pausaLongaMin = parseInt(document.getElementById('cfgLonga').value) || 15;
  if (!pomoRodando) pomoDefinirEtapa(pomoEtapa);
}

function pomoFormatar(seg) {
  return `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
}

function pomoCiclosUI() {
  const txt  = document.getElementById('pomoCiclosTexto');
  const dots = document.getElementById('pomoDots');
  if (txt) txt.textContent = `Ciclo ${(pomoCiclosConcluidos % POMO.ciclosParaPausaLonga) + 1} de ${POMO.ciclosParaPausaLonga}`;
  if (dots) {
    const atual = pomoCiclosConcluidos % POMO.ciclosParaPausaLonga;
    dots.querySelectorAll('.pomo-dot').forEach((d, i) => {
      d.classList.toggle('ativo', i <= atual && pomoEtapa === 'foco');
    });
  }
}

function pomoUI() {
  const el = document.getElementById("timer");
  if (el) el.textContent = pomoFormatar(pomoSegundos);
  const st = document.getElementById("pomodoroStatus");
  if (st) st.textContent = pomoEtapa === 'foco' ? 'FOCO' : pomoEtapa === 'curta' ? 'PAUSA CURTA' : 'PAUSA LONGA';
  pomoCiclosUI();
  if (pomoRodando) document.title = `${pomoFormatar(pomoSegundos)} — Planner de Estudos`;
  else document.title = 'Planner de Estudos';
}

function pomoDefinirEtapa(etapa) {
  pomoEtapa = etapa;
  if (etapa === "foco")  pomoSegundos = POMO.focoMin       * 60;
  if (etapa === "curta") pomoSegundos = POMO.pausaCurtaMin * 60;
  if (etapa === "longa") pomoSegundos = POMO.pausaLongaMin * 60;
  pomoUI();
}

function pomoBeep() {
  try {
    const cfgSom = document.getElementById('cfgSom');
    if (cfgSom && !cfgSom.checked) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.05;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch (e) {}
}

function pomoRegistrarSessao() {
  const materia = document.getElementById('pomoMateriaSelect')?.value || '';
  if (!materia || pomoEtapa !== 'foco') return;
  const hoje = new Date().toDateString();
  pomoSessoes.push({ materia, data: hoje, duracao: POMO.focoMin });
  salvarDados();
  atualizarPomoSessoes();
  if (materias[materia]) atualizarStreak();
}

function atualizarPomoSessoes() {
  const container = document.getElementById('pomoSessoesHoje');
  if (!container) return;
  const hoje = new Date().toDateString();
  const sessoes = pomoSessoes.filter(s => s.data === hoje);
  if (!sessoes.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;">Nenhuma sessão concluída hoje.</div>';
    return;
  }
  const totalMin = sessoes.reduce((acc, s) => acc + s.duracao, 0);
  container.innerHTML = `
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:8px;">
      ${sessoes.length} sessão(ões) — ${totalMin} min estudados hoje
    </div>
    ${sessoes.map(s => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>${s.materia || '—'}</span>
        <span style="color:var(--muted);">${s.duracao} min</span>
      </div>
    `).join('')}
  `;
}

function atualizarPomoMaterias() {
  const select = document.getElementById('pomoMateriaSelect');
  if (!select) return;
  const nomes = Object.keys(materias);
  select.innerHTML = '<option value="">— Selecionar matéria —</option>';
  nomes.forEach(n => { select.innerHTML += `<option value="${n}">${n}</option>`; });
}

function pomoAvancar() {
  pomoBeep();
  if (pomoEtapa === "foco") {
    pomoRegistrarSessao();
    pomoCiclosConcluidos++;
    pomoDefinirEtapa(pomoCiclosConcluidos % POMO.ciclosParaPausaLonga === 0 ? "longa" : "curta");
    toast('Foco concluído! Hora de descansar. ☕', 'success');
  } else {
    pomoDefinirEtapa("foco");
    toast('Pausa encerrada. Vamos focar! 🎯', 'info');
  }
}

function pomodoroIniciar() {
  if (pomoRodando) return;
  pomoRodando = true;
  if (pomoIntervalo) clearInterval(pomoIntervalo);
  pomoIntervalo = setInterval(() => {
    if (!pomoRodando) return;
    pomoSegundos--;
    if (pomoSegundos <= 0) pomoAvancar();
    else pomoUI();
  }, 1000);
  pomoUI();
}

function pomodoroPausar() {
  pomoRodando = false;
  document.title = 'Planner de Estudos';
  toast('Pausado.', 'info');
}

function pomodoroReset() {
  pomoRodando = false;
  if (pomoIntervalo) clearInterval(pomoIntervalo);
  pomoIntervalo = null;
  pomoCiclosConcluidos = 0;
  document.title = 'Planner de Estudos';
  pomoDefinirEtapa("foco");
}

function pomodoroPular() { pomoAvancar(); }

let graficoProgresso = null;
let graficoMeta      = null;
let graficoAprov     = null;

function atualizarDashboard() {
  const semana         = obterSemanaAtual();
  const progressoAtual = progressoSemanal[semana] || {};
  const labels = [], dadosFeitos = [], dadosPercentual = [], dadosAprov = [];

  for (let nome in metasPorMateria) {
    labels.push(nome);
    const meta  = metasPorMateria[nome] || 0;
    const feito = progressoAtual[nome]  || 0;
    dadosFeitos.push(feito);
    dadosPercentual.push(meta > 0 ? +((feito / meta) * 100).toFixed(1) : 0);
  }

  for (let nome in materias) {
    const d = materias[nome];
    const t = d.totalAcertos + d.totalErros;
    if (t > 0) dadosAprov.push({ nome, pct: +((d.totalAcertos / t) * 100).toFixed(1) });
  }

  const ctx1 = document.getElementById("graficoProgresso");
  const ctx2 = document.getElementById("graficoDesempenho");
  const ctx3 = document.getElementById("graficoAproveitamento");
  if (!ctx1 || !ctx2 || !ctx3) return;

  if (graficoProgresso) graficoProgresso.destroy();
  if (graficoMeta)      graficoMeta.destroy();
  if (graficoAprov)     graficoAprov.destroy();

  const baseOpts = {
    responsive: true, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyFont: { family: 'DM Sans' },
        titleFont: { family: 'Syne', weight: '700' },
        backgroundColor: 'rgba(15,15,26,0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#555570', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#555570', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  };

  graficoProgresso = new Chart(ctx1, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Questões", data: dadosFeitos,
        backgroundColor: 'rgba(108,92,231,0.55)',
        borderColor: '#6c5ce7', borderWidth: 2, borderRadius: 7
      }]
    },
    options: baseOpts
  });

  graficoMeta = new Chart(ctx2, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% da Meta", data: dadosPercentual,
        backgroundColor: dadosPercentual.map(v => v >= 100 ? 'rgba(0,206,201,0.55)' : v >= 50 ? 'rgba(253,203,110,0.55)' : 'rgba(255,86,117,0.55)'),
        borderColor: dadosPercentual.map(v => v >= 100 ? '#00cec9' : v >= 50 ? '#fdcb6e' : '#ff5675'),
        borderWidth: 2, borderRadius: 7
      }]
    },
    options: baseOpts
  });

  if (dadosAprov.length) {
    graficoAprov = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: dadosAprov.map(d => d.nome),
        datasets: [{
          label: "Aproveitamento %", data: dadosAprov.map(d => d.pct),
          backgroundColor: dadosAprov.map(d => d.pct >= 80 ? 'rgba(0,206,201,0.55)' : d.pct >= 60 ? 'rgba(253,203,110,0.55)' : 'rgba(255,86,117,0.55)'),
          borderColor: dadosAprov.map(d => d.pct >= 80 ? '#00cec9' : d.pct >= 60 ? '#fdcb6e' : '#ff5675'),
          borderWidth: 2, borderRadius: 7
        }]
      },
      options: {
        ...baseOpts,
        scales: {
          ...baseOpts.scales,
          y: { ...baseOpts.scales.y, min: 0, max: 100 }
        }
      }
    });
  } else {
    ctx3.parentElement.innerHTML += '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0;">Registre questões para ver o gráfico.</div>';
  }
}

function salvarDados() {
  localStorage.setItem("planner_dados_v3", JSON.stringify({
    materias, metasPorMateria, historicoMetas, progressoSemanal,
    agendaRevisoes, revisoesGeradasPorMateria, revisoesInteligentes,
    historicoRevisoesInteligentes, materiasConcluidas, semanaUltimaVista,
    streakDias, ultimoDiaEstudo, pomoSessoes
  }));
}

function carregarDados() {
  const raw = localStorage.getItem("planner_dados_v3")
           || localStorage.getItem("planner_dados_v2")
           || localStorage.getItem("planner_dados");
  if (!raw) return;

  const p = JSON.parse(raw);
  materias                      = p.materias                      || {};
  historicoRevisoesInteligentes = p.historicoRevisoesInteligentes || {};
  metasPorMateria               = p.metasPorMateria               || {};
  historicoMetas                = p.historicoMetas                || {};
  materiasConcluidas            = p.materiasConcluidas            || {};
  progressoSemanal              = p.progressoSemanal              || {};
  agendaRevisoes                = p.agendaRevisoes                || [];
  revisoesGeradasPorMateria     = p.revisoesGeradasPorMateria     || {};
  streakDias                    = p.streakDias                    || 0;
  ultimoDiaEstudo               = p.ultimoDiaEstudo               || null;
  pomoSessoes                   = p.pomoSessoes                   || [];
  revisoesInteligentes = {};

  const revisoesRaw = p.revisoesInteligentes || {};
  for (let nome in revisoesRaw) {
    revisoesInteligentes[nome] = revisoesRaw[nome].map(item =>
      typeof item === "string"
        ? { data: item, concluida: false }
        : { data: item.data, concluida: item.concluida || false }
    );
  }

  semanaUltimaVista = p.semanaUltimaVista ?? obterSemanaAtual();

  for (let nome in materias) {
    if (metasPorMateria[nome] === undefined) metasPorMateria[nome] = metaAutomatica(nome);
  }

  limparMetasOrfas();
}

function resetarSistema() {
  if (!confirm("Apagar TODOS os dados do planner? Esta ação não pode ser desfeita.")) return;
  ['planner_dados', 'planner_dados_v2', 'planner_dados_v3'].forEach(k => localStorage.removeItem(k));
  location.reload();
}

function exportarDados() {
  const raw = localStorage.getItem("planner_dados_v3");
  if (!raw) { toast('Nenhum dado para exportar.', 'warning'); return; }
  const blob = new Blob([raw], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `planner-de-estudos-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('Backup exportado!', 'success');
}

function importarDados(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.materias) { toast('Arquivo inválido.', 'error'); return; }
      localStorage.setItem("planner_dados_v3", JSON.stringify(data));
      toast('Backup importado! Recarregando...', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch {
      toast('Erro ao ler o arquivo.', 'error');
    }
  };
  reader.readAsText(file);
}

const toggleBtn = document.getElementById("toggleTheme");

function aplicarTemaSalvo() {
  const tema = localStorage.getItem("tema");
  const cfgTema = document.getElementById('cfgTema');
  if (tema === "light") {
    document.body.classList.add("light-mode");
    if (toggleBtn) toggleBtn.textContent = "☀️ Light";
    if (cfgTema) cfgTema.checked = true;
  } else {
    if (toggleBtn) toggleBtn.textContent = "🌙 Dark";
    if (cfgTema) cfgTema.checked = false;
  }
}

function alternarTema() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  localStorage.setItem("tema", isLight ? "light" : "dark");
  if (toggleBtn) toggleBtn.textContent = isLight ? "☀️ Light" : "🌙 Dark";
  const cfgTema = document.getElementById('cfgTema');
  if (cfgTema) cfgTema.checked = isLight;
}

function alternarTemaConfig() {
  alternarTema();
}

if (toggleBtn) toggleBtn.addEventListener("click", alternarTema);

document.addEventListener('keydown', (e) => {
  // Enter no campo de erros registra o bloco
  if (e.key === 'Enter' && document.activeElement.id === 'erros') {
    registrarBloco();
  }
  // Ctrl+1..7 para navegar nas abas
  if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
    const abas = ['desempenho','metas','revisoes','agenda','pomodoro','dashboard','configuracoes'];
    const idx  = parseInt(e.key) - 1;
    const tabs = document.querySelectorAll('.tab');
    if (abas[idx] && tabs[idx]) mostrarPainel(abas[idx], tabs[idx]);
    e.preventDefault();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  carregarDados();
  aplicarTemaSalvo();
  detectarTrocaDeSemanaEFechar();
  gerarRevisoesInteligentesAutomaticamente();

  atualizarDesempenho();
  atualizarStatsSummary();
  atualizarMetasVisuais();
  atualizarHistorico();
  atualizarDashboard();
  renderizarMateriasConcluidas();
  renderizarHistoricoRevisoesInteligentes();
  renderizarGrade();
  renderizarProximasRevisoes();
  pomoDefinirEtapa("foco");
  atualizarDatalist();
  atualizarPomoMaterias();
  atualizarPomoSessoes();
  atualizarInfoSemana();

  document.getElementById('streakCount').textContent = streakDias;
});
