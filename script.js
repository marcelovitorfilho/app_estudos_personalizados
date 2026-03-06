let agendaRevisoes = [];
let materiasConcluidas = {};
let historicoRevisoesInteligentes = {};
let materias = {};
const QUESTOES_POR_REVISAO = 20;
let historicoExpandido = false;
let filtroMateriaHistorico = "todas";
let metasPorMateria = {};
let historicoMetas = {};
let progressoSemanal = {};
let semanaUltimaVista = null;
let streakDias = 0;
let ultimoDiaEstudo = null;
let pomoSessoes = [];

let filtroAtivoPrioridade = 'todas';
let agendaView          = 'lista'; // 'lista' | 'semana'
let agendaSemanaOffset  = 0;
let agendaFiltroMateria = 'todas';

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

  gerarEventosMateria(nome);
  registrarProgressoSemanal(nome, acertos + erros);
  atualizarStreak();
  atualizarDatalist();
  atualizarDesempenho();
  atualizarMetasVisuais();
  limparCampos();
  salvarDados();
  atualizarDashboard();
  renderizarGrade();
  renderizarProximasRevisoes();
  atualizarStatsSummary();
  atualizarPomoMaterias();

  toast(`"${nome}" registrado!`, 'success');
}

function excluirMateria(nome) {
  if (!confirm(`Deseja excluir completamente "${nome}"?`)) return;
  delete materias[nome];
  delete metasPorMateria[nome];
  agendaRevisoes = agendaRevisoes.filter(ev => ev.materia !== nome);
  salvarDados();
  atualizarDesempenho(); atualizarMetasVisuais(); atualizarDashboard();
  renderizarGrade(); renderizarProximasRevisoes(); atualizarStatsSummary();
  atualizarDatalist(); atualizarPomoMaterias();
  toast(`"${nome}" excluída.`, 'info');
}

function mostrarPainel(nome, tabEl) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + nome);
  if (panel) panel.classList.add('active');
  if (tabEl && tabEl.classList.contains('tab')) {
    tabEl.classList.add('active');
  } else {
    document.querySelectorAll('.tab').forEach(t => {
      if (t.dataset.painel === nome) t.classList.add('active');
    });
  }
  if (nome === 'dashboard') atualizarDashboard();
  if (nome === 'pomodoro') atualizarPomoMaterias();
}

