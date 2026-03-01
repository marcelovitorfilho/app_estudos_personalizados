/* ================================
   PLANNER - SCRIPT.JS (PRONTO)
   - Metas persistem após recarregar
   - Remove chamada de função inexistente atualizarMeta()
   - Evita duplicidade de marcarConcluido (só 1 função)
   - Garante metas automáticas para matérias existentes ao carregar
   - Pomodoro funcional (40/5/15)
================================ */

/* ================================
   ESTADO GLOBAL
================================ */

let agendaRevisoes = [];
let materias = {};
let revisoesGeradasPorMateria = {};
const QUESTOES_POR_REVISAO = 20;

let metasPorMateria = {};
let historicoMetas = {};
let progressoSemanal = {};

/* ================================
   HELPERS
================================ */

function calcularPrioridade(percentual) {
  if (percentual < 60) return "alta";
  if (percentual < 80) return "media";
  return "baixa";
}

function limparCampos() {
  document.getElementById("materia").value = "";
  document.getElementById("acertos").value = "";
  document.getElementById("erros").value = "";
}

function obterSemanaAtual() {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
  return Math.ceil((hoje.getDay() + 1 + dias) / 7);
}

/* ================================
   METAS (AUTO + PERSISTÊNCIA)
================================ */

function metaAutomatica(nome) {
  const dados = materias[nome];
  const totalResolvido = (dados?.totalAcertos || 0) + (dados?.totalErros || 0);

  if (totalResolvido === 0) return 10;

  const percentual = (dados.totalAcertos / totalResolvido) * 100;
  let metaBase;

  if (percentual < 60) metaBase = Math.ceil(totalResolvido * 0.5);
  else if (percentual < 80) metaBase = Math.ceil(totalResolvido * 0.35);
  else metaBase = Math.ceil(totalResolvido * 0.25);

  if (metaBase < 10) metaBase = 10;
  return metaBase;
}

function gerarMetasAutomaticas() {
  const novas = {};

  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    if (total === 0) continue;
    novas[nome] = metaAutomatica(nome);
  }

  metasPorMateria = novas;
  atualizarMetasVisuais();
  salvarDados();
  atualizarDashboard();
}

function limparMetasOrfas() {
  for (let nome in metasPorMateria) {
    if (!materias[nome]) delete metasPorMateria[nome];
  }
}

function registrarProgressoSemanal(nome, quantidade) {
  const semana = obterSemanaAtual();
  if (!progressoSemanal[semana]) progressoSemanal[semana] = {};
  if (!progressoSemanal[semana][nome]) progressoSemanal[semana][nome] = 0;
  progressoSemanal[semana][nome] += quantidade;
}

function atualizarMetasVisuais() {
  const container = document.getElementById("progressoMeta");
  if (!container) return;

  container.innerHTML = "";

  const semana = obterSemanaAtual();
  const progressoAtual = progressoSemanal[semana] || {};

  if (Object.keys(metasPorMateria).length === 0) {
    container.innerHTML = "<p>Nenhuma meta definida.</p>";
    return;
  }

  const listaMetas = Object.keys(metasPorMateria).map(nome => {
    const meta = metasPorMateria[nome];
    const feito = progressoAtual[nome] || 0;
    const percentual = meta > 0 ? (feito / meta) * 100 : 0;
    return { nome, meta, feito, percentual };
  });

  listaMetas.sort((a, b) => b.percentual - a.percentual);

  listaMetas.forEach(item => {
    let statusClasse = "";
    let statusTexto = "";

    if (item.percentual < 50) {
      statusClasse = "meta-atrasado";
      statusTexto = "Abaixo do esperado";
    } else if (item.percentual < 100) {
      statusClasse = "meta-ritmo";
      statusTexto = "No ritmo";
    } else {
      statusClasse = "meta-batida";
      statusTexto = "Meta concluída";
    }

    container.innerHTML += `
      <div class="meta-card-novo">
        <div class="meta-header">
          <h4>${item.nome}</h4>
          <span class="meta-status ${statusClasse}">${statusTexto}</span>
        </div>

        <div class="meta-numeros">
          <span>${item.feito} / ${item.meta} questões</span>
          <span>${item.percentual.toFixed(1)}%</span>
        </div>

        <div class="meta-barra">
          <div class="meta-preenchimento" style="width:${Math.min(item.percentual, 100)}%"></div>
        </div>

        <div class="meta-acoes">
          <button onclick="editarMeta('${item.nome}')">Alterar Meta</button>
          <button onclick="excluirMeta('${item.nome}')" class="btn-excluir">Excluir Meta</button>
        </div>
      </div>
    `;
  });
}

