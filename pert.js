'use strict';

const pertState = { rows: [], mode: false, learning: false, lastResult: null };
const pertEl = {
  body: document.getElementById('pert-activity-body'),
  mode: document.getElementById('pert-mode'),
  learningMode: document.getElementById('pert-learning-mode'),
  example: document.getElementById('pert-example-btn'),
  add: document.getElementById('pert-add-btn'),
  solve: document.getElementById('pert-solve-btn'),
  message: document.getElementById('pert-message'),
  result: document.getElementById('pert-result'),
  status: document.getElementById('pert-result-status'),
  summary: document.getElementById('pert-result-summary'),
  cards: document.getElementById('pert-solution-cards'),
  network: document.getElementById('pert-network-output'),
  table: document.getElementById('pert-table-output'),
  gantt: document.getElementById('pert-gantt-output'),
  learningSection: document.getElementById('pert-learning-section'),
  learning: document.getElementById('pert-learning-output'),
  formulaSection: document.getElementById('pert-formula-section'),
  formula: document.getElementById('pert-formula-output'),
  advancedSection: document.getElementById('pert-advanced-section'),
  advanced: document.getElementById('pert-advanced-output'),
  projectName: document.getElementById('pert-project-name'),
  newBtn: document.getElementById('pert-new-btn'),
  saveBtn: document.getElementById('pert-save-btn'),
  loadBtn: document.getElementById('pert-load-btn'),
  fileInput: document.getElementById('pert-file-input'),
  exportReport: document.getElementById('pert-export-report-btn'),
};