function filtrarMaterias(filtro, btn) {
  filtroAtivoPrioridade = filtro;
  document.querySelectorAll('.mfb-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  atualizarDesempenho();
}

function makePctRing(pct, size, strokeW, colorClass) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle class="pc-pct-ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${strokeW}"/>
    <circle class="pc-pct-ring-fill ${colorClass}" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${strokeW}"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
  </svg>`;
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
    return { nome, dados, pct, total, prioridade: calcularPrioridade(pct) };
  }).sort((a, b) => a.pct - b.pct);

  const counts = { todas: lista.length, alta: 0, media: 0, baixa: 0 };
  lista.forEach(i => counts[i.prioridade]++);
  document.querySelectorAll('.mfb-btn').forEach(btn => {
    const f = btn.dataset.filter;
    let countEl = btn.querySelector('.mfb-count');
    if (!countEl) { countEl = document.createElement('span'); countEl.className = 'mfb-count'; btn.appendChild(countEl); }
    countEl.textContent = counts[f] ?? '';
  });

  const listaFiltrada = filtroAtivoPrioridade === 'todas'
    ? lista
    : lista.filter(i => i.prioridade === filtroAtivoPrioridade);

  if (!listaFiltrada.length) {
    const labels = { alta: 'alta prioridade', media: 'média prioridade', baixa: 'baixa prioridade' };
    container.innerHTML = `<div class="materias-empty-filter">🔍 Nenhuma matéria com ${labels[filtroAtivoPrioridade] || 'esse filtro'}.</div>`;
  } else {
    container.innerHTML = '<div class="materias-grid">' + listaFiltrada.map(({ nome, dados, pct, total, prioridade }) => {
    let colorClass, ringClass, statusClass, statusTxt, pcClass;
    if (pct < 60) {
      colorClass = 'fill-red'; ringClass = 'ring-red'; statusClass = 'pc-status-red';
      statusTxt = '⚠ Precisa reforçar'; pcClass = 'pc-red';
    } else if (pct < 80) {
      colorClass = 'fill-yellow'; ringClass = 'ring-yellow'; statusClass = 'pc-status-yellow';
      statusTxt = '↗ Desempenho moderado'; pcClass = 'pc-yellow';
    } else {
      colorClass = 'fill-green'; ringClass = 'ring-green'; statusClass = 'pc-status-green';
      statusTxt = '✔ Excelente domínio'; pcClass = 'pc-green';
    }
    const ring = makePctRing(pct, 48, 4, ringClass);
    return `
      <div class="performance-card ${pcClass}" onclick="verDetalheMateria('${nome}')">
        <div class="performance-header">
          <span class="performance-name">${nome}</span>
          <div class="pc-pct-ring">
            ${ring}
            <div class="pc-pct-label">${Math.round(pct)}%</div>
          </div>
        </div>
        <div class="pc-numbers">
          <div class="pc-num pcn-green"><strong>${dados.totalAcertos}</strong><span>Acertos</span></div>
          <div class="pc-num pcn-red"><strong>${dados.totalErros}</strong><span>Erros</span></div>
          <div class="pc-num pcn-acc"><strong>${total}</strong><span>Total</span></div>
        </div>
        <div class="pc-bar-wrap">
          <div class="progress-track"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>
        </div>
        <div class="pc-footer ${statusClass}">
          <div class="pc-status-dot"></div>
          <span class="pc-status-label">${statusTxt}</span>
          <span class="pc-detail-btn">Ver detalhes →</span>
        </div>
      </div>
    `;
    }).join('') + '</div>';
  }

  gerarDiagnostico(lista);
  atualizarStatsSummary();
}

function gerarDiagnostico(lista) {
  const container = document.getElementById("diagnostico");
  if (!container || !lista.length) return;

  const configs = {
    alta:  { classe: 'diag-alta',  icone: '🔴', desc: 'Crítico — revisar teoria imediatamente' },
    media: { classe: 'diag-media', icone: '🟡', desc: 'Moderado — aumentar volume de questões' },
    baixa: { classe: 'diag-baixa', icone: '🟢', desc: 'Bom — manter revisões periódicas' }
  };

  container.innerHTML = '<div class="diag-list">' +
    [...lista].sort((a, b) => a.pct - b.pct).map(({ nome, pct, prioridade }) => {
      const c = configs[prioridade];
      return `
        <div class="diag-row ${c.classe}" onclick="verDetalheMateria('${nome}')">
          <span class="diag-row-icon">${c.icone}</span>
          <div class="diag-row-body">
            <div class="diag-row-name">${nome}</div>
            <div class="diag-row-desc">${c.desc}</div>
          </div>
          <div class="diag-row-pct">${pct.toFixed(1)}%</div>
        </div>
      `;
    }).join('') + '</div>';
}

function fecharDetalheMateria() {
  document.getElementById('detailPanel')?.classList.remove('open');
  document.getElementById('detailOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  document.querySelectorAll('.performance-card').forEach(c => c.classList.remove('selected'));
}

function verDetalheMateria(nome) {
  const dados = materias[nome];
  if (!dados) return;

  const total = dados.totalAcertos + dados.totalErros;
  const pct = total > 0 ? (dados.totalAcertos / total * 100) : 0;
  const prioridade = calcularPrioridade(pct);
  const metaAtual = metasPorMateria[nome];
  const semana = obterSemanaAtual();
  const progressoAtual = (progressoSemanal[semana] || {})[nome] || 0;
  const metaPct = metaAtual > 0 ? Math.min((progressoAtual / metaAtual) * 100, 100) : 0;

  let ringClass, fillClass, dpClass, prioLabel;
  if (pct < 60)      { ringClass = 'ring-red';    fillClass = 'fill-red';    dpClass = 'dp-red';    prioLabel = '🔴 Prioridade Alta'; }
  else if (pct < 80) { ringClass = 'ring-yellow'; fillClass = 'fill-yellow'; dpClass = 'dp-yellow'; prioLabel = '🟡 Prioridade Média'; }
  else               { ringClass = 'ring-green';  fillClass = 'fill-green';  dpClass = 'dp-green';  prioLabel = '🟢 Bom Desempenho'; }

  const r = 44, sw = 7, circ = 2 * Math.PI * r;
  const ringHtml = `<svg width="100" height="100" viewBox="0 0 100 100">
    <circle class="pc-pct-ring-bg" cx="50" cy="50" r="${r}" stroke-width="${sw}"/>
    <circle class="pc-pct-ring-fill ${ringClass}" cx="50" cy="50" r="${r}" stroke-width="${sw}"
      stroke-dasharray="${circ}" stroke-dashoffset="${circ - (pct/100)*circ}"/>
  </svg>`;

  const revisoesArr = agendaRevisoes
    .filter(ev => ev.materia === nome && ev.tipo === 'Revisão' && !ev.concluido)
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 4);
  const proximas = revisoesArr;
  const revisoesHtml = proximas.length
    ? proximas.map(rv => `<div class="dp-rev-chip">📅 ${new Date(rv.data).toLocaleDateString('pt-BR')}</div>`).join('')
    : '<span style="font-size:12.5px;color:var(--muted);">Nenhuma revisão agendada</span>';

  const metaFillClass = metaPct >= 100 ? 'fill-green' : metaPct >= 50 ? 'fill-yellow' : 'fill-red';

  document.getElementById('dpName').textContent = nome;
  const badge = document.getElementById('dpBadge');
  badge.textContent = prioLabel;
  badge.className = `detail-panel-badge ${dpClass}`;

  const insights = {
    red:    { cls: 'dp-insight-red',    icon: '🔴', text: `<strong>${nome}</strong> está em zona crítica. Recomenda-se revisar a teoria base e resolver no mínimo <strong>20 questões diárias</strong>, focando nos erros mais frequentes.` },
    yellow: { cls: 'dp-insight-yellow', icon: '🟡', text: `<strong>${nome}</strong> tem desempenho moderado. Aumente o volume de questões e dedique tempo extra aos <strong>pontos de maior dificuldade</strong>.` },
    green:  { cls: 'dp-insight-green',  icon: '🟢', text: `<strong>${nome}</strong> está com bom desempenho! Mantenha revisões periódicas e faça <strong>simulados completos</strong> para consolidar o domínio.` },
  };
  const insightKey = pct < 60 ? 'red' : pct < 80 ? 'yellow' : 'green';
  const ins = insights[insightKey];

  document.getElementById('dpBody').innerHTML = `
    <div class="dp-big-ring">
      <div class="dp-ring-wrap">
        ${ringHtml}
        <div class="dp-ring-center">
          <div class="dp-ring-pct" style="color:${pct<60?'var(--danger)':pct<80?'var(--warning)':'var(--success)'}">${pct.toFixed(1)}%</div>
          <div class="dp-ring-lbl">Aproveit.</div>
        </div>
      </div>
      <div class="dp-ring-stats">
        <div class="dp-ring-stat">
          <div class="dp-ring-stat-dot" style="background:var(--success)"></div>
          <div class="dp-ring-stat-val" style="color:var(--success)">${dados.totalAcertos}</div>
          <div class="dp-ring-stat-lbl">Acertos</div>
        </div>
        <div class="dp-ring-stat">
          <div class="dp-ring-stat-dot" style="background:var(--danger)"></div>
          <div class="dp-ring-stat-val" style="color:var(--danger)">${dados.totalErros}</div>
          <div class="dp-ring-stat-lbl">Erros</div>
        </div>
        <div class="dp-ring-stat">
          <div class="dp-ring-stat-dot" style="background:var(--muted)"></div>
          <div class="dp-ring-stat-val" style="color:var(--text-dim)">${total}</div>
          <div class="dp-ring-stat-lbl">Total</div>
        </div>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-title">Análise</div>
      <div class="dp-insight ${ins.cls}">${ins.icon} ${ins.text}</div>
    </div>

    <div class="dp-section">
      <div class="dp-section-title">Aproveitamento</div>
      <div class="dp-bar-wrap">
        <div class="dp-bar-label">
          <span>${dados.totalAcertos} acertos de ${total} questões</span>
          <span style="font-weight:700;color:${pct<60?'var(--danger)':pct<80?'var(--warning)':'var(--success)'}">${pct.toFixed(1)}%</span>
        </div>
        <div class="dp-bar-track"><div class="dp-bar-fill ${fillClass}" style="width:${pct}%"></div></div>
        <div class="dp-bar-sub">${pct < 60 ? '⚠ Abaixo do mínimo recomendado (60%)' : pct < 80 ? '↗ Dentro da faixa de melhoria (60–80%)' : '✔ Acima da meta ideal (80%+)'}</div>
      </div>
    </div>

    ${metaAtual ? `
    <div class="dp-section">
      <div class="dp-section-title">Meta Semanal</div>
      <div class="dp-bar-wrap">
        <div class="dp-bar-label">
          <span>${progressoAtual} de ${metaAtual} questões esta semana</span>
          <span style="font-weight:700">${metaPct.toFixed(0)}%</span>
        </div>
        <div class="dp-bar-track"><div class="dp-bar-fill ${metaFillClass}" style="width:${metaPct}%"></div></div>
        <div class="dp-bar-sub">${metaPct >= 100 ? '✔ Meta da semana atingida!' : `Faltam ${metaAtual - progressoAtual} questões para bater a meta`}</div>
      </div>
    </div>` : ''}

    <div class="dp-section">
      <div class="dp-section-title">Próximas Revisões</div>
      <div class="dp-rev-chips">${revisoesHtml}</div>
    </div>
  `;

  document.getElementById('dpActions').innerHTML = `
    <button class="btn btn-success" style="flex:1" onclick="concluirMateria('${nome}'); fecharDetalheMateria()">✔ Concluir</button>
    <button class="btn btn-danger"  style="flex:1" onclick="excluirMateria('${nome}'); fecharDetalheMateria()">🗑 Excluir</button>
  `;

  document.querySelectorAll('.performance-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.performance-card').forEach(c => {
    if (c.querySelector('.performance-name')?.textContent === nome) c.classList.add('selected');
  });

  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('detailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function concluirMateria(nome) {
  if (!materias[nome]) return;
  if (!confirm(`Marcar "${nome}" como concluída?`)) return;
  materiasConcluidas[nome] = { dados: materias[nome], dataConclusao: new Date().toISOString() };
  delete materias[nome];
  delete metasPorMateria[nome];
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

const MAX_MATERIAS_POR_DIA = 4;

function calcularIntervaloRevisao(prioridade, ordem) {
 const base = prioridade === 'alta' ? 4 : prioridade === 'media' ? 12 : 28;
  return Math.round(base * (ordem === 1 ? 1 : 2.5));
}

function eventosAtivosDeMateria(nome) {
  return agendaRevisoes.filter(ev => ev.materia === nome && !ev.concluido);
}

function contarMateriasNoDia(dataStr) {
  return [...new Set(
    agendaRevisoes
      .filter(ev => !ev.concluido && new Date(ev.data).toISOString().split('T')[0] === dataStr)
      .map(ev => ev.materia)
  )].length;
}

function proximoDiaDisponivel(dataBase, nome) {
  let d = new Date(dataBase);
  for (let i = 0; i < 60; i++) {
    const key = d.toISOString().split('T')[0];
    const jaTemMateria = agendaRevisoes.some(ev =>
      new Date(ev.data).toISOString().split('T')[0] === key && ev.materia === nome
    );
    if (!jaTemMateria && contarMateriasNoDia(key) < MAX_MATERIAS_POR_DIA) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return new Date(dataBase); 
}

function gerarEventosMateria(nome) {
  const dados = materias[nome];
  if (!dados) return false;
  const total = dados.totalAcertos + dados.totalErros;
  if (total === 0) return false;
  if (eventosAtivosDeMateria(nome).length > 0) return false;

  const pct        = (dados.totalAcertos / total) * 100;
  const prioridade = calcularPrioridade(pct);
  const hoje       = new Date(); hoje.setHours(12, 0, 0, 0);
  const durEstudo  = prioridade === 'alta' ? 60 : 40;

  const diaEstudo = proximoDiaDisponivel(hoje, nome);
  agendaRevisoes.push({
    id: crypto.randomUUID(),
    data: diaEstudo.toISOString(),
    tipo: 'Estudo',
    materia: nome,
    duracao: durEstudo,
    prioridade,
    concluido: false,
    reagendamentos: 0
  });

  const baseRev = new Date(diaEstudo);
  for (let ordem = 1; ordem <= 2; ordem++) {
    const offset = calcularIntervaloRevisao(prioridade, ordem);
    const alvo   = new Date(baseRev);
    alvo.setDate(baseRev.getDate() + offset);
    const dia = proximoDiaDisponivel(alvo, nome);
    agendaRevisoes.push({
      id: crypto.randomUUID(),
      data: dia.toISOString(),
      tipo: 'Revisão',
      materia: nome,
      duracao: 30,
      prioridade,
      concluido: false,
      reagendamentos: 0
    });
  }

  return true;
}

function gerarEventosTodasMaterias() {
  let criou = false;
  for (const nome in materias) {
    if (gerarEventosMateria(nome)) criou = true;
  }
  return criou;
}

function criarAgendaInteligente() {
  migrarAgendaRevisoes();
  const criou      = gerarEventosTodasMaterias();
  const ativos     = agendaRevisoes.filter(ev => !ev.concluido);
  const totalDias  = new Set(ativos.map(ev => new Date(ev.data).toISOString().split('T')[0])).size;
  salvarDados(); renderizarGrade(); renderizarProximasRevisoes(); atualizarFiltroMateriaAgenda();
  if (Object.keys(materias).length === 0) {
    toast('Registre matérias antes de gerar a agenda.', 'warning');
  } else if (!criou) {
    toast(`Agenda já atualizada — ${ativos.length} evento(s) ativo(s). Conclua os atuais para gerar o próximo ciclo.`, 'info');
  } else {
    toast(`Agenda gerada! ${ativos.length} evento(s) em ${totalDias} dia(s) — 1 estudo + 2 revisões por matéria ✅`, 'success');
  }
}

function limparAgendaConcluida() {
  const antes = agendaRevisoes.length;
  agendaRevisoes = agendaRevisoes.filter(ev => !ev.concluido);
  const removidos = antes - agendaRevisoes.length;
  salvarDados(); renderizarGrade();
  toast(`${removidos} evento(s) concluído(s) removido(s).`, 'info');
}

function renderizarProximasRevisoes() {
  const container = document.getElementById('gradeRevisoesInteligentes');
  if (!container) return;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const lista = agendaRevisoes
    .filter(ev => ev.tipo === 'Revisão')
    .map(ev => {
      const d = new Date(ev.data); d.setHours(0, 0, 0, 0);
      const status = ev.concluido ? 'concluida'
                   : d < hoje    ? 'atrasada'
                   : d.getTime() === hoje.getTime() ? 'hoje' : 'futura';
      return { ev, d, status };
    })
    .sort((a, b) => a.d - b.d);

  if (!lista.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Nenhuma revisão agendada. Gere a agenda primeiro.</div></div>';
    return;
  }

  const tagLabels = { atrasada: 'Atrasada', hoje: 'Hoje', futura: 'Agendada', concluida: 'Concluída' };

  container.innerHTML = lista.map(({ ev, d, status }) => `
    <div class="rev-card rev-${status} ${ev.concluido ? 'rev-feita' : ''}">
      <div class="rev-info">
        <div class="rev-name">${ev.materia}</div>
        <div class="rev-date">📅 ${d.toLocaleDateString('pt-BR')}</div>
      </div>
      <span class="rev-tag tag-${status}">${tagLabels[status]}</span>
      <div class="rev-btns">
        ${!ev.concluido
          ? `<button class="btn btn-success btn-sm" onclick="marcarRevisaoInteligente('${ev.id}')">✔ Concluir</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="desconcluirRevisaoAgenda('${ev.id}')">↩ Desfazer</button>`
        }
        <button class="btn btn-secondary btn-sm" onclick="recalcularRevisoes('${ev.materia}')" title="Recalcular">🔁</button>
      </div>
    </div>
  `).join('');
}

function marcarRevisaoInteligente(id) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev || ev.tipo !== 'Revisão') return;

  ev.concluido = true;

  if (!historicoRevisoesInteligentes[ev.materia]) historicoRevisoesInteligentes[ev.materia] = [];
  historicoRevisoesInteligentes[ev.materia].push({
    dataOriginal:  ev.data,
    dataConclusao: new Date().toISOString()
  });

  const ativos = eventosAtivosDeMateria(ev.materia);
  if (ativos.length === 0) {
    gerarEventosMateria(ev.materia);
    toast(`Ciclo de "${ev.materia}" concluído! Próximo ciclo gerado 🎯`, 'success');
  } else {
    toast('Revisão concluída! ✅', 'success');
  }

  salvarDados();
  renderizarProximasRevisoes();
  renderizarHistoricoRevisoesInteligentes();
  renderizarGrade();
}

function desconcluirRevisaoAgenda(id) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev) return;
  ev.concluido = false;

  const hist = historicoRevisoesInteligentes[ev.materia];
  if (hist) {
    const idx = hist.findIndex(h => h.dataOriginal === ev.data);
    if (idx >= 0) hist.splice(idx, 1);
    if (hist.length === 0) delete historicoRevisoesInteligentes[ev.materia];
  }

  salvarDados();
  renderizarProximasRevisoes();
  renderizarHistoricoRevisoesInteligentes();
  renderizarGrade();
  toast('Revisão restaurada.', 'info');
}

function recalcularRevisoes(nome) {
  if (!materias[nome]) return;
  if (!confirm(`Recalcular revisões de "${nome}"? Os eventos ativos serão removidos.`)) return;
  agendaRevisoes = agendaRevisoes.filter(ev => !(ev.materia === nome && !ev.concluido));
  gerarEventosMateria(nome);
  salvarDados(); renderizarProximasRevisoes(); renderizarGrade();
  toast('Revisões recalculadas!', 'success');
}

function renderizarHistoricoRevisoesInteligentes() {
  const container = document.getElementById('historicoRevisoesInteligentes');
  if (!container) return;

  let lista = [];
  for (const nome in historicoRevisoesInteligentes) {
    historicoRevisoesInteligentes[nome].forEach((item, index) => {
      lista.push({
        materia:       nome,
        indexOriginal: index,
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
        📅 Prevista: ${item.dataOriginal.toLocaleDateString('pt-BR')}<br>
        ✅ Concluída: ${item.dataConclusao.toLocaleDateString('pt-BR')}
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:9px;" onclick="desconcluirRevisaoHistorico('${item.materia}', ${item.indexOriginal})">↩ Desfazer</button>
    </div>
  `).join('');

  if (lista.length > 5) {
    container.innerHTML += `
      <div style="text-align:center;margin-top:10px;">
        <button class="btn btn-secondary" onclick="toggleHistorico()">
          ${historicoExpandido ? '▲ Ver menos' : '▼ Ver mais'}
        </button>
      </div>`;
  }

  atualizarOpcoesFiltroHistorico();
}