function excluirMeta(nome) {
  if (!metasPorMateria[nome]) return;
  if (!confirm(`Deseja realmente excluir a meta de ${nome}?`)) return;

  delete metasPorMateria[nome];
  salvarDados();
  atualizarMetasVisuais();
  atualizarDashboard();
}

function editarMeta(nome) {
  const metaAtual = metasPorMateria[nome];
  const novaMeta = prompt(`Digite a nova meta semanal para ${nome}:`, metaAtual);

  if (novaMeta === null) return;

  const valor = parseInt(novaMeta, 10);
  if (isNaN(valor) || valor <= 0) {
    alert("Digite um número válido.");
    return;
  }

  metasPorMateria[nome] = valor;
  salvarDados();
  atualizarMetasVisuais();
  atualizarDashboard();
}

/* ================================
   HISTÓRICO DE METAS (CORRIGIDO)
   - Salva semana anterior automaticamente ao detectar troca de semana
   - Tem botão para fechar manualmente
================================ */

// guarda qual semana foi a última vista pelo sistema
let semanaUltimaVista = null;

function obterSnapshotSemana(semana) {
  return {
    metas: { ...metasPorMateria },
    progresso: { ...(progressoSemanal[semana] || {}) },
    dataFechamentoISO: new Date().toISOString()
  };
}

function salvarHistoricoSemana(semanaParaSalvar) {
  if (!semanaParaSalvar) return;

  // evita sobrescrever histórico já salvo
  if (historicoMetas[semanaParaSalvar]) return;

  historicoMetas[semanaParaSalvar] = obterSnapshotSemana(semanaParaSalvar);
}

function detectarTrocaDeSemanaEFechar() {
  const semanaAtual = obterSemanaAtual();

  // primeira execução após abrir o site
  if (semanaUltimaVista === null) {
    semanaUltimaVista = semanaAtual;
    return;
  }

  // se mudou de semana (ex: abriu na terça e a semana já virou)
  if (semanaAtual !== semanaUltimaVista) {
    // salva a semana que terminou (semanaUltimaVista)
    salvarHistoricoSemana(semanaUltimaVista);

    // zera progresso da semana nova (semanaAtual), mantendo as metas
    progressoSemanal[semanaAtual] = progressoSemanal[semanaAtual] || {};

    // atualiza marcador
    semanaUltimaVista = semanaAtual;

    salvarDados();
    atualizarHistorico();
    atualizarMetasVisuais();
    atualizarDashboard();
  }
}

// botão manual
function fecharSemanaAgora() {
  const semanaAtual = obterSemanaAtual();

  // Salvar a semana atual como histórico (semana que você quer “fechar”)
  if (!confirm(`Salvar a Semana ${semanaAtual} no histórico e zerar o progresso dela?`)) return;

  // salva snapshot da semana atual
  historicoMetas[semanaAtual] = obterSnapshotSemana(semanaAtual);

  // zera progresso da semana atual
  progressoSemanal[semanaAtual] = {};

  salvarDados();
  atualizarHistorico();
  atualizarMetasVisuais();
  atualizarDashboard();

  alert(`Semana ${semanaAtual} salva no histórico ✅`);
}