function pertEsc(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function pertNum(value) {
  if (Math.abs(value) < 1e-9) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
function pertMessage(text, kind='') {
  pertEl.message.textContent = text;
  pertEl.message.className = `message ${kind}`.trim();
}
function syncPertColumns() {
  document.querySelectorAll('.pert-only').forEach(node => node.classList.toggle('hidden', !pertState.mode));
}
function renderPertRows() {
  pertEl.body.innerHTML = pertState.rows.map((row, i) => `
    <tr data-index="${i}">
      <td><input class="pert-name" value="${pertEsc(row.name)}" aria-label="Actividad ${i+1}"></td>
      <td><input class="pert-pred" value="${pertEsc(row.pred)}" placeholder="—" aria-label="Predecesoras de ${i+1}"></td>
      <td><input class="pert-duration" type="number" min="0" step="any" value="${pertEsc(row.duration)}" aria-label="Duración de ${i+1}"></td>
      <td class="pert-only ${pertState.mode ? '' : 'hidden'}"><input class="pert-o" type="number" min="0" step="any" value="${pertEsc(row.o)}"></td>
      <td class="pert-only ${pertState.mode ? '' : 'hidden'}"><input class="pert-m" type="number" min="0" step="any" value="${pertEsc(row.m)}"></td>
      <td class="pert-only ${pertState.mode ? '' : 'hidden'}"><input class="pert-p" type="number" min="0" step="any" value="${pertEsc(row.p)}"></td>
      <td><button class="icon-btn pert-remove" type="button" title="Eliminar actividad" aria-label="Eliminar actividad">×</button></td>
    </tr>`).join('');
  pertEl.body.querySelectorAll('input').forEach(input => input.addEventListener('input', syncPertStateFromDom));
  pertEl.body.querySelectorAll('.pert-remove').forEach(btn => btn.addEventListener('click', () => {
    if (pertState.rows.length <= 2) { pertMessage('El proyecto debe tener al menos 2 actividades.', 'error'); return; }
    const index = Number(btn.closest('tr').dataset.index);
    pertState.rows.splice(index, 1); renderPertRows();
  }));
}
function syncPertStateFromDom() {
  [...pertEl.body.querySelectorAll('tr')].forEach((tr, i) => {
    const get = cls => tr.querySelector(cls)?.value ?? '';
    if (!pertState.rows[i]) pertState.rows[i] = {};
    Object.assign(pertState.rows[i], { name:get('.pert-name'), pred:get('.pert-pred'), duration:get('.pert-duration'), o:get('.pert-o'), m:get('.pert-m'), p:get('.pert-p') });
  });
}
function addPertRow() {
  syncPertStateFromDom();
  const next = String.fromCharCode(65 + pertState.rows.length);
  pertState.rows.push({ name: next, pred: '', duration: '1', o: '1', m: '1', p: '1' });
  renderPertRows();
}
function loadPertExample() {
  pertState.rows = [
    {name:'A',pred:'',duration:'3',o:'2',m:'3',p:'5'},
    {name:'B',pred:'A',duration:'4',o:'3',m:'4',p:'7'},
    {name:'C',pred:'A',duration:'2',o:'1',m:'2',p:'4'},
    {name:'D',pred:'B',duration:'5',o:'4',m:'5',p:'8'},
    {name:'E',pred:'C',duration:'3',o:'2',m:'3',p:'5'},
    {name:'F',pred:'D, E',duration:'2',o:'1',m:'2',p:'3'},
  ];
  renderPertRows(); pertMessage('Ejemplo cargado. Puedes activar Modo PERT para usar O, M y P.', 'ok');
}
function parseActivities() {
  syncPertStateFromDom();
  const seen = new Set();
  const activities = pertState.rows.map((r, i) => {
    const name = String(r.name || '').trim();
    if (!name) throw new Error(`La actividad de la fila ${i+1} no tiene nombre.`);
    if (seen.has(name.toUpperCase())) throw new Error(`La actividad “${name}” está repetida.`);
    seen.add(name.toUpperCase());
    const pred = String(r.pred || '').split(',').map(x => x.trim()).filter(Boolean).filter(x => x !== '—' && x !== '-');
    const duration = Number(r.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`La duración de “${name}” debe ser un número mayor que 0.`);
    let expected = duration;
    let o = null, m = null, p = null;
    if (pertState.mode) {
      o = Number(r.o); m = Number(r.m); p = Number(r.p);
      if (![o,m,p].every(Number.isFinite) || o < 0 || m < 0 || p < 0) throw new Error(`Las estimaciones O, M y P de “${name}” deben ser válidas y no negativas.`);
      if (o > m || m > p) throw new Error(`En “${name}” debe cumplirse O ≤ M ≤ P.`);
      expected = (o + 4*m + p) / 6;
    }
    return { name, pred, duration: expected, rawDuration: duration, o, m, p };
  });
  const names = new Set(activities.map(a => a.name.toUpperCase()));
  activities.forEach(a => {
    a.pred = a.pred.map(p => {
      const match = activities.find(x => x.name.toUpperCase() === p.toUpperCase());
      if (!match) throw new Error(`La actividad “${a.name}” referencia a “${p}”, pero no existe.`);
      return match.name;
    }).filter((p, idx, arr) => arr.indexOf(p) === idx);
    if (a.pred.some(p => p.toUpperCase() === a.name.toUpperCase())) throw new Error(`La actividad “${a.name}” no puede ser predecesora de sí misma.`);
  });
  if (!names.size) throw new Error('Agrega al menos una actividad.');
  if (activities.length < 2) throw new Error('Agrega al menos 2 actividades para construir un proyecto.');
  return activities;
}
function solvePertCpm(activities) {
  const byName = new Map(activities.map(a => [a.name, a]));
  const indegree = new Map(activities.map(a => [a.name, a.pred.length]));
  const successors = new Map(activities.map(a => [a.name, []]));
  activities.forEach(a => a.pred.forEach(p => successors.get(p).push(a.name)));
  const queue = activities.filter(a => a.pred.length === 0).map(a => a.name);
  const order = [];
  while (queue.length) {
    const name = queue.shift(); order.push(name);
    successors.get(name).forEach(s => { indegree.set(s, indegree.get(s)-1); if (indegree.get(s) === 0) queue.push(s); });
  }
  if (order.length !== activities.length) throw new Error('Se detectó un ciclo en las precedencias. Un proyecto PERT/CPM debe formar una red acíclica.');
  const nodes = new Map(activities.map(a => [a.name, { ...a, es:0, ef:0, ls:0, lf:0, slack:0 }]));
  order.forEach(name => { const n=nodes.get(name); n.es=n.pred.length ? Math.max(...n.pred.map(p=>nodes.get(p).ef)) : 0; n.ef=n.es+n.duration; });
  const projectDuration = Math.max(...order.map(n=>nodes.get(n).ef));
  [...order].reverse().forEach(name => { const n=nodes.get(name); const succ=successors.get(name); n.lf=succ.length ? Math.min(...succ.map(s=>nodes.get(s).ls)) : projectDuration; n.ls=n.lf-n.duration; n.slack=Math.max(0,n.ls-n.es); });
  const critical = order.filter(name => Math.abs(nodes.get(name).slack) < 1e-7);
  return { nodes, order, successors, projectDuration, critical };
}
function enumerateCriticalPaths(result) {
  const {nodes, successors} = result;
  const starts = result.order.filter(n => nodes.get(n).pred.length===0 && Math.abs(nodes.get(n).slack)<1e-7);
  const ends = result.order.filter(n => successors.get(n).length===0 && Math.abs(nodes.get(n).slack)<1e-7);
  const paths=[];
  function walk(name,path){
    const next=successors.get(name).filter(s=>Math.abs(nodes.get(s).slack)<1e-7 && Math.abs(nodes.get(name).ef-nodes.get(s).es)<1e-7);
    if (!next.length) { if (ends.includes(name)) paths.push(path.slice()); return; }
    next.forEach(s=>walk(s,[...path,s]));
  }
  starts.forEach(s=>walk(s,[s]));
  return paths;
}
function renderNetwork(result) {
  const {nodes, order, successors} = result;
  const levels = new Map();

  // Asignar nivel topológico: cada actividad queda después de todas sus predecesoras.
  order.forEach(name => {
    const n = nodes.get(name);
    levels.set(name, n.pred.length ? Math.max(...n.pred.map(p => levels.get(p) + 1)) : 0);
  });

  const levelValues = [...new Set(levels.values())].sort((a,b) => a-b);
  const groups = levelValues.map(level => order.filter(n => levels.get(n) === level));

  // Tarjetas más anchas/altas para evitar que ES/EF/LS/LF/H se encimen.
  const nodeW = 224;
  const nodeH = 128;
  const colGap = 96;
  const rowGap = 58;
  const sidePad = 70;
  const topPad = 62;
  const bottomPad = 70;
  const width = Math.max(980, groups.length * nodeW + Math.max(0, groups.length - 1) * colGap + sidePad * 2);
  const maxRows = Math.max(...groups.map(g => g.length), 1);
  const height = Math.max(390, maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap + topPad + bottomPad);
  const positions = new Map();

  groups.forEach((group, level) => {
    const x = sidePad + nodeW / 2 + level * (nodeW + colGap);
    const contentH = group.length * nodeH + Math.max(0, group.length - 1) * rowGap;
    const top = Math.max(topPad, (height - contentH) / 2);
    group.forEach((name, i) => positions.set(name, {
      x,
      y: top + nodeH / 2 + i * (nodeH + rowGap)
    }));
  });

  const isCritical = name => Math.abs(nodes.get(name).slack) < 1e-7;
  const criticalEdge = (a, b) =>
    isCritical(a) && isCritical(b) && Math.abs(nodes.get(a).ef - nodes.get(b).es) < 1e-7;

  const edges = [];
  order.forEach(name => successors.get(name).forEach(s => {
    const a = positions.get(name);
    const b = positions.get(s);
    const critical = criticalEdge(name, s);

    // Las flechas terminan justo antes de la tarjeta para que nunca queden ocultas debajo del rect.
    const startX = a.x + nodeW / 2 + 2;
    const endX = b.x - nodeW / 2 - 4;
    // Cuando varias actividades llegan al mismo nodo, usamos puertos verticales
    // separados para que las puntas de flecha no se amontonen en el centro.
    const portOffset = a.y === b.y ? 0 : (a.y < b.y ? -18 : 18);
    const startY = a.y;
    const endY = b.y + portOffset;
    const bend = Math.max(38, Math.abs(endX - startX) * 0.38);
    const path = `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;

    edges.push(`<path d="${path}" class="pert-edge ${critical ? 'critical' : ''}" marker-end="url(#${critical ? 'pert-arrow-critical' : 'pert-arrow'})"/>`);
  }));

  const nodesSvg = order.map(name => {
    const p = positions.get(name);
    const n = nodes.get(name);
    const critical = isCritical(name);
    const x0 = p.x - nodeW / 2;
    const y0 = p.y - nodeH / 2;

    return `<g class="pert-node ${critical ? 'critical' : ''}">
      <rect x="${x0}" y="${y0}" width="${nodeW}" height="${nodeH}" rx="18"/>
      <text x="${p.x}" y="${y0 + 27}" text-anchor="middle" class="pert-node-name">${pertEsc(n.name)}</text>
      <text x="${p.x}" y="${y0 + 49}" text-anchor="middle" class="pert-node-time">Duración: ${pertNum(n.duration)} d</text>
      <line x1="${x0 + 14}" y1="${y0 + 61}" x2="${x0 + nodeW - 14}" y2="${y0 + 61}" class="pert-node-divider"/>

      <text x="${x0 + 16}" y="${y0 + 84}" class="pert-node-meta">ES ${pertNum(n.es)}</text>
      <text x="${x0 + 98}" y="${y0 + 84}" class="pert-node-meta">EF ${pertNum(n.ef)}</text>
      <text x="${x0 + 16}" y="${y0 + 105}" class="pert-node-meta">LS ${pertNum(n.ls)}</text>
      <text x="${x0 + 98}" y="${y0 + 105}" class="pert-node-meta">LF ${pertNum(n.lf)}</text>
      <text x="${x0 + nodeW - 16}" y="${y0 + 105}" text-anchor="end" class="pert-node-slack">H ${pertNum(n.slack)}</text>
    </g>`;
  }).join('');

  return `<div class="pert-network-wrap">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Red de actividades del proyecto">
      <defs>
        <marker id="pert-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L12,6 L0,12 z" fill="#64748b"/>
        </marker>
        <marker id="pert-arrow-critical" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L12,6 L0,12 z" fill="#1989e8"/>
        </marker>
      </defs>
      ${edges.join('')}
      ${nodesSvg}
    </svg>
    <div class="graph-legend">
      <span><i class="legend-line constraint"></i>Dependencia</span>
      <span><i class="legend-line objective"></i>Ruta crítica</span>
      <span><i class="legend-dot critical-dot"></i>Actividad crítica</span>
      <span><i class="legend-dot noncritical-dot"></i>Actividad no crítica</span>
    </div>
  </div>`;
}

function renderPertGantt(result) {
  const { nodes, order, projectDuration } = result;
  const rows = order.map(name => ({ name, n: nodes.get(name) }));
  const left = 132;
  const right = 34;
  const top = 36;
  const rowH = 42;
  const barH = 24;
  const chartW = Math.max(640, Math.min(1120, projectDuration * 72));
  const width = left + chartW + right;
  const height = top + rows.length * rowH + 38;
  const ticks = [];
  const tickCount = Math.min(14, Math.max(2, Math.ceil(projectDuration)));
  const step = projectDuration / tickCount;
  for (let i = 0; i <= tickCount; i++) {
    const value = i * step;
    const x = left + (value / projectDuration) * chartW;
    ticks.push(`<line x1="${x}" y1="${top - 8}" x2="${x}" y2="${top + rows.length * rowH}" class="gantt-grid-line"/>`);
    ticks.push(`<text x="${x}" y="22" text-anchor="middle" class="gantt-axis-label">${pertNum(value)}</text>`);
  }
  const rowSvg = rows.map(({name,n}, i) => {
    const y = top + i * rowH + (rowH - barH) / 2;
    const x = left + (n.es / projectDuration) * chartW;
    const w = Math.max(3, (n.duration / projectDuration) * chartW);
    const critical = Math.abs(n.slack) < 1e-7;
    return `<g class="gantt-row">
      <text x="${left - 14}" y="${y + barH - 5}" text-anchor="end" class="gantt-name">${pertEsc(name)}</text>
      <rect x="${left}" y="${y - 9}" width="${chartW}" height="${rowH}" class="gantt-row-bg"/>
      <rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="7" class="gantt-bar ${critical ? 'critical' : ''}"/>
      <text x="${Math.min(x + w - 6, left + chartW - 6)}" y="${y + 17}" text-anchor="end" class="gantt-bar-label">${pertNum(n.duration)} d</text>
    </g>`;
  }).join('');
  return `<div class="pert-gantt-wrap">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Cronograma de Gantt del proyecto">
      ${ticks.join('')}
      <text x="${left}" y="12" class="gantt-axis-title">Tiempo (días)</text>
      ${rowSvg}
    </svg>
    <div class="graph-legend gantt-legend">
      <span><i class="legend-line objective"></i>Actividad crítica</span>
      <span><i class="legend-line constraint"></i>Actividad no crítica</span>
    </div>
  </div>`;
}

function renderPertTable(result) {
  const rows = result.order.map(name => {
    const n = result.nodes.get(name), critical = n.slack < 1e-7;
    return `<tr class="${critical ? 'pert-critical-row' : ''}">
      <td><strong>${pertEsc(n.name)}</strong>${critical ? '<span class="critical-chip">Crítica</span>' : ''}</td>
      <td>${pertEsc(n.pred.join(', ') || '—')}</td>
      <td>${pertNum(n.duration)}</td><td>${pertNum(n.es)}</td><td>${pertNum(n.ef)}</td>
      <td>${pertNum(n.ls)}</td><td>${pertNum(n.lf)}</td><td><strong>${pertNum(n.slack)}</strong></td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="pert-result-table"><thead><tr><th>Actividad</th><th>Predecesoras</th><th>Duración</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Holgura</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function pertNormalCdf(z) {
  // Aproximación de Abramowitz-Stegun para la CDF normal estándar.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429;
  const erf = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
  return 0.5 * (1 + sign * erf);
}
function pertVariance(n) {
  if (![n.o,n.m,n.p].every(Number.isFinite)) return 0;
  return Math.pow((n.p - n.o) / 6, 2);
}
function pertPathStats(result, path) {
  const activities = path.map(name => result.nodes.get(name));
  const expected = activities.reduce((sum, n) => sum + n.duration, 0);
  const variance = activities.reduce((sum, n) => sum + pertVariance(n), 0);
  const sd = Math.sqrt(Math.max(0, variance));
  return { activities, expected, variance, sd };
}
function renderPertAdvanced(result) {
  const paths = enumerateCriticalPaths(result);
  const stats = paths.map(path => ({ path, ...pertPathStats(result, path) }));
  const primary = stats[0] || { expected: result.projectDuration, variance: 0, sd: 0, path: [] };
  const defaultTarget = Math.ceil(primary.expected * 100) / 100 + 1;
  const pathCards = stats.map((item, index) => `
    <div class="pert-advanced-path">
      <div class="advanced-path-head"><strong>${stats.length > 1 ? `Ruta crítica ${index + 1}` : 'Ruta crítica'}</strong><span>${pertEsc(item.path.join(' → '))}</span></div>
      <div class="advanced-stat-grid">
        <div><span>Tiempo esperado</span><strong>${pertNum(item.expected)} d</strong></div>
        <div><span>Varianza</span><strong>${pertNum(item.variance)} d²</strong></div>
        <div><span>Desviación estándar</span><strong>${pertNum(item.sd)} d</strong></div>
      </div>
    </div>`).join('');
  return `<div class="pert-advanced-intro">
    <div class="formula-main"><b>Varianza:</b> σ² = ((P − O) / 6)² &nbsp;&nbsp; <b>Desviación:</b> σ = √σ²</div>
    <div class="pert-advanced-paths">${pathCards}</div>
  </div>
  <div class="pert-probability-box">
    <div class="probability-copy">
      <p class="eyebrow">Probabilidad de cumplimiento</p>
      <h3>¿Terminar antes de una fecha objetivo?</h3>
      <p>Introduce un límite de tiempo en días. Se calcula <b>Z = (D − T<sub>e</sub>) / σ</b> y se obtiene la probabilidad acumulada de terminar dentro de ese plazo.</p>
    </div>
    <div class="probability-controls">
      <label for="pert-target-days">Fecha objetivo (días)</label>
      <div class="probability-input-row"><input id="pert-target-days" type="number" min="0" step="any" value="${pertNum(defaultTarget)}"><button class="btn primary" id="pert-probability-btn" type="button">Calcular probabilidad</button></div>
    </div>
    <div id="pert-probability-result" class="probability-result" aria-live="polite">
      <span>Resultado</span><strong>—</strong>
    </div>
  </div>
  ${stats.length > 1 ? '<p class="message warning">Se detectaron varias rutas críticas. Cada ruta tiene su propia varianza; por eso se muestran por separado en lugar de combinar sus varianzas automáticamente.</p>' : ''}`;
}
function bindPertProbability(result) {
  const button = document.getElementById('pert-probability-btn');
  const input = document.getElementById('pert-target-days');
  const output = document.getElementById('pert-probability-result');
  if (!button || !input || !output) return;
  const paths = enumerateCriticalPaths(result);
  button.addEventListener('click', () => {
    const target = Number(input.value);
    if (!Number.isFinite(target) || target < 0) {
      output.innerHTML = '<span>Resultado</span><strong>Introduce un número válido.</strong>';
      return;
    }
    const stats = paths.map(path => pertPathStats(result, path));
    const cards = stats.map((item, index) => {
      if (item.sd === 0) {
        const probability = target >= item.expected ? 1 : 0;
        return `<div class="probability-card"><span>${stats.length > 1 ? `Ruta ${index + 1}` : 'Probabilidad'}</span><strong>${(probability*100).toFixed(1)}%</strong><small>σ = 0; el plazo ${target >= item.expected ? 'alcanza' : 'no alcanza'} el tiempo esperado.</small></div>`;
      }
      const z = (target - item.expected) / item.sd;
      const probability = Math.min(1, Math.max(0, pertNormalCdf(z)));
      return `<div class="probability-card"><span>${stats.length > 1 ? `Ruta ${index + 1}` : 'Probabilidad'}</span><strong>${(probability*100).toFixed(1)}%</strong><small>Z = ${pertNum(z)} · Tₑ = ${pertNum(item.expected)} d · σ = ${pertNum(item.sd)} d</small></div>`;
    }).join('');
    output.innerHTML = `<span>Para ${pertNum(target)} días</span><div class="probability-cards">${cards}</div>`;
  });
}

function renderPertFormula(result) {
  const rows=result.order.map(name=>{const n=result.nodes.get(name); return `<div class="pert-formula-card"><strong>${pertEsc(n.name)}</strong><span>Te = (${pertNum(n.o)} + 4(${pertNum(n.m)}) + ${pertNum(n.p)}) / 6 = <b>${pertNum(n.duration)} días</b></span></div>`;}).join('');
  return `<p class="formula-main">T<sub>e</sub> = <span class="frac-inline">(O + 4M + P) / 6</span></p><div class="pert-formula-grid">${rows}</div>`;
}

function renderPertLearning(result) {
  const { nodes, order, successors, projectDuration } = result;
  const forward = order.map(name => {
    const n = nodes.get(name);
    if (!n.pred.length) {
      return `<div class="learning-step"><span class="learning-index">${order.indexOf(name)+1}</span><div><strong>${pertEsc(n.name)} · tiempo temprano</strong><p>Sin predecesoras: <b>ES = 0</b>.</p><p><b>EF = ES + duración = 0 + ${pertNum(n.duration)} = ${pertNum(n.ef)}</b>.</p></div></div>`;
    }
    const terms = n.pred.map(p => `${pertEsc(p)}: EF ${pertNum(nodes.get(p).ef)}`).join(' · ');
    return `<div class="learning-step"><span class="learning-index">${order.indexOf(name)+1}</span><div><strong>${pertEsc(n.name)} · tiempo temprano</strong><p>Predecesoras: ${terms}.</p><p>Se toma el mayor EF: <b>ES = ${pertNum(n.es)}</b>.</p><p><b>EF = ${pertNum(n.es)} + ${pertNum(n.duration)} = ${pertNum(n.ef)}</b>.</p></div></div>`;
  }).join('');

  const backwardOrder = [...order].reverse();
  const backward = backwardOrder.map((name, idx) => {
    const n = nodes.get(name);
    if (!successors.get(name).length) {
      return `<div class="learning-step"><span class="learning-index">${idx+1}</span><div><strong>${pertEsc(n.name)} · tiempo tardío</strong><p>Sin sucesoras: <b>LF = duración del proyecto = ${pertNum(projectDuration)}</b>.</p><p><b>LS = LF − duración = ${pertNum(n.lf)} − ${pertNum(n.duration)} = ${pertNum(n.ls)}</b>.</p></div></div>`;
    }
    const terms = successors.get(name).map(s => `${pertEsc(s)}: LS ${pertNum(nodes.get(s).ls)}`).join(' · ');
    return `<div class="learning-step"><span class="learning-index">${idx+1}</span><div><strong>${pertEsc(n.name)} · tiempo tardío</strong><p>Sucesoras: ${terms}.</p><p>Se toma el menor LS: <b>LF = ${pertNum(n.lf)}</b>.</p><p><b>LS = ${pertNum(n.lf)} − ${pertNum(n.duration)} = ${pertNum(n.ls)}</b>.</p></div></div>`;
  }).join('');

  const slack = order.map((name, idx) => {
    const n = nodes.get(name);
    const critical = Math.abs(n.slack) < 1e-7;
    return `<div class="learning-slack ${critical ? 'critical' : ''}"><strong>${pertEsc(n.name)}</strong><span>H = LS − ES = ${pertNum(n.ls)} − ${pertNum(n.es)} = <b>${pertNum(n.slack)}</b></span><em>${critical ? 'Ruta crítica' : 'Con holgura'}</em></div>`;
  }).join('');

  return `<div class="learning-block"><div class="learning-block-head"><span class="learning-badge">PASO 1</span><div><h3>Recorrido hacia adelante</h3><p>Se calculan ES y EF desde el inicio hasta el final.</p></div></div><div class="learning-steps">${forward}</div></div>
  <div class="learning-block"><div class="learning-block-head"><span class="learning-badge">PASO 2</span><div><h3>Recorrido hacia atrás</h3><p>Se parte de la duración total y se calculan LS y LF hacia el inicio.</p></div></div><div class="learning-steps">${backward}</div></div>
  <div class="learning-block"><div class="learning-block-head"><span class="learning-badge">PASO 3</span><div><h3>Holguras y ruta crítica</h3><p>Una actividad es crítica cuando su holgura es cero.</p></div></div><div class="learning-slack-grid">${slack}</div></div>`;
}
function renderPertResult(result) {
  const paths = enumerateCriticalPaths(result);
  const criticalText = paths.length ? paths.map(p => p.join(' → ')).join('  |  ') : result.critical.join(' → ');
  const maxSlack = Math.max(...result.order.map(name => result.nodes.get(name).slack));
  const criticalCount = result.critical.length;
  pertEl.result.classList.remove('hidden');
  pertEl.status.textContent = 'Programación calculada correctamente';
  pertEl.summary.textContent = paths.length > 1
    ? `Se encontraron ${paths.length} rutas críticas con la misma duración máxima.`
    : 'Las actividades críticas tienen holgura cero y determinan la duración calculada del proyecto.';
  pertEl.cards.innerHTML = `
    <div class="solution-card"><div class="label">Duración total</div><div class="value">${pertNum(result.projectDuration)} días</div></div>
    <div class="solution-card"><div class="label">Actividades</div><div class="value">${result.order.length}</div></div>
    <div class="solution-card critical-card"><div class="label">Actividades críticas</div><div class="value">${criticalCount}</div></div>
    <div class="solution-card"><div class="label">Mayor holgura</div><div class="value">${pertNum(maxSlack)} días</div></div>
    <div class="solution-card critical-card pert-path-card"><div class="label">Ruta${paths.length > 1 ? 's' : ''} crítica${paths.length > 1 ? 's' : ''}</div><div class="value small-value">${pertEsc(criticalText)}</div></div>`;
  pertEl.network.innerHTML = renderNetwork(result);
  pertEl.gantt.innerHTML = renderPertGantt(result);
  pertEl.table.innerHTML = renderPertTable(result);
  if (pertState.learning) {
    pertEl.learningSection.classList.remove('hidden');
    pertEl.learning.innerHTML = renderPertLearning(result);
  } else {
    pertEl.learningSection.classList.add('hidden');
    pertEl.learning.innerHTML = '';
  }
  if (pertState.mode) {
    pertEl.formulaSection.classList.remove('hidden');
    pertEl.formula.innerHTML = renderPertFormula(result);
    pertEl.advancedSection.classList.remove('hidden');
    pertEl.advanced.innerHTML = renderPertAdvanced(result);
    bindPertProbability(result);
  } else {
    pertEl.formulaSection.classList.add('hidden');
    pertEl.formula.innerHTML = '';
    pertEl.advancedSection.classList.add('hidden');
    pertEl.advanced.innerHTML = '';
  }
  pertState.lastResult = result;
  pertEl.result.scrollIntoView({behavior:'smooth', block:'start'});
}
function calculatePert() {
  try { const activities=parseActivities(); const result=solvePertCpm(activities); renderPertResult(result); pertMessage('Cálculo terminado. Revisa la ruta crítica y las holguras.', 'ok'); }
  catch(error){ pertEl.result.classList.add('hidden'); pertMessage(error instanceof Error ? error.message : 'No se pudo calcular el proyecto.', 'error'); }
}

pertEl.mode.addEventListener('change', () => { pertState.mode=pertEl.mode.checked; syncPertColumns(); });
pertEl.learningMode.addEventListener('change', () => { pertState.learning=pertEl.learningMode.checked; });
pertEl.example.addEventListener('click', loadPertExample);
pertEl.add.addEventListener('click', addPertRow);
pertEl.solve.addEventListener('click', calculatePert);

loadPertExample();

// ─────────────────────────────────────────────────────────────────────────────
// Gestión de proyectos y reporte imprimible
// ─────────────────────────────────────────────────────────────────────────────
function getPertProjectData() {
  syncPertStateFromDom();
  return {
    format: 'io-solver-project',
    version: 1,
    type: 'pert-cpm',
    projectName: String(pertEl.projectName?.value || '').trim() || 'Mi proyecto PERT / CPM',
    mode: Boolean(pertState.mode),
    learning: Boolean(pertState.learning),
    rows: pertState.rows.map(r => ({
      name: String(r.name ?? ''), pred: String(r.pred ?? ''), duration: String(r.duration ?? ''),
      o: String(r.o ?? ''), m: String(r.m ?? ''), p: String(r.p ?? '')
    }))
  };
}

function resetPertProject(showMessage = true) {
  pertState.rows = [
    {name:'A',pred:'',duration:'1',o:'1',m:'1',p:'1'},
    {name:'B',pred:'A',duration:'1',o:'1',m:'1',p:'1'}
  ];
  pertState.mode = false;
  pertState.learning = false;
  pertState.lastResult = null;
  if (pertEl.projectName) pertEl.projectName.value = 'Mi proyecto PERT / CPM';
  if (pertEl.mode) pertEl.mode.checked = false;
  if (pertEl.learningMode) pertEl.learningMode.checked = false;
  syncPertColumns();
  renderPertRows();
  pertEl.result.classList.add('hidden');
  pertMessage(showMessage ? 'Nuevo proyecto creado.' : '', showMessage ? 'ok' : '');
}

function savePertProject() {
  try {
    const data = getPertProjectData();
    const safeName = data.projectName.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'proyecto-pert-cpm';
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${safeName}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pertMessage('Proyecto guardado como archivo JSON.', 'ok');
  } catch (error) {
    pertMessage('No se pudo guardar el proyecto.', 'error');
  }
}

function loadPertProject(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ''));
      if (data?.format !== 'io-solver-project' || data?.type !== 'pert-cpm' || !Array.isArray(data.rows)) {
        throw new Error('El archivo no corresponde a un proyecto PERT / CPM de IO Solver.');
      }
      if (data.rows.length < 2 || data.rows.length > 500) throw new Error('El proyecto debe contener entre 2 y 500 actividades.');
      pertState.rows = data.rows.map((r, i) => ({
        name: String(r?.name ?? '').trim(), pred: String(r?.pred ?? ''), duration: String(r?.duration ?? ''),
        o: String(r?.o ?? ''), m: String(r?.m ?? ''), p: String(r?.p ?? '')
      }));
      pertState.mode = Boolean(data.mode);
      pertState.learning = Boolean(data.learning);
      pertState.lastResult = null;
      if (pertEl.projectName) pertEl.projectName.value = String(data.projectName || 'Mi proyecto PERT / CPM').slice(0, 80);
      pertEl.mode.checked = pertState.mode;
      pertEl.learningMode.checked = pertState.learning;
      syncPertColumns();
      renderPertRows();
      pertEl.result.classList.add('hidden');
      pertMessage(`Proyecto “${pertEl.projectName.value}” cargado correctamente.`, 'ok');
    } catch (error) {
      pertMessage(error instanceof Error ? error.message : 'No se pudo abrir el proyecto.', 'error');
    } finally {
      pertEl.fileInput.value = '';
    }
  };
  reader.onerror = () => { pertMessage('No se pudo leer el archivo.', 'error'); pertEl.fileInput.value = ''; };
  reader.readAsText(file);
}

function exportPertReport() {
  if (!pertState.lastResult) {
    pertMessage('Primero calcula el proyecto para poder generar el reporte.', 'error');
    return;
  }

  const name = pertEsc(pertEl.projectName?.value?.trim() || 'Mi proyecto PERT / CPM');
  const result = pertState.lastResult;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    pertMessage('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para IO Solver.', 'error');
    return;
  }

  const network = pertEl.network.innerHTML;
  const gantt = pertEl.gantt.innerHTML;
  const table = pertEl.table.innerHTML;
  const formula = pertState.mode ? pertEl.formula.innerHTML : '';
  const advanced = pertState.mode ? pertEl.advanced.innerHTML : '';
  const learning = pertState.learning ? pertEl.learning.innerHTML : '';
  const date = new Date().toLocaleDateString('es-MX', {year:'numeric', month:'long', day:'numeric'});
  const paths = enumerateCriticalPaths(result).map(p => p.join(' → '));

  // El reporte usa CSS propio. No heredamos el CSS de la aplicación porque sus
  // reglas de pantalla (grid, tamaños, colores y contenedores) pueden provocar
  // que el contenido se comprima al imprimir/guardar como PDF.
  reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${name} · IO Solver</title><style>
    @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #172033; }
    body { font-family: Inter, Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
    main { max-width: 100%; margin: 0 auto; }
    .report-page { break-before: page; page-break-before: always; break-after: page; page-break-after: always; min-height: 0; }
    .report-page:first-of-type { break-before: auto; page-break-before: auto; }
    .report-page:last-of-type { break-after: auto; page-break-after: auto; }
    .cover { padding: 4mm 0 6mm; border-bottom: 2px solid #d8e0ea; margin-bottom: 7mm; }
    .eyebrow { margin: 0 0 2mm; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; color: #1879d1; }
    h1 { margin: 0 0 1mm; font-size: 25px; line-height: 1.15; }
    h2 { margin: 0 0 3mm; font-size: 17px; line-height: 1.2; }
    h3 { margin: 4mm 0 2mm; font-size: 13px; }
    p { margin: 0 0 3mm; }
    .muted { color: #59677a; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; margin-bottom: 6mm; }
    .card { min-width: 0; border: 1px solid #d5deea; border-radius: 8px; padding: 3.5mm; break-inside: avoid; page-break-inside: avoid; }
    .card span { display: block; color: #68768a; font-size: 9px; margin-bottom: 1mm; }
    .card strong { display: block; font-size: 15px; overflow-wrap: anywhere; }
    .card.critical { border-color: #1989e8; }
    .section-box { border: 1px solid #d5deea; border-radius: 8px; padding: 3mm; break-inside: avoid; page-break-inside: avoid; }
    .pert-network-wrap, .pert-gantt-wrap { overflow: hidden; border: 0; border-radius: 0; padding: 0; }
    .pert-network-wrap svg { display: block; width: 100%; height: auto; max-height: 150mm; background: #fff; }
    /* The app stylesheet is intentionally not loaded in the report, so inline SVGs
       need explicit print-safe presentation styles. */
    .pert-network-wrap .pert-edge { stroke: #64748b; stroke-width: 2.25; fill: none; opacity: .78; }
    .pert-network-wrap .pert-edge.critical { stroke: #1989e8; stroke-width: 4; opacity: 1; }
    .pert-network-wrap .pert-node rect { fill: #f5f7fa; stroke: #cbd5e1; stroke-width: 2; }
    .pert-network-wrap .pert-node.critical rect { fill: #eaf5ff; stroke: #1989e8; stroke-width: 3.5; }
    .pert-network-wrap .pert-node-name { fill: #172033; font-size: 18px; font-weight: 900; }
    .pert-network-wrap .pert-node-time { fill: #68758a; font-size: 12px; font-weight: 800; }
    .pert-network-wrap .pert-node-divider { stroke: #d9e1ec; stroke-width: 1; }
    .pert-network-wrap .pert-node-meta { fill: #68758a; font-size: 11px; font-weight: 750; }
    .pert-network-wrap .pert-node-slack { fill: #172033; font-size: 11px; font-weight: 900; }
    .pert-network-wrap .pert-node.critical .pert-node-slack { fill: #166bb4; }
    .pert-network-wrap marker path { fill: #64748b; }
    .pert-network-wrap marker#pert-arrow-critical path { fill: #1989e8; }
    .pert-gantt-wrap svg { display: block; width: 100%; height: auto; max-height: 90mm; background: #fff; }
    .pert-gantt-wrap .gantt-grid-line { stroke: #d9e1ec; stroke-width: 1; opacity: .85; }
    .pert-gantt-wrap .gantt-axis-label, .pert-gantt-wrap .gantt-axis-title { fill: #68758a; font-size: 11px; font-weight: 800; }
    .pert-gantt-wrap .gantt-axis-title { font-size: 12px; }
    .pert-gantt-wrap .gantt-name { fill: #172033; font-size: 12px; font-weight: 900; }
    .pert-gantt-wrap .gantt-row-bg { fill: #f5f7fa; opacity: .9; }
    .pert-gantt-wrap .gantt-bar { fill: #7a8798; opacity: .82; }
    .pert-gantt-wrap .gantt-bar.critical { fill: #1989e8; opacity: 1; }
    .pert-gantt-wrap .gantt-bar-label { fill: #fff; font-size: 10px; font-weight: 900; }
    .graph-legend { display: flex; gap: 4mm; flex-wrap: wrap; font-size: 9px; margin: 2mm 1mm 0; color: #536174; }
    .table-wrap { overflow: visible; }
    .pert-result-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .pert-result-table th, .pert-result-table td { border: 1px solid #d5deea; padding: 2mm 1.5mm; text-align: left; }
    .pert-result-table th { background: #eef3f8; }
    .pert-result-table tr { break-inside: avoid; page-break-inside: avoid; }
    .critical-chip { margin-left: 1mm; font-size: 8px; border: 1px solid #1989e8; border-radius: 20px; padding: 1px 4px; }
    .learning-block, .pert-advanced-path, .pert-probability-box { border: 1px solid #d5deea; border-radius: 8px; padding: 3mm; margin: 2.5mm 0; break-inside: avoid; page-break-inside: avoid; }
    .learning-step { padding: 2.5mm 0; border-bottom: 1px solid #e5eaf0; break-inside: avoid; page-break-inside: avoid; }
    .learning-step:last-child { border-bottom: 0; }
    .pert-formula-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2.5mm; }
    .pert-formula-card { border: 1px solid #d5deea; border-radius: 7px; padding: 2.5mm; break-inside: avoid; page-break-inside: avoid; }
    .advanced-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.5mm; margin-top: 2.5mm; }
    .advanced-stat-grid div { border: 1px solid #d5deea; border-radius: 7px; padding: 2.5mm; break-inside: avoid; page-break-inside: avoid; }
    .advanced-stat-grid span { display: block; color: #68768a; font-size: 9px; }
    .probability-result { margin-top: 2.5mm; }
    .probability-card { border: 1px solid #d5deea; border-radius: 7px; padding: 2.5mm; margin: 1.5mm 0; break-inside: avoid; page-break-inside: avoid; }
    .probability-card strong { font-size: 16px; display: block; }
    .report-footer { margin-top: 7mm; padding-top: 2mm; border-top: 1px solid #e5eaf0; color: #7a8798; font-size: 8.5px; }
    .report-note { border-left: 3px solid #1989e8; padding: 2.5mm 3mm; background: #f5f9fd; margin: 3mm 0; break-inside: avoid; }
    @media screen {
      body { background: #eef2f6; padding: 20px; }
      main { max-width: 900px; background: #fff; padding: 28px; box-shadow: 0 5px 30px rgba(20,40,70,.12); }
      .no-print { display: block; }
    }
    @media print {
      .no-print { display: none !important; }
      .report-page { min-height: 0; }
      .section-box, .learning-block, .pert-advanced-path, .pert-probability-box, .card { overflow: visible; }
    }
  </style></head><body><main>
    <section class="report-page">
      <header class="cover">
        <p class="eyebrow">IO Solver · Investigación de Operaciones</p>
        <h1>${name}</h1>
        <p class="muted">Reporte PERT / CPM · ${date}</p>
      </header>

      <h2>Resumen del proyecto</h2>
      <div class="summary">
        <div class="card"><span>Duración total</span><strong>${pertNum(result.projectDuration)} días</strong></div>
        <div class="card"><span>Actividades</span><strong>${result.order.length}</strong></div>
        <div class="card critical"><span>Actividades críticas</span><strong>${result.critical.length}</strong></div>
        <div class="card"><span>Ruta(s) crítica(s)</span><strong>${pertEsc(paths.join(' | ') || '—')}</strong></div>
      </div>

      <h2>Red del proyecto</h2>
      <div class="section-box">${network}</div>
      <div class="report-footer">IO Solver · Reporte generado desde el módulo PERT / CPM.</div>
    </section>

    <section class="report-page">
      <h2>Cronograma de Gantt</h2>
      <p class="muted">Vista temporal de las actividades según sus inicios y finales tempranos.</p>
      <div class="section-box">${gantt}</div>

      <h2 style="margin-top:7mm">Tiempos y holguras</h2>
      <p class="muted">ES = inicio temprano · EF = fin temprano · LS = inicio tardío · LF = fin tardío.</p>
      <div class="section-box">${table}</div>
      <div class="report-footer">Las actividades críticas tienen holgura cero y determinan la duración calculada del proyecto.</div>
    </section>

    ${learning ? `<section class="report-page"><h2>Procedimiento paso a paso</h2><p class="muted">Recorrido hacia adelante, recorrido hacia atrás y cálculo de holguras.</p>${learning}</section>` : ''}

    ${formula || advanced ? `<section class="report-page">${formula ? `<h2>Cálculo PERT</h2>${formula}` : ''}${advanced ? `<h2 style="margin-top:7mm">Análisis PERT avanzado</h2>${advanced}` : ''}<div class="report-footer">El análisis estadístico PERT utiliza las estimaciones O, M y P configuradas en el proyecto.</div></section>` : ''}
  </main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),450));<\/script></body></html>`);
  reportWindow.document.close();
}

pertEl.newBtn?.addEventListener('click', () => resetPertProject());
pertEl.saveBtn?.addEventListener('click', savePertProject);
pertEl.loadBtn?.addEventListener('click', () => pertEl.fileInput?.click());
pertEl.fileInput?.addEventListener('change', e => loadPertProject(e.target.files?.[0]));
pertEl.exportReport?.addEventListener('click', exportPertReport);