function desconcluirRevisaoHistorico(nome, index) {
  const item = historicoRevisoesInteligentes[nome]?.[index];
  if (!item) return;

  const existeNaAgenda = agendaRevisoes.find(ev =>
    ev.materia === nome && ev.tipo === 'Revisão' && ev.data === item.dataOriginal
  );
  if (existeNaAgenda) {
    existeNaAgenda.concluido = false;
  } else {
    const pct        = (() => { const d = materias[nome]; if (!d) return 50; const t = d.totalAcertos + d.totalErros; return t > 0 ? (d.totalAcertos/t)*100 : 50; })();
    const prioridade = calcularPrioridade(pct);
    agendaRevisoes.push({ id: crypto.randomUUID(), data: item.dataOriginal, tipo: 'Revisão', materia: nome, duracao: 30, prioridade, concluido: false, reagendamentos: 0 });
  }

  historicoRevisoesInteligentes[nome].splice(index, 1);
  if (historicoRevisoesInteligentes[nome].length === 0) delete historicoRevisoesInteligentes[nome];

  salvarDados(); renderizarProximasRevisoes(); renderizarHistoricoRevisoesInteligentes(); renderizarGrade();
  toast('Revisão restaurada.', 'info');
}

function atualizarOpcoesFiltroHistorico() {
  const select = document.getElementById('filtroMateriaHistorico');
  if (!select) return;
  const nomes = Object.keys(historicoRevisoesInteligentes);
  select.innerHTML = `<option value="todas">Todas as matérias</option>`;
  nomes.forEach(nome => { select.innerHTML += `<option value="${nome}">${nome}</option>`; });
  select.value = filtroMateriaHistorico;
}