function atualizarHistorico() {
  const container = document.getElementById("historicoMetas");
  if (!container) return;

  container.innerHTML = "";

  const semanas = Object.keys(historicoMetas)
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => b - a); // mais recente primeiro

  if (semanas.length === 0) {
    container.innerHTML = "<p>Nenhum histórico ainda. Clique em “Fechar Semana”.</p>";
    return;
  }

  semanas.forEach(semana => {
    const dados = historicoMetas[semana];
    const metas = dados.metas || {};
    const prog = dados.progresso || {};
    const dataFechamento = dados.dataFechamentoISO
      ? new Date(dados.dataFechamentoISO).toLocaleDateString("pt-BR")
      : "";

    let html = `
      <div class="historico-card">
        <h4>Semana ${semana} ${dataFechamento ? `• Fechada em ${dataFechamento}` : ""}</h4>
    `;

    const materiasSemana = Object.keys(metas);

    if (materiasSemana.length === 0) {
      html += `<p>Sem metas registradas nesta semana.</p>`;
    } else {
      materiasSemana.forEach(nome => {
        const meta = metas[nome] || 0;
        const feito = prog[nome] || 0;
        const percentual = meta > 0 ? ((feito / meta) * 100).toFixed(1) : "0.0";
        html += `<p><strong>${nome}</strong>: ${feito}/${meta} (${percentual}%)</p>`;
      });
    }

    html += `</div>`;
    container.innerHTML += html;
  });
}
/* ================================
   DESEMPENHO
================================ */

function registrarBloco() {
  const nome = document.getElementById("materia").value.trim();
  const acertos = parseInt(document.getElementById("acertos").value, 10);
  const erros = parseInt(document.getElementById("erros").value, 10);

  if (!nome || isNaN(acertos) || isNaN(erros)) return;

  if (!materias[nome]) {
    materias[nome] = { totalAcertos: 0, totalErros: 0 };
  }

  materias[nome].totalAcertos += acertos;
  materias[nome].totalErros += erros;

  // ✅ cria meta para a matéria se ainda não existir
  if (metasPorMateria[nome] === undefined) {
    metasPorMateria[nome] = metaAutomatica(nome);
  }

  gerarRevisoesExtrasPorVolume(nome);

  const totalBloco = acertos + erros;
  registrarProgressoSemanal(nome, totalBloco);

  atualizarDesempenho();
  atualizarMetasVisuais();
  limparCampos();

  salvarDados();
  atualizarDashboard();
  renderizarGrade();
}

function excluirMateria(nome) {
  delete materias[nome];
  // remove meta órfã imediatamente
  if (metasPorMateria[nome] !== undefined) delete metasPorMateria[nome];

  salvarDados();
  atualizarDesempenho();
  atualizarMetasVisuais();
  atualizarDashboard();
  renderizarGrade();
}

function atualizarDesempenho() {
  const container = document.getElementById("tabelaDesempenho");
  const diagnostico = document.getElementById("diagnostico");
  if (!container || !diagnostico) return;

  container.innerHTML = "";
  diagnostico.innerHTML = "";

  if (Object.keys(materias).length === 0) {
    container.innerHTML = "<p>Nenhuma matéria cadastrada.</p>";
    return;
  }

  const listaPrioridades = [];

  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;

    const percentual = total > 0 ? ((dados.totalAcertos / total) * 100).toFixed(1) : "0.0";
    const prioridade = calcularPrioridade(parseFloat(percentual));

    listaPrioridades.push({
      nome,
      percentual: parseFloat(percentual),
      prioridade
    });

    let statusClasse = "";
    let statusTexto = "";

    if (parseFloat(percentual) < 60) {
      statusClasse = "status-critico";
      statusTexto = "Precisa reforçar";
    } else if (parseFloat(percentual) < 80) {
      statusClasse = "status-bom";
      statusTexto = "Desempenho moderado";
    } else {
      statusClasse = "status-excelente";
      statusTexto = "Excelente domínio";
    }

    container.innerHTML += `
      <div class="performance-card">
        <div class="performance-header">
          <h3>${nome}</h3>
          <span class="priority-badge">Prioridade ${prioridade.toUpperCase()}</span>
        </div>

        <div class="performance-stats">
          <div><strong>${dados.totalAcertos}</strong><small>Acertos</small></div>
          <div><strong>${dados.totalErros}</strong><small>Erros</small></div>
          <div><strong>${percentual}%</strong><small>Aproveitamento</small></div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar" style="width:${percentual}%"></div>
        </div>

        <div class="performance-status ${statusClasse}">${statusTexto}</div>

        <br>
        <button onclick="excluirMateria('${nome}')">Excluir Matéria</button>
      </div>
    `;
  }

  gerarDiagnostico(listaPrioridades);
}