function atualizarFiltroHistorico() {
  filtroMateriaHistorico = document.getElementById('filtroMateriaHistorico').value;
  historicoExpandido = false;
  renderizarHistoricoRevisoesInteligentes();
}

function toggleHistorico() {
  historicoExpandido = !historicoExpandido;
  renderizarHistoricoRevisoesInteligentes();
}

function _agendaGroupByDay(lista) {
  const map = {};
  (lista || agendaRevisoes).forEach(ev => {
    const key = new Date(ev.data).toISOString().split('T')[0];
    if (!map[key]) map[key] = { carga: 0, eventos: [], materias: new Set() };
    map[key].eventos.push(ev);
    map[key].carga += ev.duracao;
    map[key].materias.add(ev.materia);
  });
  return map;
}

function _atualizarStatsAgenda() {
  const statsEl = document.getElementById('agendaStatsTop');
  if (!statsEl) return;
  if (!agendaRevisoes.length) { statsEl.style.display = 'none'; return; }
  const total   = agendaRevisoes.length;
  const concl   = agendaRevisoes.filter(e => e.concluido).length;
  const dias    = new Set(agendaRevisoes.map(ev => new Date(ev.data).toISOString().split('T')[0])).size;
  const pct     = total > 0 ? Math.round((concl / total) * 100) : 0;
  const cor     = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--accent)';
  statsEl.style.display = 'grid';
  statsEl.querySelector('#astDias').textContent       = dias;
  statsEl.querySelector('#astEventos').textContent    = total;
  statsEl.querySelector('#astConcluidos').textContent = concl;
  const pctEl  = statsEl.querySelector('#astPct');
  const fillEl = statsEl.querySelector('#astMiniFill');
  if (pctEl)  { pctEl.textContent = pct + '%'; pctEl.style.color = cor; }
  if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = cor; }
}

function calcularCargaSemanal() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dom  = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay());
  const sab  = new Date(dom);  sab.setDate(dom.getDate() + 6); sab.setHours(23,59,59,999);
  return agendaRevisoes.filter(ev => { const d = new Date(ev.data); return d >= dom && d <= sab; }).reduce((s, ev) => s + ev.duracao, 0);
}

function atualizarFiltroMateriaAgenda() {
  const sel = document.getElementById('agendaFiltroMateriaSelect');
  if (!sel) return;
  const nomes = [...new Set(agendaRevisoes.map(ev => ev.materia))].sort();
  const atual = sel.value;
  sel.innerHTML = '<option value="todas">Todas as matérias</option>';
  nomes.forEach(n => { sel.innerHTML += `<option value="${n}">${n}</option>`; });
  sel.value = nomes.includes(atual) ? atual : 'todas';
}

function onFiltroMateriaAgendaChange() {
  agendaFiltroMateria = document.getElementById('agendaFiltroMateriaSelect').value;
  renderizarGrade();
}

function reagendarEvento(id, dias) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev) return;
  const d = new Date(ev.data); d.setDate(d.getDate() + dias);
  ev.data = d.toISOString();
  ev.reagendamentos = (ev.reagendamentos || 0) + 1;
  salvarDados(); renderizarGrade();
  toast(`Evento reagendado para ${d.toLocaleDateString('pt-BR')} 📅`, 'info');
}

function excluirEvento(id) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev) return;
  if (!confirm(`Excluir evento de "${ev.materia}" (${ev.tipo})?`)) return;
  agendaRevisoes = agendaRevisoes.filter(e => e.id !== id);
  salvarDados(); renderizarGrade(); renderizarProximasRevisoes();
  toast('Evento excluído.', 'info');
}

function reagendarAtrasados() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split('T')[0];
  const atrasados = agendaRevisoes.filter(ev => !ev.concluido && new Date(ev.data).toISOString().split('T')[0] < hojeStr);
  if (!atrasados.length) { toast('Nenhum evento atrasado!', 'info'); return; }
  if (!confirm(`Mover ${atrasados.length} evento(s) atrasado(s) para hoje?`)) return;
  atrasados.forEach(ev => { ev.data = hoje.toISOString(); ev.reagendamentos = (ev.reagendamentos || 0) + 1; });
  salvarDados(); renderizarGrade();
  toast(`${atrasados.length} evento(s) movido(s) para hoje ✅`, 'success');
}

function marcarDiaInteiro(dataStr) {
  const eventos = agendaRevisoes.filter(ev => new Date(ev.data).toISOString().split('T')[0] === dataStr);
  if (!eventos.length) return;
  const todosConcluidos = eventos.every(e => e.concluido);
  eventos.forEach(e => { e.concluido = !todosConcluidos; });
  const materiasDia = [...new Set(eventos.map(e => e.materia))];
  if (!todosConcluidos) {
    materiasDia.forEach(nome => {
      if (eventosAtivosDeMateria(nome).length === 0) gerarEventosMateria(nome);
    });
  }
  salvarDados(); renderizarGrade(); renderizarProximasRevisoes();
  toast(todosConcluidos ? 'Dia desmarcado.' : 'Dia inteiro concluído! 🎉', todosConcluidos ? 'info' : 'success');
}