function gerarDiagnostico(lista) {
  const container = document.getElementById("diagnostico");
  if (!container) return;

  container.innerHTML = "";

  if (!lista || lista.length === 0) {
    container.innerHTML = "<p>Nenhuma análise disponível.</p>";
    return;
  }

  lista.sort((a, b) => a.percentual - b.percentual);

  lista.forEach(item => {
    let classe = "";
    let titulo = "";
    let plano = "";
    let icone = "";

    if (item.prioridade === "alta") {
      classe = "diag-alta";
      titulo = "Desempenho Crítico";
      plano = "Revisar teoria imediatamente + resolver 20 questões diárias focadas em erros.";
      icone = "🔴";
    } else if (item.prioridade === "media") {
      classe = "diag-media";
      titulo = "Desempenho Moderado";
      plano = "Aumentar volume de questões e revisar os principais erros cometidos.";
      icone = "🟡";
    } else {
      classe = "diag-baixa";
      titulo = "Bom Desempenho";
      plano = "Manter revisões periódicas e simulados para consolidar domínio.";
      icone = "🟢";
    }

    container.innerHTML += `
      <div class="diagnostico-card ${classe}">
        <div class="diag-header">
          <div class="diag-titulo">
            <span class="diag-icone">${icone}</span>
            <h4>${item.nome}</h4>
          </div>
          <span class="diag-percentual">${item.percentual}%</span>
        </div>

        <div class="diag-body">
          <strong>${titulo}</strong>
          <p>${plano}</p>
        </div>
      </div>
    `;
  });
}

/* ================================
   GRADE / AGENDA
================================ */

function criarRevisaoSeNaoExiste(nome, prioridade, dataObj) {
  const existe = agendaRevisoes.some(ev =>
    ev.materia === nome &&
    ev.tipo === "Revisão" &&
    new Date(ev.data).toDateString() === dataObj.toDateString()
  );
  if (existe) return false;

  agendaRevisoes.push({
    id: crypto.randomUUID(),
    data: dataObj.toISOString(),
    tipo: "Revisão",
    materia: nome,
    duracao: 30,
    prioridade,
    concluido: false,
    reagendamentos: 0
  });

  return true;
}

function gerarDatasRevisaoBase(prioridade) {
  if (prioridade === "alta") return [3, 7];
  if (prioridade === "media") return [7, 14];
  return [14, 30];
}

function gerar2RevisoesIniciaisPorMateria() {
  const hoje = new Date();
  const limiteFinal = new Date();
  limiteFinal.setMonth(limiteFinal.getMonth() + 3);

  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    if (total === 0) continue;

    const percentual = (dados.totalAcertos / total) * 100;
    const prioridade = calcularPrioridade(percentual);

    if (!revisoesGeradasPorMateria[nome]) revisoesGeradasPorMateria[nome] = 0;

    const baseOffsets = gerarDatasRevisaoBase(prioridade);

    for (let i = 0; i < baseOffsets.length; i++) {
      if (revisoesGeradasPorMateria[nome] >= 2) break;

      const d = new Date(hoje);
      d.setDate(d.getDate() + baseOffsets[i]);

      if (d > limiteFinal) continue;

      const criada = criarRevisaoSeNaoExiste(nome, prioridade, d);
      if (criada) revisoesGeradasPorMateria[nome] += 1;
    }
  }
}

function criarAgendaInteligente() {
  const hoje = new Date();
  const limiteFinal = new Date();
  limiteFinal.setMonth(limiteFinal.getMonth() + 3);

  // mantém apenas eventos futuros
  agendaRevisoes = agendaRevisoes.filter(ev => new Date(ev.data) >= hoje);

  for (let nome in materias) {
    const dados = materias[nome];
    const total = dados.totalAcertos + dados.totalErros;
    if (total === 0) continue;

    const percentual = (dados.totalAcertos / total) * 100;
    const prioridade = calcularPrioridade(percentual);
    const duracaoEstudo = prioridade === "alta" ? 60 : 40;

    const jaExiste = agendaRevisoes.some(ev =>
      ev.tipo === "Estudo" &&
      ev.materia === nome &&
      new Date(ev.data).toDateString() === hoje.toDateString()
    );

    if (!jaExiste) {
      agendaRevisoes.push({
        id: crypto.randomUUID(),
        data: hoje.toISOString(),
        tipo: "Estudo",
        materia: nome,
        duracao: duracaoEstudo,
        prioridade,
        concluido: false,
        reagendamentos: 0
      });
    }

    let dataRevisao = new Date(hoje);

    while (dataRevisao < limiteFinal) {
      let intervalo;
      if (prioridade === "alta") intervalo = 3 + Math.floor(Math.random() * 5);
      else if (prioridade === "media") intervalo = 10 + Math.floor(Math.random() * 6);
      else intervalo = 30 + Math.floor(Math.random() * 16);

      dataRevisao = new Date(dataRevisao);
      dataRevisao.setDate(dataRevisao.getDate() + intervalo);

      if (dataRevisao > limiteFinal) break;

      const existe = agendaRevisoes.some(ev =>
        ev.materia === nome &&
        ev.tipo === "Revisão" &&
        new Date(ev.data).toDateString() === dataRevisao.toDateString()
      );

      if (!existe) {
        agendaRevisoes.push({
          id: crypto.randomUUID(),
          data: dataRevisao.toISOString(),
          tipo: "Revisão",
          materia: nome,
          duracao: 30,
          prioridade,
          concluido: false,
          reagendamentos: 0
        });
      }
    }
  }

  gerar2RevisoesIniciaisPorMateria();
  salvarDados();
  renderizarGrade();
}

function verificarRevisoesAtrasadas() {
  const hoje = new Date();

  agendaRevisoes = agendaRevisoes.map(evento => {
    if (!evento.concluido) {
      const dataEvento = new Date(evento.data);
      if (dataEvento < hoje) {
        const novaData = new Date(hoje);
        novaData.setDate(novaData.getDate() + 3);
        evento.data = novaData.toISOString();
        evento.reagendamentos = (evento.reagendamentos || 0) + 1;
      }
    }
    return evento;
  });

  salvarDados();
}

function renderizarGrade() {
  const grade = document.getElementById("grade");
  if (!grade) return;

  grade.innerHTML = "";

  const agenda = {};
  agendaRevisoes.forEach(ev => {
    const dataKey = new Date(ev.data).toISOString().split("T")[0];
    if (!agenda[dataKey]) agenda[dataKey] = { carga: 0, eventos: [] };
    agenda[dataKey].eventos.push(ev);
    agenda[dataKey].carga += ev.duracao;
  });

  const datasOrdenadas = Object.keys(agenda).sort();
  datasOrdenadas.forEach(data => {
    const dataObj = new Date(data);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR");

    grade.innerHTML += `<div class="dia-card"><h3>${dataFormatada}</h3>`;

    agenda[data].eventos.forEach(ev => {
      grade.innerHTML += `
        <div class="evento ${ev.tipo === "Estudo" ? "estudo" : "revisao"} ${ev.concluido ? "feito" : ""}">
          <span>${ev.tipo}</span>
          <span>${ev.materia}</span>
          <span>${ev.duracao} min</span>
          <button onclick="marcarConcluido('${ev.id}')">${ev.concluido ? "✔" : "Marcar"}</button>
        </div>
      `;
    });

    grade.innerHTML += `<div class="carga-dia">Carga total: ${agenda[data].carga} min</div></div>`;
  });
}