function abrirModalEventoManual(dataPreenchida) {
  document.getElementById('modalEventoManual')?.remove();
  const nomes = Object.keys(materias);
  if (!nomes.length) { toast('Registre ao menos uma matéria primeiro.', 'warning'); return; }
  const hojeStr = new Date().toISOString().split('T')[0];
  const dataVal = dataPreenchida || hojeStr;
  const modal   = document.createElement('div');
  modal.id        = 'modalEventoManual';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">➕ Adicionar Evento</span>
        <button class="modal-close" onclick="fecharModalEventoManual()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label>Matéria</label>
          <select id="mevMateria">${nomes.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
        </div>
        <div class="modal-field">
          <label>Tipo</label>
          <div class="modal-radio-group">
            <label class="modal-radio"><input type="radio" name="mevTipo" value="Estudo" checked> 📖 Estudo</label>
            <label class="modal-radio"><input type="radio" name="mevTipo" value="Revisão"> 🔁 Revisão</label>
          </div>
        </div>
        <div class="modal-field">
          <label>Data</label>
          <input type="date" id="mevData" value="${dataVal}" min="${hojeStr}">
        </div>
        <div class="modal-field">
          <label>Duração (min)</label>
          <input type="number" id="mevDuracao" value="40" min="5" max="300" step="5">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="fecharModalEventoManual()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmarEventoManual()">✔ Adicionar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('modal-open'));
}

function fecharModalEventoManual() {
  const m = document.getElementById('modalEventoManual');
  if (!m) return;
  m.classList.remove('modal-open');
  setTimeout(() => m.remove(), 220);
}

function confirmarEventoManual() {
  const nome    = document.getElementById('mevMateria').value;
  const tipo    = document.querySelector('input[name="mevTipo"]:checked').value;
  const data    = document.getElementById('mevData').value;
  const duracao = parseInt(document.getElementById('mevDuracao').value) || 40;
  if (!data) { toast('Escolha uma data.', 'warning'); return; }
  const dataStr    = new Date(data + 'T12:00:00').toISOString().split('T')[0];
  const qtdMatDia  = contarMateriasNoDia(dataStr);
  const jaTemEsta  = agendaRevisoes.some(ev => new Date(ev.data).toISOString().split('T')[0] === dataStr && ev.materia === nome);
  if (!jaTemEsta && qtdMatDia >= MAX_MATERIAS_POR_DIA) {
    if (!confirm(`Este dia já tem ${MAX_MATERIAS_POR_DIA} matérias (limite). Adicionar mesmo assim?`)) return;
  }
  const pct        = (() => { const d = materias[nome]; if (!d) return 50; const t = d.totalAcertos + d.totalErros; return t > 0 ? (d.totalAcertos/t)*100 : 50; })();
  const prioridade = calcularPrioridade(pct);
  agendaRevisoes.push({ id: crypto.randomUUID(), data: new Date(data + 'T12:00:00').toISOString(), tipo, materia: nome, duracao, prioridade, concluido: false, reagendamentos: 0 });
  salvarDados(); renderizarGrade(); renderizarProximasRevisoes(); fecharModalEventoManual();
  toast(`${tipo} de "${nome}" adicionado! ✅`, 'success');
}

function toggleEvMenu(id) {
  const menu = document.getElementById('evMenu_' + id);
  if (!menu) return;
  const aberto = menu.classList.contains('open');
  closeEvMenus();
  if (!aberto) menu.classList.add('open');
}