// ✅ APENAS 1 FUNÇÃO (SEM DUPLICAR)
function marcarConcluido(id) {
  const evento = agendaRevisoes.find(ev => ev.id === id);
  if (!evento) return;

  evento.concluido = !evento.concluido;
  salvarDados();
  renderizarGrade();
}

function gerarRevisoesExtrasPorVolume(nome) {
  const hoje = new Date();
  const limiteFinal = new Date();
  limiteFinal.setMonth(limiteFinal.getMonth() + 3);

  const dados = materias[nome];
  const total = dados.totalAcertos + dados.totalErros;
  if (total === 0) return;

  const percentual = (dados.totalAcertos / total) * 100;
  const prioridade = calcularPrioridade(percentual);

  const revisoesDesejadas = Math.floor(total / QUESTOES_POR_REVISAO);
  const jaGeradas = revisoesGeradasPorMateria[nome] || 0;
  const faltam = revisoesDesejadas - jaGeradas;

  if (faltam <= 0) return;

  for (let k = 0; k < faltam; k++) {
    let salto;
    if (prioridade === "alta") salto = 5;
    else if (prioridade === "media") salto = 10;
    else salto = 15;

    const revisoesDaMateria = agendaRevisoes
      .filter(ev => ev.tipo === "Revisão" && ev.materia === nome)
      .map(ev => new Date(ev.data))
      .sort((a, b) => a - b);

    let base = revisoesDaMateria.length ? revisoesDaMateria[revisoesDaMateria.length - 1] : hoje;

    let tentativa = new Date(base);
    let criada = false;

    for (let tent = 0; tent < 30; tent++) {
      tentativa = new Date(tentativa);
      tentativa.setDate(tentativa.getDate() + salto);

      if (tentativa > limiteFinal) break;

      if (criarRevisaoSeNaoExiste(nome, prioridade, tentativa)) {
        criada = true;
        break;
      } else {
        tentativa = new Date(tentativa);
        tentativa.setDate(tentativa.getDate() + 1);
      }
    }

    if (criada) {
      revisoesGeradasPorMateria[nome] = (revisoesGeradasPorMateria[nome] || 0) + 1;
    } else {
      break;
    }
  }
}

/* ================================
   DASHBOARD (Chart.js)
================================ */

let graficoProgresso = null;
let graficoMeta = null;

function atualizarDashboard() {
  const semana = obterSemanaAtual();
  const progressoAtual = progressoSemanal[semana] || {};

  const labels = [];
  const dadosFeitos = [];
  const dadosPercentual = [];

  for (let nome in metasPorMateria) {
    labels.push(nome);

    const meta = metasPorMateria[nome] || 0;
    const feito = progressoAtual[nome] || 0;

    dadosFeitos.push(feito);
    dadosPercentual.push(meta > 0 ? ((feito / meta) * 100).toFixed(1) : 0);
  }

  const ctx1 = document.getElementById("graficoProgresso");
  const ctx2 = document.getElementById("graficoDesempenho");
  if (!ctx1 || !ctx2) return;

  if (graficoProgresso) graficoProgresso.destroy();
  if (graficoMeta) graficoMeta.destroy();

  graficoProgresso = new Chart(ctx1, {
    type: "bar",
    data: { labels, datasets: [{ label: "Questões Resolvidas", data: dadosFeitos }] },
    options: { responsive: true, animation: false }
  });

  graficoMeta = new Chart(ctx2, {
    type: "bar",
    data: { labels, datasets: [{ label: "% da Meta", data: dadosPercentual }] },
    options: { responsive: true, animation: false }
  });
}

/* ================================
   LOCAL STORAGE
================================ */

function salvarDados() {
  localStorage.setItem("planner_dados", JSON.stringify({
    materias,
    metasPorMateria,
    historicoMetas,
    progressoSemanal,
    agendaRevisoes,
    revisoesGeradasPorMateria,
    semanaUltimaVista
  }));
}
function carregarDados() {
  const dados = localStorage.getItem("planner_dados");
  if (!dados) return;

  const parsed = JSON.parse(dados);

  materias = parsed.materias || {};
  metasPorMateria = parsed.metasPorMateria || {};
  historicoMetas = parsed.historicoMetas || {};
  progressoSemanal = parsed.progressoSemanal || {};
  agendaRevisoes = parsed.agendaRevisoes || [];
  revisoesGeradasPorMateria = parsed.revisoesGeradasPorMateria || {};

  semanaUltimaVista = parsed.semanaUltimaVista ?? obterSemanaAtual();

  for (let nome in materias) {
    if (metasPorMateria[nome] === undefined) {
      metasPorMateria[nome] = metaAutomatica(nome);
    }
  }

  limparMetasOrfas();
  salvarDados();
}

/* ================================
   POMODORO
   (HTML chama: pomodoroIniciar(), pomodoroPausar(), pomodoroReset(), pomodoroPular())
================================ */

const POMO = {
  focoMin: 40,
  pausaCurtaMin: 5,
  pausaLongaMin: 15,
  ciclosParaPausaLonga: 4
};

let pomoIntervalo = null;
let pomoRodando = false;

let pomoEtapa = "foco"; // "foco" | "curta" | "longa"
let pomoSegundos = POMO.focoMin * 60;
let pomoCiclosConcluidos = 0;

function pomoFormatar(seg) {
  const m = String(Math.floor(seg / 60)).padStart(2, "0");
  const s = String(seg % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function pomoUI() {
  const el = document.getElementById("timer");
  if (el) el.innerText = pomoFormatar(pomoSegundos);

  const st = document.getElementById("pomodoroStatus");
  if (st) {
    st.innerText =
      pomoEtapa === "foco" ? "Foco" :
      pomoEtapa === "curta" ? "Pausa curta" :
      "Pausa longa";
  }
}

function pomoDefinirEtapa(etapa) {
  pomoEtapa = etapa;

  if (etapa === "foco") pomoSegundos = POMO.focoMin * 60;
  if (etapa === "curta") pomoSegundos = POMO.pausaCurtaMin * 60;
  if (etapa === "longa") pomoSegundos = POMO.pausaLongaMin * 60;

  pomoUI();
}

function pomoBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 180);
  } catch (e) {}
}

function pomoAvancar() {
  pomoBeep();

  if (pomoEtapa === "foco") {
    pomoCiclosConcluidos++;

    if (pomoCiclosConcluidos % POMO.ciclosParaPausaLonga === 0) {
      pomoDefinirEtapa("longa");
    } else {
      pomoDefinirEtapa("curta");
    }
  } else {
    pomoDefinirEtapa("foco");
  }
}

function pomoTick() {
  if (!pomoRodando) return;

  pomoSegundos--;

  if (pomoSegundos <= 0) {
    pomoAvancar();
  } else {
    pomoUI();
  }
}

function pomodoroIniciar() {
  if (pomoRodando) return;

  pomoRodando = true;
  if (pomoIntervalo) clearInterval(pomoIntervalo);
  pomoIntervalo = setInterval(pomoTick, 1000);

  pomoUI();
}

function pomodoroPausar() {
  pomoRodando = false;
}

function pomodoroReset() {
  pomoRodando = false;

  if (pomoIntervalo) clearInterval(pomoIntervalo);
  pomoIntervalo = null;

  pomoCiclosConcluidos = 0;
  pomoDefinirEtapa("foco");
}

function pomodoroPular() {
  pomoAvancar();
}

/* ================================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  carregarDados();

  detectarTrocaDeSemanaEFechar(); // ✅ aqui

  atualizarDesempenho();
  atualizarMetasVisuais();
  atualizarHistorico();
  atualizarDashboard();

  verificarRevisoesAtrasadas();
  renderizarGrade();

  pomoDefinirEtapa("foco");
});

function resetarSistema() {

  if (!confirm("Deseja apagar TODOS os dados do planner?"))
    return;

  localStorage.removeItem("planner_dados");

  location.reload();
}