function closeEvMenus() {
  document.querySelectorAll('.ev-dropdown.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', e => { if (!e.target.closest('.ev-menu-wrap')) closeEvMenus(); });

function _eventoCard(ev) {
  const isEstudo  = ev.tipo === 'Estudo';
  const prioIcon  = ev.prioridade === 'alta' ? '🔴' : ev.prioridade === 'media' ? '🟡' : '🟢';
  const prioClass = 'prio-' + ev.prioridade;
  const reagBadge = ev.reagendamentos > 0 ? `<span class="ev-reag-badge" title="${ev.reagendamentos}x reagendado">↺${ev.reagendamentos}</span>` : '';
  return `
    <div class="agenda-evento ${isEstudo ? 'ev-estudo' : 'ev-revisao'} ${ev.concluido ? 'ev-feito' : ''} ${prioClass}">
      <div class="ev-left">
        <div class="ev-tipo-badge ${isEstudo ? 'badge-estudo' : 'badge-revisao'}">${isEstudo ? '📖 Estudo' : '🔁 Revisão'}</div>
        <div class="ev-materia">${ev.materia}${reagBadge}</div>
      </div>
      <div class="ev-right">
        <span class="ev-prio" title="Prioridade ${ev.prioridade}">${prioIcon}</span>
        <span class="ev-dur">⏱ ${ev.duracao}min</span>
        <button class="ev-btn ${ev.concluido ? 'ev-btn-done' : 'ev-btn-pending'}" onclick="marcarConcluido('${ev.id}')">
          ${ev.concluido ? '✔ Feito' : 'Marcar'}
        </button>
        <div class="ev-menu-wrap">
          <button class="ev-menu-btn" onclick="toggleEvMenu('${ev.id}')">⋮</button>
          <div class="ev-dropdown" id="evMenu_${ev.id}">
            <button onclick="reagendarEvento('${ev.id}', 1); closeEvMenus()">📅 +1 dia</button>
            <button onclick="reagendarEvento('${ev.id}', 3); closeEvMenus()">📅 +3 dias</button>
            <button onclick="reagendarEvento('${ev.id}', 7); closeEvMenus()">📅 +1 semana</button>
            <button class="ev-dd-danger" onclick="excluirEvento('${ev.id}')">🗑 Excluir</button>
          </div>
        </div>
      </div>
    </div>`;
}

function _eventoCardCompact(ev) {
  const isEstudo = ev.tipo === 'Estudo';
  return `
    <div class="ev-pill ${isEstudo ? 'ev-pill-estudo' : 'ev-pill-revisao'} ${ev.concluido ? 'ev-pill-done' : ''}"
         title="${ev.materia} — ${ev.tipo} (${ev.duracao}min)"
         onclick="marcarConcluido('${ev.id}')">
      <span class="evp-dot ${isEstudo ? 'dot-estudo' : 'dot-revisao'}"></span>
      <span class="evp-nome">${ev.materia}</span>
      ${ev.concluido ? '<span class="evp-check">✔</span>' : ''}
    </div>`;
}

function trocarVisualizacaoAgenda(view) {
  agendaView = view;
  closeEvMenus();
  document.getElementById('btnViewLista').classList.toggle('active',  view === 'lista');
  document.getElementById('btnViewSemana').classList.toggle('active', view === 'semana');
  const nav = document.getElementById('semanaNav');
  if (nav) nav.style.display = view === 'semana' ? 'flex' : 'none';
  if (view === 'semana') agendaSemanaOffset = 0;
  renderizarGrade();
}

function navegarSemana(delta) {
  agendaSemanaOffset += delta;
  renderizarGrade();
}

function renderizarGrade() {
  _atualizarStatsAgenda();
  agendaView === 'semana' ? renderizarGradeSemana() : renderizarGradeLista();
}

function renderizarGradeLista() {
  const grade = document.getElementById('grade');
  if (!grade) return;

  if (!agendaRevisoes.length) {
    grade.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Gere a agenda para ver os eventos.</div></div>';
    return;
  }

  const filtrados = agendaFiltroMateria === 'todas'
    ? agendaRevisoes
    : agendaRevisoes.filter(ev => ev.materia === agendaFiltroMateria);

  const agrupado = _agendaGroupByDay(filtrados);
  const hoje     = new Date().toISOString().split('T')[0];
  const dias     = Object.keys(agrupado).sort();

  const cargaSem  = calcularCargaSemanal();
  const atrasados = agendaRevisoes.filter(ev => !ev.concluido && new Date(ev.data).toISOString().split('T')[0] < hoje).length;

  let html = `
    <div class="agenda-barra-filtro">
      <div class="abf-left">
        <select id="agendaFiltroMateriaSelect" class="abf-select" onchange="onFiltroMateriaAgendaChange()">
          <option value="todas">Todas as matérias</option>
        </select>
        ${atrasados > 0 ? `<span class="abf-atrasados">${atrasados} atrasado${atrasados > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="abf-right">
        ${atrasados > 0 ? `<button class="btn btn-secondary btn-sm" onclick="reagendarAtrasados()">⚡ Reagendar atrasados</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="abrirModalEventoManual()">➕ Evento</button>
      </div>
    </div>
    <div class="agenda-carga-semana">
      📆 Carga desta semana: <strong>${cargaSem} min</strong>
      ${cargaSem >= 300 ? ' · 🔥 Semana intensa!' : cargaSem >= 120 ? ' · 👍 Bom ritmo!' : cargaSem > 0 ? ' · 💡 Leve por enquanto.' : ''}
    </div>`;

  if (!dias.length) {
    html += `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">Nenhum evento para este filtro.</div></div>`;
    grade.innerHTML = html;
    atualizarFiltroMateriaAgenda();
    return;
  }

  html += dias.map(data => {
    const info      = agrupado[data];
    const eventos   = info.eventos;
    const matSize   = info.materias.size;
    const isHoje    = data === hoje;
    const isPast    = data < hoje;
    const dataObj   = new Date(data + 'T12:00:00');
    const concl     = eventos.filter(e => e.concluido).length;
    const pctDia    = eventos.length > 0 ? Math.round((concl / eventos.length) * 100) : 0;
    const diaOk     = concl === eventos.length;
    const dataFmt   = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const loadClass = matSize >= MAX_MATERIAS_POR_DIA ? 'load-full' : matSize >= 3 ? 'load-high' : matSize >= 2 ? 'load-med' : 'load-low';
    const loadLabel = matSize >= MAX_MATERIAS_POR_DIA ? '🔴 Cheio' : matSize >= 3 ? '🟡 Ocupado' : matSize >= 2 ? '🟡 Moderado' : '🟢 Leve';
    const fillClass = diaOk ? 'fill-green' : pctDia > 0 ? 'fill-yellow' : 'fill-muted';
    const evHtml    = eventos
      .sort((a, b) => ({ alta:0, media:1, baixa:2 }[a.prioridade] || 0) - ({ alta:0, media:1, baixa:2 }[b.prioridade] || 0))
      .map(ev => _eventoCard(ev)).join('');
    const btnDia  = diaOk
      ? `<button class="dia-action-btn dia-action-desfazer" onclick="marcarDiaInteiro('${data}')">↩ Desmarcar tudo</button>`
      : `<button class="dia-action-btn dia-action-marcar"   onclick="marcarDiaInteiro('${data}')">✔ Marcar tudo</button>`;

    return `
      <div class="dia-card-new ${isHoje ? 'dia-hoje' : ''} ${diaOk ? 'dia-completo' : ''} ${isPast && !diaOk ? 'dia-passado' : ''}">
        <div class="dia-header-new">
          <div class="dia-header-left">
            ${isHoje ? '<span class="dia-hoje-badge">HOJE</span>' : ''}
            ${isPast && !diaOk ? '<span class="dia-atrasado-badge">ATRASADO</span>' : ''}
            <span class="dia-nome">${dataFmt}</span>
          </div>
          <div class="dia-header-right">
            <span class="dia-load-badge ${loadClass}">${loadLabel}</span>
            <span class="dia-count">${matSize}/${MAX_MATERIAS_POR_DIA} mat.</span>
          </div>
        </div>
        <div class="dia-prog-row">
          <div class="dia-prog-track"><div class="dia-prog-fill ${fillClass}" style="width:${pctDia}%"></div></div>
          <span class="dia-prog-pct">${pctDia}%</span>
        </div>
        <div class="dia-eventos">${evHtml}</div>
        <div class="dia-footer">
          <span>⏱ ${info.carga} min</span>
          <div class="dia-footer-actions">
            ${btnDia}
            <button class="dia-action-btn dia-action-add" onclick="abrirModalEventoManual('${data}')" title="Adicionar evento neste dia">＋</button>
          </div>
        </div>
      </div>`;
  }).join('');

  grade.innerHTML = html;
  atualizarFiltroMateriaAgenda();
}

function renderizarGradeSemana() {
  const grade = document.getElementById('grade');
  if (!grade) return;

  const hoje    = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().split('T')[0];
  const dom     = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay());
  dom.setDate(dom.getDate() + agendaSemanaOffset * 7);

  const semana  = Array.from({ length: 7 }, (_, i) => { const d = new Date(dom); d.setDate(dom.getDate() + i); return d; });
  const agrupado = _agendaGroupByDay();
  const diasNomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const fmtR  = d => d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
  const label = `${fmtR(semana[1])} – ${fmtR(semana[6])}, ${semana[1].getFullYear()}`;
  const labelEl = document.getElementById('semanaNavLabel');
  if (labelEl) labelEl.textContent = label;

  const temEventos = semana.some(d => (agrupado[d.toISOString().split('T')[0]]?.eventos.length || 0) > 0);

  const cols = semana.map((dObj, idx) => {
    const dStr    = dObj.toISOString().split('T')[0];
    const info    = agrupado[dStr];
    const isHoje  = dStr === hojeStr;
    const isPast  = dStr < hojeStr;
    const isFds   = idx === 0 || idx === 6;
    const eventos = info?.eventos || [];
    const concl   = eventos.filter(e => e.concluido).length;
    const diaOk   = eventos.length > 0 && concl === eventos.length;
    const pills   = eventos
      .sort((a, b) => ({ alta:0, media:1, baixa:2 }[a.prioridade] || 0) - ({ alta:0, media:1, baixa:2 }[b.prioridade] || 0))
      .map(ev => _eventoCardCompact(ev)).join('');

    return `
      <div class="sem-col ${isHoje ? 'sem-hoje' : ''} ${isPast ? 'sem-passado' : ''} ${diaOk ? 'sem-completo' : ''} ${isFds ? 'sem-fds' : ''}">
        <div class="sem-col-header">
          <span class="sem-dia-nome">${diasNomes[idx]}</span>
          <span class="sem-dia-num ${isHoje ? 'num-hoje' : ''}">${dObj.getDate()}</span>
          ${isHoje ? '<span class="sem-hoje-dot"></span>' : ''}
        </div>
        <div class="sem-col-body">
          ${pills || `<div class="sem-vazio">${isPast ? '—' : ''}</div>`}
        </div>
        ${info?.carga ? `<div class="sem-col-footer">⏱ ${info.carga}min</div>` : ''}
      </div>`;
  }).join('');

  grade.innerHTML = `
    <div class="semana-grid">${cols}</div>
    ${!temEventos ? `<div class="sem-empty-week"><span>📭</span> Nenhum evento nesta semana.<br><small>Navegue ou gere a agenda.</small></div>` : ''}
    <div class="sem-legenda">
      <span class="sem-leg-item"><span class="evp-dot dot-estudo"></span> Estudo</span>
      <span class="sem-leg-item"><span class="evp-dot dot-revisao"></span> Revisão</span>
      <span class="sem-leg-item">🔴 Alta · 🟡 Média · 🟢 Baixa</span>
      <span class="sem-leg-item sem-leg-done"><span class="evp-check">✔</span> Feito</span>
    </div>`;
}

function marcarConcluido(id) {
  const ev = agendaRevisoes.find(e => e.id === id);
  if (!ev) return;
  ev.concluido = !ev.concluido;

  if (ev.tipo === 'Revisão') {
    if (ev.concluido) {
      if (!historicoRevisoesInteligentes[ev.materia]) historicoRevisoesInteligentes[ev.materia] = [];
      const jaNoHist = historicoRevisoesInteligentes[ev.materia].some(h => h.dataOriginal === ev.data);
      if (!jaNoHist) {
        historicoRevisoesInteligentes[ev.materia].push({ dataOriginal: ev.data, dataConclusao: new Date().toISOString() });
      }
    } else {
      const hist = historicoRevisoesInteligentes[ev.materia];
      if (hist) {
        const idx = hist.findIndex(h => h.dataOriginal === ev.data);
        if (idx >= 0) hist.splice(idx, 1);
        if (hist.length === 0) delete historicoRevisoesInteligentes[ev.materia];
      }
    }
  }

  if (ev.concluido && eventosAtivosDeMateria(ev.materia).length === 0) {
    gerarEventosMateria(ev.materia);
    toast(`Ciclo de "${ev.materia}" concluído! Próximo ciclo gerado 🎯`, 'success');
  }

  salvarDados(); renderizarGrade(); renderizarProximasRevisoes();
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
    agendaRevisoes, historicoRevisoesInteligentes, materiasConcluidas,
    semanaUltimaVista, streakDias, ultimoDiaEstudo, pomoSessoes
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
  streakDias                    = p.streakDias                    || 0;
  ultimoDiaEstudo               = p.ultimoDiaEstudo               || null;
  pomoSessoes                   = p.pomoSessoes                   || [];
  semanaUltimaVista             = p.semanaUltimaVista ?? obterSemanaAtual();

  for (let nome in materias) {
    if (metasPorMateria[nome] === undefined) metasPorMateria[nome] = metaAutomatica(nome);
  }

  migrarAgendaRevisoes();

  limparMetasOrfas();
}

function migrarAgendaRevisoes() {
  const materiasList = [...new Set(agendaRevisoes.map(ev => ev.materia))];

  materiasList.forEach(nome => {
    const ativos    = agendaRevisoes.filter(ev => ev.materia === nome && !ev.concluido);
    const estudos   = ativos.filter(ev => ev.tipo === 'Estudo')
                            .sort((a, b) => new Date(a.data) - new Date(b.data));
    const revisoes  = ativos.filter(ev => ev.tipo === 'Revisão')
                            .sort((a, b) => new Date(a.data) - new Date(b.data));

    const estudosExcesso = estudos.slice(1).map(e => e.id);
    const revisoesExcesso = revisoes.slice(2).map(e => e.id);

    const remover = new Set([...estudosExcesso, ...revisoesExcesso]);
    if (remover.size > 0) {
      agendaRevisoes = agendaRevisoes.filter(ev => !remover.has(ev.id));
    }
  });
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
  if (e.key === 'Enter' && document.activeElement.id === 'erros') {
    registrarBloco();
  }
  if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
    const abas = ['desempenho','metas','revisoes','agenda','pomodoro','dashboard','configuracoes'];
    const idx  = parseInt(e.key) - 1;
    if (abas[idx]) mostrarPainel(abas[idx]);
    e.preventDefault();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  carregarDados();
  aplicarTemaSalvo();
  detectarTrocaDeSemanaEFechar();
  gerarEventosTodasMaterias();

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
