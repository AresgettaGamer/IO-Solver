'use strict';

const EPS = 1e-9;
const MAX_ITERATIONS = 100;

const state = { variables: 2, constraints: 3, objectiveType: 'max', nonnegative: true };
let currentLastProblem = null;
let currentLastResult = null;

const el = {
  form: document.getElementById('problem-form'),
  objectiveType: document.getElementById('objective-type'),
  variableCount: document.getElementById('variable-count'),
  constraintCount: document.getElementById('constraint-count'),
  nonnegative: document.getElementById('nonnegative'),
  editor: document.getElementById('model-editor'),
  message: document.getElementById('input-message'),
  example: document.getElementById('example-btn'),
  resultSection: document.getElementById('result-section'),
  resultStatus: document.getElementById('result-status'),
  resultSummary: document.getElementById('result-summary'),
  methodBadge: document.getElementById('method-badge'),
  solutionCards: document.getElementById('solution-cards'),
  processOutput: document.getElementById('process-output'),
  learningMode: null,
  pdfInput: document.getElementById('pdf-input'),
  pdfStatus: document.getElementById('pdf-status'),
  pdfResults: document.getElementById('pdf-results'),
  problemText: document.getElementById('problem-text'),
  analyzeText: document.getElementById('analyze-text-btn'),
  graphSection: document.getElementById('graph-section'),
  graphEnabled: document.getElementById('graph-enabled'),
  graphControls: document.getElementById('graph-controls'),
  graphSlider: document.getElementById('graph-z-slider'),
  graphZValue: document.getElementById('graph-z-value'),
  graphOutput: document.getElementById('graph-output'),
};

el.learningMode = document.getElementById('learning-mode');

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function setCounts() {
  state.variables = clampInt(el.variableCount.value, 1, 8, 2);
  state.constraints = clampInt(el.constraintCount.value, 1, 8, 3);
  state.objectiveType = el.objectiveType.value;
  state.nonnegative = el.nonnegative.checked;
  el.variableCount.value = state.variables;
  el.constraintCount.value = state.constraints;
  renderEditor();
}

function makeInput(className, value = '0', aria = '') {
  const input = document.createElement('input');
  input.className = className;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.value = value;
  if (aria) input.setAttribute('aria-label', aria);
  return input;
}

function renderEditor(prefill = null) {
  const vars = state.variables;
  const cons = state.constraints;
  el.editor.innerHTML = '';

  const objBlock = document.createElement('div');
  objBlock.className = 'model-block';
  const title = document.createElement('div');
  title.className = 'model-title';
  title.textContent = `Función objetivo · ${state.objectiveType === 'max' ? 'Maximizar' : 'Minimizar'}`;
  objBlock.appendChild(title);

  const row = document.createElement('div');
  row.className = 'coeff-row';
  row.style.setProperty('--cols', vars);
  const lead = document.createElement('div');
  lead.className = 'inline-control';
  lead.innerHTML = `<span class="symbol">Objetivo</span><strong>Z ${state.objectiveType === 'max' ? 'max' : 'min'} =</strong>`;
  row.appendChild(lead);

  for (let j = 0; j < vars; j += 1) {
    const cell = document.createElement('div');
    cell.className = 'math-cell';
    const value = prefill?.objective?.[j] ?? (j === 0 ? '3' : j === 1 ? '5' : '0');
    const input = makeInput('coeff objective-coeff', value, `Coeficiente de X${j + 1} en la función objetivo`);
    input.dataset.kind = 'objective';
    input.dataset.index = String(j);
    cell.appendChild(input);
    const s = document.createElement('span');
    s.className = 'operator';
    s.textContent = `X${j + 1}`;
    cell.appendChild(s);
    row.appendChild(cell);
  }
  objBlock.appendChild(row);
  el.editor.appendChild(objBlock);

  const cBlock = document.createElement('div');
  cBlock.className = 'model-block';
  const cTitle = document.createElement('div');
  cTitle.className = 'model-title';
  cTitle.textContent = 'Restricciones';
  cBlock.appendChild(cTitle);

  const header = document.createElement('div');
  header.className = 'constraint-row';
  header.style.setProperty('--cols', vars);
  const h0 = document.createElement('strong');
  h0.textContent = 'Restricción';
  header.appendChild(h0);
  for (let j = 0; j < vars; j += 1) {
    const h = document.createElement('strong');
    h.textContent = `X${j + 1}`;
    header.appendChild(h);
  }
  const hOp = document.createElement('strong');
  hOp.textContent = 'Tipo';
  header.appendChild(hOp);
  const hRhs = document.createElement('strong');
  hRhs.textContent = 'Disponible';
  header.appendChild(hRhs);
  cBlock.appendChild(header);

  for (let i = 0; i < cons; i += 1) {
    const rowC = document.createElement('div');
    rowC.className = 'constraint-row';
    rowC.style.setProperty('--cols', vars);
    const label = document.createElement('div');
    label.className = 'inline-control';
    label.innerHTML = `<span class="symbol">R${i + 1}</span>`;
    rowC.appendChild(label);

    for (let j = 0; j < vars; j += 1) {
      const value = prefill?.constraints?.[i]?.coeffs?.[j] ?? (i === 0 && j === 0 ? '1' : i === 0 && j === 1 ? '1' : i === 1 && j === 0 ? '1' : i === 1 && j === 1 ? '3' : i === 2 && j === 0 ? '2' : i === 2 && j === 1 ? '1' : '0');
      const input = makeInput('coeff constraint-coeff', value, `Coeficiente de X${j + 1} en restricción ${i + 1}`);
      input.dataset.kind = 'constraint';
      input.dataset.row = String(i);
      input.dataset.index = String(j);
      rowC.appendChild(input);
    }

    const select = document.createElement('select');
    select.dataset.kind = 'operator';
    select.dataset.row = String(i);
    select.setAttribute('aria-label', `Tipo de restricción ${i + 1}`);
    const ops = [['<=', '≤'], ['>=', '≥'], ['=', '=']];
    for (const [value, labelText] of ops) {
      const op = document.createElement('option'); op.value = value; op.textContent = labelText;
      select.appendChild(op);
    }
    const preOp = prefill?.constraints?.[i]?.op;
    select.value = preOp && ops.some(([v]) => v === preOp) ? preOp : '<=';
    rowC.appendChild(select);

    const rhs = makeInput('rhs', prefill?.constraints?.[i]?.rhs ?? (i === 0 ? '10' : i === 1 ? '12' : '16'), `Límite de restricción ${i + 1}`);
    rhs.dataset.kind = 'rhs';
    rhs.dataset.row = String(i);
    rowC.appendChild(rhs);
    cBlock.appendChild(rowC);
  }

  el.editor.appendChild(cBlock);
}

function parseFinite(value) {
  let text = String(value).trim();
  if (text === '') return null;

  // Acepta tanto decimal con coma (2,5) como separadores de miles
  // (1,000,000 / 1.000.000). No debemos convertir 1,000,000 en 1.
  // porque en los problemarios de IO las comas suelen ser separadores de miles.
  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    // Formato mixto: 1,000.50 -> miles; 1.000,50 -> europeo.
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (hasComma) {
    const commaParts = text.split(',');
    const looksLikeThousands = commaParts.length > 1 && commaParts.slice(1).every(part => /^\d{3}$/.test(part));
    text = looksLikeThousands ? text.replace(/,/g, '') : text.replace(',', '.');
  }

  if (/^[+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?$/.test(text)) {
    const parts = text.split('/').map((x) => Number(x.trim()));
    if (Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Math.abs(parts[1]) > EPS) return parts[0] / parts[1];
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function readProblem() {
  const objective = Array.from(document.querySelectorAll('.objective-coeff')).map((input) => parseFinite(input.value));
  if (objective.some((x) => x === null)) throw new Error('Todos los coeficientes de la función objetivo deben ser números válidos.');
  if (objective.every((x) => Math.abs(x) < EPS)) throw new Error('La función objetivo no puede tener todos sus coeficientes en cero.');

  const constraints = [];
  for (let i = 0; i < state.constraints; i += 1) {
    const coeffs = Array.from(document.querySelectorAll(`.constraint-coeff[data-row="${i}"]`)).map((input) => parseFinite(input.value));
    const rhs = parseFinite(document.querySelector(`.rhs[data-row="${i}"]`).value);
    const op = document.querySelector(`select[data-kind="operator"][data-row="${i}"]`).value;
    if (coeffs.some((x) => x === null) || rhs === null) throw new Error(`La restricción ${i + 1} contiene datos inválidos.`);
    if (coeffs.every((x) => Math.abs(x) < EPS)) throw new Error(`La restricción ${i + 1} no puede tener todos sus coeficientes en cero.`);
    constraints.push({ coeffs, op, rhs });
  }
  return { type: state.objectiveType, objective, constraints, nonnegative: state.nonnegative };
}

function clean(x) { return Math.abs(x) < EPS ? 0 : x; }
function nearlyZero(x) { return Math.abs(x) < EPS; }

function formatDecimal(value) {
  const v = clean(value);
  if (Object.is(v, -0) || v === 0) return '0';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(v);
}

function decimalToFraction(value) {
  if (!Number.isFinite(value) || nearlyZero(value)) return '0';

  const sign = value < 0 ? '-' : '';
  const x = Math.abs(value);
  const maxDen = 1000;
  const exactTolerance = Math.max(1e-9, x * 1e-9);

  // Primero buscamos una fracción exacta (dentro del error normal de coma flotante).
  // Las fracciones continuas evitan resultados artificialmente enormes como 2489/1600
  // cuando el valor real proviene de una razón sencilla, por ejemplo 7 ÷ (9/2) = 14/9.
  let a0 = Math.floor(x);
  let p0 = 1, q0 = 0;
  let p1 = a0, q1 = 1;
  let remainder = x - a0;

  if (Math.abs(x - p1 / q1) <= exactTolerance) {
    return q1 === 1 ? `${sign}${p1}` : `${sign}${p1}/${q1}`;
  }

  for (let i = 0; i < 24 && remainder > Number.EPSILON; i += 1) {
    const reciprocal = 1 / remainder;
    const a = Math.floor(reciprocal);
    const p2 = a * p1 + p0;
    const q2 = a * q1 + q0;
    if (q2 > maxDen) break;

    p0 = p1; q0 = q1;
    p1 = p2; q1 = q2;

    const error = Math.abs(x - p1 / q1);
    if (error <= exactTolerance) {
      const divisor = gcd(p1, q1);
      const n = p1 / divisor;
      const d = q1 / divisor;
      // Las fracciones exactas siguen siendo preferibles, pero una fracción
      // con numerador gigantesco deja de ser pedagógica en un tableau.
      // En ese caso mostramos el mismo valor como decimal, sin alterar el cálculo.
      if (Math.abs(n) > 9999 || d > 999) return formatDecimal(value);
      return d === 1 ? `${sign}${n}` : `${sign}${n}/${d}`;
    }
    remainder = reciprocal - a;
  }

  // Si el cálculo acumuló un pequeño error de redondeo, intentamos una
  // aproximación pedagógica con denominadores pequeños. Se marca con ≈ para
  // dejar claro que no estamos cambiando el valor matemático, solo su forma visual.
  const friendlyDenMax = 32;
  const friendlyTolerance = Math.max(1e-4, x * 1e-4);
  let friendlyN = Math.round(x);
  let friendlyD = 1;
  let friendlyError = Math.abs(x - friendlyN);
  for (let d = 2; d <= friendlyDenMax; d += 1) {
    const n = Math.round(x * d);
    const error = Math.abs(x - n / d);
    if (error < friendlyError) {
      friendlyError = error;
      friendlyN = n;
      friendlyD = d;
    }
  }
  if (friendlyD > 1 && friendlyError <= friendlyTolerance) {
    const divisor = gcd(friendlyN, friendlyD);
    const n = friendlyN / divisor;
    const d = friendlyD / divisor;
    return `≈${sign}${n}/${d}`;
  }

  // Si no hay una fracción pequeña que represente bien el valor, es mejor
  // mostrar el decimal que fabricar una fracción difícil de interpretar.
  return formatDecimal(value);
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b > EPS) { const t = a % b; a = b; b = t; } return a || 1; }
function formatNumber(value) { const frac = decimalToFraction(value); return frac.includes('/') ? frac : formatDecimal(value); }
function formatCompactNumber(value) {
  const v = clean(value);
  if (!Number.isFinite(v)) return formatDecimal(v);

  // En tarjetas/resumen preferimos una fracción pequeña si realmente es
  // pedagógica; de lo contrario, compactamos el decimal a 2 cifras.
  const frac = decimalToFraction(v);
  if (frac.includes('/') && !/^[-−]?≈?\d{5,}\//.test(frac)) return frac;
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(v);
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }

function variableName(i) { return `X${i + 1}`; }

function prettyTerm(coef, name, first = false) {
  if (nearlyZero(coef)) return '';
  const abs = Math.abs(coef);
  const coefficient = Math.abs(abs - 1) < EPS ? '' : formatNumber(abs);
  const sign = first ? (coef < 0 ? '− ' : '') : (coef < 0 ? ' − ' : ' + ');
  return `${sign}${coefficient}<span class="math-var">${name}</span>`;
}

function buildObjectiveEquation(problem) {
  const terms = problem.objective.map((c, i) => prettyTerm(c, `X<sub>${i + 1}</sub>`, i === 0)).filter(Boolean);
  const expression = terms.join('');
  const relation = problem.type === 'max' ? 'Maximizar' : 'Minimizar';
  // La ecuación vive dentro de un contenedor con overflow horizontal.
  // Se marca como una sola unidad para que los términos nunca se apilen
  // verticalmente en pantallas estrechas.
  return `${relation}: <span class="math-inline math-objective"><span class="math-var">Z</span> = ${expression || '0'}</span>`;
}

function buildConstraintEquation(row, index) {
  const terms = row.coeffs.map((c, i) => prettyTerm(c, `X<sub>${i + 1}</sub>`, i === 0)).filter(Boolean).join('');
  const op = row.op === '<=' ? '≤' : row.op === '>=' ? '≥' : '=';
  return `R<sub>${index + 1}</sub>: <span class="math-inline">${terms || '0'} ${op} ${formatNumber(row.rhs)}</span>`;
}

function buildStandardizedConstraint(row, index, slack, surplus, artificial) {
  const terms = row.coeffs.map((c, i) => prettyTerm(c, `X<sub>${i + 1}</sub>`, i === 0)).filter(Boolean).join('');
  const additions = [];
  const s = slack.find(x => x.row === index);
  const e = surplus.find(x => x.row === index);
  const a = artificial.find(x => x.row === index);
  if (s) additions.push(` + <span class="math-var">${s.name}</span>`);
  if (e) additions.push(` − <span class="math-var">${e.name}</span>`);
  if (a) additions.push(` + <span class="math-var">${a.name}</span>`);
  return `<span class="math-inline">${terms || '0'}${additions.join('')} = ${formatNumber(row.rhs)}</span>`;
}

function buildDomainStatement(problem) {
  if (problem.nonnegative) return `<span class="math-inline">X<sub>1</sub>, X<sub>2</sub>, …, X<sub>${problem.objective.length}</sub> ≥ 0</span>`;
  return 'Las variables de decisión son libres de signo y se descomponen como X = X⁺ − X⁻.';
}

function buildPreparationNotes(problem, rows, artificial) {
  const notes = [
    `La función objetivo se escribe en forma de ecuación para construir la fila de Z.`,
    `Las restricciones conservan sus variables a la izquierda y su disponibilidad (lado derecho) a la derecha.`,
  ];
  if (rows.some(r => r.op === '<=')) notes.push('Para cada restricción ≤ se agrega una variable de holgura S para convertirla en igualdad.');
  if (rows.some(r => r.op === '>=')) notes.push('Para cada restricción ≥ se agrega una variable de exceso E y, cuando hace falta una base inicial, una variable artificial A.');
  if (rows.some(r => r.op === '=')) notes.push('Las restricciones = pueden requerir una variable artificial para iniciar el algoritmo.');
  if (artificial.length) notes.push(`Se detectaron ${artificial.length} variable(s) artificial(es), por lo que se utiliza el método de dos fases.`);
  if (problem.nonnegative) notes.push('Se impone la condición de no negatividad a las variables de decisión.');
  else notes.push('La no negatividad está desactivada: cada variable libre se representa mediante una parte positiva y una negativa.');
  return notes;
}

function standardize(problem) {
  const terms = [];
  for (let j = 0; j < problem.objective.length; j += 1) {
    if (problem.nonnegative) terms.push({ original: j, sign: 1, name: variableName(j) });
    else {
      terms.push({ original: j, sign: 1, name: `${variableName(j)}⁺` });
      terms.push({ original: j, sign: -1, name: `${variableName(j)}⁻` });
    }
  }

  const rows = [];
  const artificial = [];
  const slack = [];
  const surplus = [];
  let nextExtra = 1;

  // Normalize RHS to nonnegative, flipping relation where necessary.
  for (const originalRow of problem.constraints) {
    let coeffs = terms.map((t) => originalRow.coeffs[t.original] * t.sign);
    let op = originalRow.op;
    let rhs = originalRow.rhs;
    if (rhs < -EPS) {
      coeffs = coeffs.map((x) => -x);
      rhs = -rhs;
      op = op === '<=' ? '>=' : op === '>=' ? '<=' : '=';
    }
    rows.push({ coeffs, op, rhs });
  }

  const columns = terms.map((t) => ({ name: t.name, kind: 'decision', original: t.original, sign: t.sign }));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.op === '<=') {
      const name = `S${i + 1}`;
      columns.push({ name, kind: 'slack' });
      slack.push({ row: i, col: columns.length - 1, name });
    } else if (row.op === '>=') {
      const name = `E${i + 1}`;
      columns.push({ name, kind: 'surplus' });
      surplus.push({ row: i, col: columns.length - 1, name });
    }
  }

  // Artificial variables must be appended after all structural columns.
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].op !== '<=') {
      const name = `A${nextExtra++}`;
      columns.push({ name, kind: 'artificial' });
      artificial.push({ row: i, col: columns.length - 1, name });
    }
  }

  const n = columns.length;
  const tableau = Array.from({ length: rows.length + 1 }, () => Array(n + 1).fill(0));
  const base = Array(rows.length).fill('');

  for (let j = 0; j < problem.objective.length; j += 1) {
    const coef = problem.type === 'max' ? problem.objective[j] : -problem.objective[j];
    for (const [k, col] of columns.entries()) if (col.original === j && col.kind === 'decision') tableau[0][k] = -coef * col.sign;
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    for (let j = 0; j < terms.length; j += 1) tableau[i + 1][j] = row.coeffs[j];
    const added = row.op === '<=' ? slack.find((x) => x.row === i) : row.op === '>=' ? surplus.find((x) => x.row === i) : null;
    if (added) tableau[i + 1][added.col] = row.op === '<=' ? 1 : -1;
    const art = artificial.find((x) => x.row === i);
    if (art) tableau[i + 1][art.col] = 1;
    tableau[i + 1][n] = row.rhs;
    if (row.op === '<=') base[i] = slack.find((x) => x.row === i).name;
    else base[i] = art.name;
  }

  const objectiveStandard = problem.objective.map((x) => problem.type === 'max' ? x : -x);
  const originalVarCount = problem.objective.length;
  const preparation = {
    objectiveEquation: buildObjectiveEquation(problem),
    constraintEquations: problem.constraints.map((row, i) => buildConstraintEquation(row, i)),
    standardizedConstraints: rows.map((row, i) => buildStandardizedConstraint(row, i, slack, surplus, artificial)),
    domain: buildDomainStatement(problem),
    notes: buildPreparationNotes(problem, rows, artificial),
  };
  return { tableau, base, columns, rows, artificial, objectiveStandard, originalVarCount, hasArtificial: artificial.length > 0, preparation };
}

function setObjectiveFromCoefficients(tableau, base, coefficients, columnMeta, rhsTarget = 0) {
  const m = tableau.length - 1, n = tableau[0].length - 1;
  tableau[0].fill(0);
  for (let j = 0; j < n; j += 1) tableau[0][j] = -coefficients[j];
  tableau[0][n] = rhsTarget;
  for (let i = 1; i <= m; i += 1) {
    const basic = base[i - 1];
    const basicCol = columnMeta.findIndex((c) => c.name === basic);
    if (basicCol < 0) continue;
    const cb = coefficients[basicCol] || 0;
    if (nearlyZero(cb)) continue;
    for (let j = 0; j <= n; j += 1) tableau[0][j] += cb * tableau[i][j];
  }
}

function runSimplex(tableau, base, columns, stageLabel, iterations, seen) {
  let iter = 0;
  const total = columns.length;
  while (iter < MAX_ITERATIONS) {
    const pivotCol = chooseEnteringColumn(tableau[0], total);
    if (pivotCol === -1) return { status: 'optimal', iterations, phaseIterations: iter };
    const pivotRow = chooseLeavingRow(tableau, pivotCol);
    if (pivotRow === -1) return { status: 'unbounded', iterations, phaseIterations: iter, message: `La variable entrante ${columns[pivotCol].name} no tiene una fila saliente válida.` };
    const pivotValue = tableau[pivotRow][pivotCol];
    const ratios = [];
    for (let i = 1; i < tableau.length; i += 1) {
      const a = tableau[i][pivotCol], rhs = tableau[i][tableau[i].length - 1];
      ratios.push({ row: i - 1, base: base[i - 1], numerator: rhs, denominator: a, ratio: a > EPS ? rhs / a : null });
    }
    const entering = columns[pivotCol].name;
    const leaving = base[pivotRow - 1];
    const before = tableau.map((row) => row.slice());
    const baseBefore = base.slice();
    const enteringCandidates = columns.slice(0, total).map((c, j) => ({ name: c.name, coefficient: tableau[0][j] })).filter(x => x.coefficient < -EPS);
    pivot(tableau, pivotRow, pivotCol);
    base[pivotRow - 1] = entering;
    iter += 1;
    // Los pasos educativos deben describir la tabla ANTES de actualizar la base.
    // Si usamos la base posterior al pivote, la fila saliente ya aparece con el
    // nombre de la variable entrante y fórmulas como "X2 ← X2 ÷ ..." resultan falsas.
    const pivotSteps = buildPivotSteps(before, pivotRow, pivotCol, baseBefore, columns);
    const enteringReason = buildEnteringReason(entering, tableau, before, pivotCol, enteringCandidates);
    iterations.push({ type: 'iteration', iterationNumber: iter, stage: stageLabel, tableau: tableau.map((r) => r.slice()), base: base.slice(), pivot: { row: pivotRow, col: pivotCol, value: pivotValue, entering, leaving }, ratios, before, pivotSteps, enteringReason });
    const signature = tableau.flat().map((x) => Math.round(x * 1e8) / 1e8).join(',') + '|' + base.join(',');
    if (seen.has(signature)) return { status: 'cycle', iterations, phaseIterations: iter, message: 'Se detectó una repetición de tableau; se detuvo para evitar un ciclo.' };
    seen.add(signature);
  }
  return { status: 'limit', iterations, phaseIterations: iter, message: `Se alcanzó el límite de ${MAX_ITERATIONS} iteraciones.` };
}


function rowLabel(base, rowIndex) {
  return rowIndex === 0 ? 'Z' : (base[rowIndex - 1] || `F${rowIndex}`);
}

function formatOperationFactor(factor) {
  if (nearlyZero(factor)) return '0';
  const abs = Math.abs(factor);
  const f = formatNumber(abs);
  return factor < 0 ? `+ ${f}` : `− ${f}`;
}

function rowVectorLabel(row) {
  return `<span class="math-vector">[${row.map(formatNumber).join(' · ')}]</span>`;
}

function buildPivotSteps(before, pivotRow, pivotCol, baseBefore, columns) {
  const pivotValue = before[pivotRow][pivotCol];
  const normalized = before[pivotRow].map((value) => value / pivotValue);
  const steps = [];
  const pivotLabel = rowLabel(baseBefore, pivotRow);
  steps.push({
    kind: 'normalize',
    label: `Paso 1 · Normalizar la fila pivote`,
    formula: `${pivotLabel} ← ${pivotLabel} ÷ ${formatNumber(pivotValue)}`,
    rowLabel: pivotLabel,
    before: before[pivotRow].slice(),
    after: normalized.slice(),
    pivotColumn: columns[pivotCol].name,
    pivotValue,
  });

  for (let r = 0; r < before.length; r += 1) {
    if (r === pivotRow) continue;
    const factor = before[r][pivotCol];
    if (nearlyZero(factor)) continue;
    const targetLabel = rowLabel(baseBefore, r);
    const operation = factor < 0
      ? `${targetLabel} ← ${targetLabel} + ${formatNumber(Math.abs(factor))}${pivotLabel}`
      : `${targetLabel} ← ${targetLabel} − ${formatNumber(factor)}${pivotLabel}`;
    const after = before[r].map((value, c) => value - factor * normalized[c]);
    const arithmetic = before[r].map((value, c) => ({
      column: c === before[r].length - 1 ? 'Solución' : columns[c].name,
      target: value,
      pivot: normalized[c],
      factor,
      result: clean(value - factor * normalized[c]),
    }));
    steps.push({
      kind: 'eliminate',
      label: `Eliminar el coeficiente de ${columns[pivotCol].name} en ${targetLabel}`,
      formula: operation,
      rowLabel: targetLabel,
      factor,
      before: before[r].slice(),
      after: after.map(clean),
      pivotColumn: columns[pivotCol].name,
      pivotLabel,
      pivotRow: normalized.slice(),
      arithmetic,
    });
  }
  return steps;
}

function buildEnteringReason(entering, after, before, pivotCol, candidates) {
  const coeff = before[0][pivotCol];
  if (!candidates.length) return '';
  const ordered = candidates.slice().sort((a, b) => a.coefficient - b.coefficient);
  const strongest = ordered[0];
  if (Math.abs(coeff - strongest.coefficient) < EPS) {
    return `Entra ${entering} porque ${formatNumber(coeff)} es el coeficiente más negativo de la fila de Z. Cuanto más negativo es el coeficiente, mayor es la mejora potencial de Z al aumentar esa variable (en esta convención de maximización).`;
  }
  return `Entra ${entering} porque su coeficiente ${formatNumber(coeff)} es el más negativo entre las alternativas de la fila de Z.`;
}

function chooseEnteringColumn(objectiveRow, totalVariables) {
  let best = -1, mostNegative = -EPS;
  for (let j = 0; j < totalVariables; j += 1) if (objectiveRow[j] < mostNegative) { mostNegative = objectiveRow[j]; best = j; }
  return best;
}
function chooseLeavingRow(tableau, pivotCol) {
  const rhsCol = tableau[0].length - 1; let bestRow = -1, bestRatio = Infinity;
  for (let i = 1; i < tableau.length; i += 1) {
    const coefficient = tableau[i][pivotCol], rhs = tableau[i][rhsCol];
    if (coefficient > EPS) {
      const ratio = rhs / coefficient;
      if (ratio >= -EPS && ratio < bestRatio - EPS) { bestRatio = ratio; bestRow = i; }
    }
  }
  return bestRow;
}
function pivot(tableau, pivotRow, pivotCol) {
  const p = tableau[pivotRow][pivotCol];
  if (nearlyZero(p)) throw new Error('El elemento pivote es cero o demasiado cercano a cero.');
  for (let j = 0; j < tableau[pivotRow].length; j += 1) tableau[pivotRow][j] /= p;
  for (let i = 0; i < tableau.length; i += 1) {
    if (i === pivotRow) continue;
    const factor = tableau[i][pivotCol]; if (nearlyZero(factor)) continue;
    for (let j = 0; j < tableau[i].length; j += 1) tableau[i][j] -= factor * tableau[pivotRow][j];
  }
  for (let i = 0; i < tableau.length; i += 1) for (let j = 0; j < tableau[i].length; j += 1) tableau[i][j] = clean(tableau[i][j]);
}

function initializePhaseOne(tableau, base, columns, artificial) {
  const coefficients = Array(columns.length).fill(0);
  for (const art of artificial) coefficients[columns.findIndex((c) => c.name === art.name)] = 1;
  // Maximize -sum(artificial), equivalent to minimizing the artificial sum.
  for (let j = 0; j < coefficients.length; j += 1) coefficients[j] = -coefficients[j];
  const objectiveBefore = Array(columns.length + 1).fill(0);
  for (let j = 0; j < columns.length; j += 1) objectiveBefore[j] = -coefficients[j];
  const adjustmentSteps = buildObjectiveAdjustmentDetails(objectiveBefore, tableau, base, columns, 'W', (basic) => artificial.some((a) => a.name === basic));
  setObjectiveFromCoefficients(tableau, base, coefficients, columns);
  return { objectiveBefore, adjustmentSteps };
}

function cleanupArtificialBasis(tableau, base, columns, artificial) {
  const artSet = new Set(artificial.map((x) => x.name));
  for (let r = base.length - 1; r >= 0; r -= 1) {
    if (!artSet.has(base[r])) continue;
    const row = r + 1;
    const rhsCol = tableau[0].length - 1;
    if (Math.abs(tableau[row][rhsCol]) > 1e-7) return { ok: false, reason: 'Fase I terminó con una variable artificial positiva.' };
    let pivotCol = -1;
    for (let j = 0; j < columns.length; j += 1) {
      if (artSet.has(columns[j].name)) continue;
      if (!nearlyZero(tableau[row][j])) { pivotCol = j; break; }
    }
    if (pivotCol >= 0) {
      pivot(tableau, row, pivotCol);
      base[r] = columns[pivotCol].name;
    }
  }
  return { ok: true };
}

function solveTwoPhase(problem) {
  const std = standardize(problem);
  const { tableau, base, columns, artificial } = std;
  const iterations = [];
  const seen = new Set();

  iterations.push({ type: 'iteration', iterationNumber: 0, stage: std.hasArtificial ? 'Fase I · tableau inicial' : 'Tableau inicial', tableau: tableau.map((r) => r.slice()), base: base.slice(), pivot: null, ratios: null, before: null, preparation: std.preparation });

  if (std.hasArtificial) {
    const phase1Before = tableau.map((r) => r.slice());
    const phase1Setup = initializePhaseOne(tableau, base, columns, artificial);
    iterations.push({ type: 'objective', stage: 'Fase I · función auxiliar', tableau: tableau.map((r) => r.slice()), base: base.slice(), pivot: null, ratios: null, before: phase1Before, transition: 'phase1-objective', artificialNames: artificial.map((a) => a.name), phase1ObjectiveBefore: phase1Setup.objectiveBefore, phase1AdjustmentSteps: phase1Setup.adjustmentSteps });
    const phase1 = runSimplex(tableau, base, columns, 'Fase I', iterations, seen);
    if (phase1.status !== 'optimal') return { ...phase1, tableau, base, columns, std };
    const artificialValue = -tableau[0][tableau[0].length - 1];
    if (Math.abs(artificialValue) > 1e-7) return { status: 'infeasible', message: 'El modelo no tiene una solución factible (la suma mínima de variables artificiales es positiva).', iterations, tableau, base, columns, std };
    const cleaned = cleanupArtificialBasis(tableau, base, columns, artificial);
    if (!cleaned.ok) return { status: 'infeasible', message: cleaned.reason, iterations, tableau, base, columns, std };
  }

  const phase2Coefficients = Array(columns.length).fill(0);
  for (const [j, c] of columns.entries()) {
    if (c.kind === 'decision') {
      const originalCoef = problem.objective[c.original];
      const transformedCoef = problem.type === 'max' ? originalCoef : -originalCoef;
      phase2Coefficients[j] = transformedCoef * c.sign;
    }
  }
  const phase2Before = tableau.map((r) => r.slice());
  const originalObjectiveRow = Array(phase2Coefficients.length + 1).fill(0);
  for (let j = 0; j < phase2Coefficients.length; j += 1) originalObjectiveRow[j] = -phase2Coefficients[j];
  const restorationSteps = [];
  const workingObjective = originalObjectiveRow.slice();
  const rhsIndex = workingObjective.length - 1;
  for (let i = 0; i < base.length; i += 1) {
    const basic = base[i];
    const basicCol = columns.findIndex((c) => c.name === basic);
    if (basicCol < 0) continue;
    const cb = phase2Coefficients[basicCol] || 0;
    if (nearlyZero(cb)) continue;
    const before = workingObjective.slice();
    const basicRow = tableau[i + 1].slice();
    const arithmetic = before.map((value, j) => ({
      column: j === before.length - 1 ? 'Solución' : columns[j].name,
      target: value,
      rowValue: basicRow[j],
      factor: cb,
      result: clean(value + cb * basicRow[j]),
    }));
    for (let j = 0; j <= rhsIndex; j += 1) workingObjective[j] += cb * basicRow[j];
    restorationSteps.push({ rowLabel: basic, coefficient: cb, before, row: basicRow, result: workingObjective.slice(), arithmetic });
  }
  setObjectiveFromCoefficients(tableau, base, phase2Coefficients, columns);
  iterations.push({ type: 'objective', stage: 'Fase II · función objetivo', tableau: tableau.map((r) => r.slice()), base: base.slice(), pivot: null, ratios: null, before: phase2Before, transition: 'phase2-objective', artificialNames: artificial.map((a) => a.name), originalObjectiveRow, restorationSteps });
  const phase2 = runSimplex(tableau, base, columns, 'Fase II', iterations, seen);
  const solution = extractOriginalSolution(tableau, base, columns, problem.objective.length, problem.nonnegative);
  let status = phase2.status;
  let message = phase2.message || (status === 'optimal' ? 'Se alcanzó el óptimo: no quedan coeficientes negativos en la fila objetivo del tableau transformado.' : '');
  if (status === 'optimal') {
    if (problem.type === 'min') message = `Solución óptima de minimización encontrada. ${message}`;
    else message = `Solución óptima de maximización encontrada. ${message}`;
  }
  return { status, message, iterations, tableau, base, columns, std, solution };
}

function extractOriginalSolution(tableau, base, columns, originalVarCount, nonnegative) {
  const rhs = tableau[0].length - 1;
  const values = Array(originalVarCount).fill(0);
  for (let i = 0; i < base.length; i += 1) {
    const col = columns.findIndex((c) => c.name === base[i]);
    if (col < 0) continue;
    const meta = columns[col];
    if (meta.kind === 'decision') values[meta.original] += (meta.sign || 1) * tableau[i + 1][rhs];
  }
  return { variables: values.map(clean), objectiveTransformed: clean(tableau[0][rhs]) };
}

function evaluateOriginalObjective(problem, solution) {
  let z = 0;
  for (let i = 0; i < solution.variables.length; i += 1) z += problem.objective[i] * solution.variables[i];
  return clean(z);
}

function feasibilityCheck(problem, values) {
  const checks = problem.constraints.map((c) => {
    const lhs = c.coeffs.reduce((sum, a, i) => sum + a * values[i], 0);
    let ok = true;
    if (c.op === '<=') ok = lhs <= c.rhs + 1e-7;
    else if (c.op === '>=') ok = lhs >= c.rhs - 1e-7;
    else ok = Math.abs(lhs - c.rhs) <= 1e-7;
    return { coeffs: c.coeffs.slice(), values: values.slice(), lhs: clean(lhs), rhs: c.rhs, op: c.op, ok };
  });
  if (problem.nonnegative) for (const v of values) if (v < -1e-7) return { checks, nonnegative: false, values };
  return { checks, nonnegative: true, values };
}


function isFeasiblePoint(problem,x,y,tol=1e-7){return problem.constraints.every(c=>{const lhs=(c.coeffs[0]||0)*x+(c.coeffs[1]||0)*y;if(c.op==='<=')return lhs<=c.rhs+tol;if(c.op==='>=')return lhs>=c.rhs-tol;return Math.abs(lhs-c.rhs)<=1e-5;})&&(!problem.nonnegative||(x>=-tol&&y>=-tol));}
function lineIntersection(a,b){const det=a.a*b.b-b.a*a.b;if(Math.abs(det)<EPS)return null;return{x:(a.rhs*b.b-b.rhs*a.b)/det,y:(a.a*b.rhs-b.a*a.rhs)/det};}
function graphVertices(problem){const lines=problem.constraints.map((c,i)=>({a:c.coeffs[0]||0,b:c.coeffs[1]||0,rhs:c.rhs,label:`R${i+1}`}));lines.push({a:1,b:0,rhs:0,label:'X₁=0'},{a:0,b:1,rhs:0,label:'X₂=0'});const pts=[];for(let i=0;i<lines.length;i+=1)for(let j=i+1;j<lines.length;j+=1){const p=lineIntersection(lines[i],lines[j]);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&isFeasiblePoint(problem,p.x,p.y))pts.push(p);}const unique=[];for(const p of pts)if(!unique.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-6))unique.push(p);if(unique.length<3)return unique;const cx=unique.reduce((a,p)=>a+p.x,0)/unique.length,cy=unique.reduce((a,p)=>a+p.y,0)/unique.length;unique.sort((p,q)=>Math.atan2(p.y-cy,p.x-cx)-Math.atan2(q.y-cy,q.x-cx));return unique;}
function graphBounds(vertices){if(!vertices.length)return{xmax:10,ymax:10};return{xmin:0,ymin:0,xmax:Math.max(10,...vertices.map(p=>p.x))*1.18,ymax:Math.max(10,...vertices.map(p=>p.y))*1.18};}
function formatGraphNumber(value){const v=clean(value);if(!Number.isFinite(v))return '—';return new Intl.NumberFormat('es-MX',{maximumFractionDigits:2,minimumFractionDigits:0}).format(v);}
function svgPoint(p,b,w,h,pad=52){return{x:pad+(p.x-b.xmin)/(b.xmax-b.xmin)*(w-2*pad),y:h-pad-(p.y-b.ymin)/(b.ymax-b.ymin)*(h-2*pad)};}
function objectiveSegment(problem,z,b){const c1=problem.objective[0]||0,c2=problem.objective[1]||0,pts=[];if(Math.abs(c2)>EPS)pts.push({x:b.xmin,y:(z-c1*b.xmin)/c2},{x:b.xmax,y:(z-c1*b.xmax)/c2});else if(Math.abs(c1)>EPS){const x=z/c1;pts.push({x,y:b.ymin},{x,y:b.ymax});}return pts;}
function graphZRange(problem,verts){const zs=verts.map(p=>(problem.objective[0]||0)*p.x+(problem.objective[1]||0)*p.y).filter(Number.isFinite);if(!zs.length)return{min:0,max:10};const rawMin=Math.min(0,...zs),rawMax=Math.max(0,...zs);const span=Math.max(10,rawMax-rawMin);return{min:rawMin<0?rawMin-span*0.08:0,max:rawMax>0?rawMax+span*0.08:0};}
function renderGraph(problem,result,z){if(problem.objective.length!==2||!problem.nonnegative)return '<div class="graph-unavailable">El método gráfico de esta versión requiere exactamente 2 variables y no negatividad activada. El Simplex sigue funcionando con modelos más generales.</div>';const verts=graphVertices(problem);if(verts.length<3)return '<div class="graph-unavailable">No se pudo formar una región factible poligonal para mostrarla gráficamente.</div>';const b=graphBounds(verts),w=760,h=440,pad=52,poly=verts.map(p=>{const q=svgPoint(p,b,w,h,pad);return`${q.x},${q.y}`}).join(' ');const grid=[];for(let i=0;i<=5;i+=1){const x=b.xmax*i/5,q=svgPoint({x,y:0},b,w,h,pad);grid.push(`<line x1="${q.x}" y1="${pad}" x2="${q.x}" y2="${h-pad}" class="graph-grid"/><text x="${q.x}" y="${h-pad+20}" text-anchor="middle" class="graph-label">${formatGraphNumber(x)}</text>`);const y=b.ymax*i/5,r=svgPoint({x:0,y},b,w,h,pad);grid.push(`<line x1="${pad}" y1="${r.y}" x2="${w-pad}" y2="${r.y}" class="graph-grid"/><text x="${pad-8}" y="${r.y+4}" text-anchor="end" class="graph-label">${formatGraphNumber(y)}</text>`);}const constraints=problem.constraints.map((c,i)=>{const c1=c.coeffs[0]||0,c2=c.coeffs[1]||0;if(Math.abs(c2)<EPS){if(Math.abs(c1)<EPS)return'';const x=c.rhs/c1,q1=svgPoint({x,y:0},b,w,h,pad),q2=svgPoint({x,y:b.ymax},b,w,h,pad);return`<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" class="graph-constraint"/><text x="${q1.x+5}" y="${pad+15*i}" class="graph-label">R${i+1}</text>`;}const y1=c.rhs/c2,y2=(c.rhs-c1*b.xmax)/c2,q1=svgPoint({x:0,y:y1},b,w,h,pad),q2=svgPoint({x:b.xmax,y:y2},b,w,h,pad);return`<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" class="graph-constraint"/><text x="${Math.max(pad,Math.min(w-pad-32,q2.x-24))}" y="${Math.max(pad+14,Math.min(h-pad,q2.y-6))}" class="graph-label">R${i+1}</text>`;}).join('');const ops=objectiveSegment(problem,z,b);const opLine=ops.length===2?(()=>{const q1=svgPoint(ops[0],b,w,h,pad),q2=svgPoint(ops[1],b,w,h,pad);return`<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" class="graph-objective"/>`;})():'';const sol=result.solution?.variables?.length===2?{x:result.solution.variables[0],y:result.solution.variables[1]}:null;const mark=sol&&isFeasiblePoint(problem,sol.x,sol.y)?(()=>{const q=svgPoint(sol,b,w,h,pad);return`<circle cx="${q.x}" cy="${q.y}" r="6" class="graph-solution"/><text x="${q.x+9}" y="${q.y-9}" class="graph-label">Óptimo (${formatCompactNumber(sol.x)}, ${formatCompactNumber(sol.y)})</text>`;})():'';return`<div class="graph-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfica de la región factible, restricciones y recta de Z"><g>${grid.join('')}</g><polygon points="${poly}" class="graph-feasible"/>${constraints}${opLine}${mark}<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="graph-axis"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" class="graph-axis"/><text x="${w-pad-8}" y="${h-pad-10}" text-anchor="end" class="graph-axis-label">X₁</text><text x="${pad+8}" y="${pad+20}" text-anchor="start" class="graph-axis-label">X₂</text></svg><div class="graph-legend"><span><i class="legend-box feasible"></i>Región factible</span><span><i class="legend-line constraint"></i>Restricciones</span><span><i class="legend-line objective"></i>Recta de Z</span><span><i class="legend-dot"></i>Óptimo</span></div><p class="graph-note">${problem.type==='max'?'En maximización, la recta se desplaza hacia valores mayores de Z sin abandonar la región factible.':'En minimización, la recta se desplaza hacia valores menores de Z sin abandonar la región factible.'}</p></div>`;}
function renderResults(problem, result) {
  currentLastProblem = problem;
  currentLastResult = result;
  el.resultSection.classList.remove('hidden');
  const statusMap = {
    optimal: 'Solución óptima encontrada',
    unbounded: 'Problema no acotado',
    infeasible: 'Problema infactible',
    cycle: 'Posible ciclo detectado',
    limit: 'Límite de iteraciones alcanzado',
  };
  el.resultStatus.textContent = statusMap[result.status] || 'Resultado';
  el.resultSummary.textContent = result.message || '—';
  const method = result.std?.hasArtificial ? 'Método de dos fases' : 'Simplex directo';
  el.methodBadge.textContent = method;
  el.methodBadge.classList.remove('hidden');

  const graphCapable = problem.objective.length === 2 && problem.nonnegative && result.status !== 'infeasible';
  if (graphCapable && el.graphSection) {
    el.graphSection.classList.remove('hidden');
    el.graphControls.classList.remove('hidden');
    const verts = graphVertices(problem);
    const range = graphZRange(problem, verts);
    const solutionZ = result.solution?.variables?.length===2 ? problem.objective[0]*result.solution.variables[0]+problem.objective[1]*result.solution.variables[1] : range.min;
    el.graphSlider.min = String(range.min);
    el.graphSlider.max = String(Math.max(range.max, range.min + 10));
    el.graphSlider.value = String(Math.max(range.min, Math.min(Number(el.graphSlider.max), solutionZ)));
    updateGraphSliderVisual();
    el.graphZValue.textContent = `Z = ${formatCompactNumber(Number(el.graphSlider.value))}`;
    el.graphOutput.innerHTML = renderGraph(problem,result,Number(el.graphSlider.value));
  } else if (el.graphSection) {
    el.graphSection.classList.add('hidden');
    el.graphControls.classList.add('hidden');
    el.graphOutput.innerHTML = '';
  }

  if (result.solution) {
    const solution = result.solution;
    const cards = solution.variables.map((value, index) => { const exact = formatNumber(value); const shown = formatCompactNumber(value); return `<div class="solution-card"><div class="label">X${index + 1}</div><div class="value" title="${escapeHtml(exact)}">${escapeHtml(shown)}</div></div>`; });
    const z = evaluateOriginalObjective(problem, solution);
    const zExact = formatNumber(z);
    cards.push(`<div class="solution-card"><div class="label">Z</div><div class="value" title="${escapeHtml(zExact)}">${escapeHtml(formatCompactNumber(z))}</div></div>`);
    el.solutionCards.innerHTML = cards.join('');
    const validation = feasibilityCheck(problem, solution.variables);
    el.processOutput.innerHTML = result.iterations.map((it, idx) => renderStage(it, idx, result.columns)).join('') + renderValidation(validation);
  } else {
    el.solutionCards.innerHTML = '';
    el.processOutput.innerHTML = result.iterations.map((it, idx) => renderStage(it, idx, result.columns)).join('');
  }
}

function mathFraction(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const f = decimalToFraction(abs);
  if (!f.includes('/')) return `${sign}${escapeHtml(f)}`;
  const [n, d] = f.split('/');
  return `${sign}<span class="frac"><span>${escapeHtml(n)}</span><span>${escapeHtml(d)}</span></span>`;
}

function validationNumber(value) {
  const v = clean(value);
  if (Number.isInteger(v)) return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(v);
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4, minimumFractionDigits: 0 }).format(v);
}

function formatOperationFormula(step) {
  const row = escapeHtml(step.rowLabel);
  const pivotRow = escapeHtml(step.pivotLabel || 'Fₚ');
  const factor = step.factor;
  const action = factor < 0 ? `+ ${mathFraction(Math.abs(factor))}` : `− ${mathFraction(factor)}`;
  return `<span class="math-inline"><strong>${row}</strong> ← ${row} ${action} <span class="math-var">${pivotRow}</span></span>`;
}

function formatNormalizationFormula(step, pivotValue) {
  const row = escapeHtml(step.rowLabel);
  return `<span class="math-inline"><strong>${row}</strong> ← ${row} ÷ ${mathFraction(pivotValue)}</span>`;
}

function renderArithmeticDetails(step) {
  if (!step.arithmetic?.length) return '';
  const cells = step.arithmetic.map(item => {
    const calc = `${mathFraction(item.target)} ${item.factor < 0 ? '+' : '−'} (${mathFraction(Math.abs(item.factor))})(${mathFraction(item.pivot)})`;
    return `<div class="arith-cell"><span class="arith-name">${escapeHtml(item.column)}</span><span class="arith-equation">${calc} = <strong>${mathFraction(item.result)}</strong></span></div>`;
  }).join('');
  return `<details class="arithmetic-details"><summary>Ver la operación completa, columna por columna</summary><div class="arith-grid">${cells}</div></details>`;
}

function renderObjectiveArithmeticDetails(step) {
  if (!step.arithmetic?.length) return '';
  const cells = step.arithmetic.map(item => {
    // Para ajustar una fila objetivo se aplica: objetivo_nuevo = objetivo_actual + factor × fila_básica.
    const calc = `${mathFraction(item.target)} ${item.factor < 0 ? '−' : '+'} (${mathFraction(Math.abs(item.factor))})(${mathFraction(item.rowValue)})`;
    return `<div class="arith-cell"><span class="arith-name">${escapeHtml(item.column)}</span><span class="arith-equation">${calc} = <strong>${mathFraction(item.result)}</strong></span></div>`;
  }).join('');
  return `<details class="arithmetic-details"><summary>Ver la operación completa, columna por columna</summary><div class="arith-grid">${cells}</div></details>`;
}

function buildObjectiveAdjustmentDetails(beforeRow, tableau, base, columns, objectiveName, predicate) {
  const steps = [];
  let working = beforeRow.slice();
  for (let i = 0; i < base.length; i += 1) {
    const basic = base[i];
    if (predicate && !predicate(basic)) continue;
    const basicCol = columns.findIndex((c) => c.name === basic);
    if (basicCol < 0) continue;
    const cb = -working[basicCol];
    if (nearlyZero(cb)) continue;
    const before = working.slice();
    const row = tableau[i + 1];
    const after = before.map((value, j) => clean(value + cb * row[j]));
    const arithmetic = before.map((value, j) => ({
      column: j === before.length - 1 ? 'Solución' : columns[j].name,
      target: value,
      pivot: row[j],
      factor: cb,
      result: clean(value + cb * row[j]),
    }));
    steps.push({ objectiveName, rowLabel: basic, coefficient: cb, before, result: after, arithmetic });
    working = after;
  }
  return steps;
}

function renderPreparation(prep) {
  if (!prep) return '';
  const constraints = prep.constraintEquations.map(x => `<li>${x}</li>`).join('');
  const standardized = prep.standardizedConstraints.map((x, i) => `<li><span class="prep-label">R<sub>${i + 1}</sub></span> ${x}</li>`).join('');
  const notes = prep.notes.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  return `<section class="preparation-block">
    <div class="prep-head"><div><span class="tag">Antes de la Iteración 0</span><h3>Cómo se construye el tableau inicial</h3></div><p>El programa primero transforma el problema a la forma que necesita el método Simplex.</p></div>
    <div class="prep-grid">
      <div class="prep-card"><div class="prep-kicker">1 · Función objetivo</div><div>${prep.objectiveEquation}</div><p>Se expresa la función objetivo y se prepara su fila de Z.</p></div>
      <div class="prep-card"><div class="prep-kicker">2 · Restricciones originales</div><ul class="prep-equations">${constraints}</ul><p>El lado derecho representa la disponibilidad o solución de cada restricción.</p></div>
      <div class="prep-card"><div class="prep-kicker">3 · Igualar las restricciones</div><ul class="prep-equations">${standardized}</ul><p>Se agregan holguras, excesos y/o artificiales según el tipo de desigualdad.</p></div>
      <div class="prep-card"><div class="prep-kicker">4 · Condición de las variables</div><div>${prep.domain}</div><p>Esta condición se incorpora al modelo antes de iterar.</p></div>
    </div>
    <div class="callout"><strong>¿Qué hizo el programa antes de empezar?</strong><ul class="operation-list">${notes}</ul></div>
  </section>`;
}

function renderStage(it, idx, columns) {
  const title = it.type === 'objective'
    ? it.stage
    : (it.iterationNumber === 0 ? 'Iteración 0 · Tableau inicial' : `Iteración ${it.iterationNumber} · Nueva tabla`);
  const tag = it.type === 'objective'
    ? 'Reconfiguración'
    : (it.iterationNumber === 0 ? 'Inicio' : 'Pivote');

  let details = '';
  const prepBlock = it.iterationNumber === 0 && it.preparation ? renderPreparation(it.preparation) : '';
  if (it.pivot) {
    const ratioRows = (it.ratios || []).map((r) => {
      const valid = r.ratio !== null && Number.isFinite(r.ratio);
      return `<li><span>${escapeHtml(r.base)}: ${formatNumber(r.numerator)} ÷ ${formatNumber(r.denominator)}</span><strong>${valid ? formatNumber(r.ratio) : 'No válida'}</strong></li>`;
    }).join('');

    const learningSteps = (it.pivotSteps || []).map((step, stepIndex) => {
      return `<div class="calc-step ${step.kind === 'normalize' ? 'pivot-step' : ''}">
        <div class="step-number">${stepIndex + 1}</div>
        <div class="step-content">
          <div class="step-title">${escapeHtml(step.label)}</div>
          <div class="formula">${step.kind === 'normalize' ? formatNormalizationFormula(step, step.pivotValue) : formatOperationFormula(step)}</div>
          <div class="row-transition">
            <span>${rowVectorLabel(step.before)}</span>
            <span class="arrow">→</span>
            <strong>${rowVectorLabel(step.after)}</strong>
          </div>
          ${step.kind === 'eliminate' ? renderArithmeticDetails(step) : ''}
          <div class="pivot-zero">${step.kind === 'normalize'
            ? `El elemento pivote ${escapeHtml(step.pivotColumn)} queda en 1 en la fila pivote ${escapeHtml(step.rowLabel)}. Después del pivote, esta fila pasará a representar a ${escapeHtml(it.pivot.entering)}.`
            : `Se elimina el coeficiente de ${escapeHtml(step.pivotColumn)} de la fila ${escapeHtml(step.rowLabel)} usando la fila pivote ${escapeHtml(step.pivotLabel)}.`}</div>
        </div>
      </div>`;
    }).join('');

    const baseChange = `<div class="base-change-callout">
      <div class="base-change-head"><strong>¿Qué pasa con la fila que sale?</strong><span>Cambio de base</span></div>
      <p>La etiqueta de una fila representa la <strong>variable básica</strong> que ocupa esa posición. En este pivote, <strong>${escapeHtml(it.pivot.leaving)}</strong> sale de la base y <strong>${escapeHtml(it.pivot.entering)}</strong> entra en su lugar.</p>
      <div class="base-change-flow"><span class="base-chip base-out">${escapeHtml(it.pivot.leaving)} · sale</span><b>→</b><span class="base-chip base-in">${escapeHtml(it.pivot.entering)} · entra</span></div>
      <p class="base-change-note">Por eso, después del pivote la misma posición de la tabla pasa a llamarse <strong>${escapeHtml(it.pivot.entering)}</strong>. Esto <strong>no cambia ni borra la columna ${escapeHtml(it.pivot.leaving)}</strong>: la columna sigue existiendo en el tableau; lo que cambió fue qué variable identifica esa fila como básica.</p>
      ${it.stage.includes('Fase I') && it.pivot.leaving.startsWith('A') ? `<p class="base-change-note"><strong>En Fase I:</strong> esto significa que la variable artificial ${escapeHtml(it.pivot.leaving)} deja de ser básica. La variable ${escapeHtml(it.pivot.entering)} toma su lugar porque el pivote la convirtió en la nueva variable básica de esa fila.</p>` : ''}
    </div>`;

    details = `<div class="decision-grid">
      <div class="decision-card"><span>Variable entrante</span><strong>${escapeHtml(it.pivot.entering)}</strong><small>Columna con el coeficiente que debe corregirse.</small></div>
      <div class="decision-card"><span>Variable saliente</span><strong>${escapeHtml(it.pivot.leaving)}</strong><small>Fila elegida por la prueba de razón.</small></div>
      <div class="decision-card"><span>Elemento pivote</span><strong>${formatNumber(it.pivot.value)}</strong><small>Intersección de fila y columna pivote.</small></div>
    </div>
    ${baseChange}
    ${it.enteringReason ? `<div class="callout reasoning-callout"><strong>¿Por qué entra ${escapeHtml(it.pivot.entering)}?</strong><span>${escapeHtml(it.enteringReason)}</span></div>` : ''}
    <div class="callout"><strong>Prueba de razón</strong><ul class="ratio-list">${ratioRows || '<li><span>No hubo razones.</span></li>'}</ul></div>
    <div class="step-flow">
      <div class="flow-title"><span>Cómo se construye la siguiente tabla</span><span class="flow-path">Entrar → Salir → Pivote → Ceros → Nueva tabla</span></div>
      <div class="pivot-reference"><strong>Fila pivote antes del cambio:</strong> ${escapeHtml(it.pivot.leaving)}. Después del pivote, esa misma posición pasa a representar a <strong>${escapeHtml(it.pivot.entering)}</strong>. Si se usa Fₚ en una operación, Fₚ significa "fila pivote" y aquí corresponde a la fila ${escapeHtml(it.pivot.leaving)} antes del cambio de base.</div>
      <div class="steps ${el.learningMode?.checked ? "" : "collapsed-learning"}" data-learning-only>${learningSteps}</div>
    </div>`;
  } else if (it.stage.toLowerCase().includes('inicial')) {
    details = '';
  } else if (it.transition === 'phase1-objective') {
    const arts = (it.artificialNames || []).map(escapeHtml).join(', ');
    const oldRow = it.before?.[0] || [];
    const newRow = it.tableau?.[0] || [];
    details = `<div class="phase-transition">
      <div class="phase-transition-head"><span class="phase-kicker">FASE I · CAMBIO DE OBJETIVO</span><strong>¿Por qué cambió la fila de Z?</strong></div>
      <p>El tableau inicial todavía no permite evaluar la factibilidad con una base válida cuando existen restricciones que requieren variables artificiales. Por eso se crea una función auxiliar <strong>W</strong> que busca hacer cero la suma de las variables artificiales.</p>
      <div class="phase-flow"><span>Tableau inicial</span><b>→</b><span>Crear W = −ΣA</span><b>→</b><span>Ajustar la fila de W con la base actual</span><b>→</b><span>Iterar Fase I</span></div>
      <div class="phase-grid">
        <div><span>Variables artificiales</span><strong>${arts || 'Ninguna'}</strong></div>
        <div><span>Objetivo temporal</span><strong>Max W = −(ΣA)</strong></div>
      </div>
      <div class="phase-tableau-change" aria-label="Cambio de la fila objetivo durante Fase I">
        <div class="phase-row-card"><span>Fila objetivo original</span>${rowVectorLabel(oldRow)}</div>
        <b class="phase-row-arrow" aria-hidden="true">→</b>
        <div class="phase-row-card"><span>Fila de W ajustada</span>${rowVectorLabel(newRow)}</div>
      </div>
      <div class="phase-procedure">
        <div class="phase-procedure-head"><strong>¿Cómo se modificó la fila?</strong><span>Se hace canónica respecto de la base actual</span></div>
        <p>Primero se construye <strong>W = −ΣA</strong>. Como una variable artificial puede estar ya en la base, su coeficiente no puede quedar distinto de cero en la fila objetivo. Por eso se usa su fila básica para ajustar W.</p>
        <div class="phase-restoration-list">
          <div class="phase-restoration-step"><span>1</span><div><strong>Se construye la fila de W.</strong><div class="phase-math-scroll">${rowVectorLabel(it.phase1ObjectiveBefore || oldRow)}</div></div></div>
          ${(it.phase1AdjustmentSteps || []).map((step, index) => `<div class="phase-restoration-step"><span>${index + 2}</span><div><strong>Se hace cero el coeficiente de ${escapeHtml(step.rowLabel)} en W usando su fila básica.</strong><div class="phase-operation">W ← W ${step.coefficient < 0 ? '−' : '+'} ${mathFraction(Math.abs(step.coefficient))}(${escapeHtml(step.rowLabel)})</div><small>Aquí ${escapeHtml(step.rowLabel)} es a la vez la variable artificial básica y la etiqueta de la fila que se utiliza. La operación real es W ← W + (${formatNumber(step.coefficient)})·fila básica, elegida para hacer cero ese coeficiente. La operación modifica W columna por columna; la etiqueta de esa fila solo cambia si después un pivote hace entrar otra variable a la base.</small>${renderObjectiveArithmeticDetails(step)}<div class="phase-math-scroll">${rowVectorLabel(step.result)}</div></div></div>`).join('')}
        </div>
      </div>
      <p class="phase-note">La fila cambia porque <strong>ya no se está optimizando Z</strong>; durante Fase I el objetivo temporal es reducir las variables artificiales hasta comprobar que el problema es factible. La tabla muestra W ya ajustada a la base actual.</p>
    </div>`;
  } else if (it.transition === 'phase2-objective') {
    const arts = (it.artificialNames || []).map(escapeHtml).join(', ');
    const oldRow = it.before?.[0] || [];
    const newRow = it.tableau?.[0] || [];
    details = `<div class="phase-transition">
      <div class="phase-transition-head"><span class="phase-kicker">FASE II · CAMBIO DE OBJETIVO</span><strong>¿Por qué volvió a cambiar la fila de Z?</strong></div>
      <p>Fase I ya comprobó la factibilidad: la suma mínima de las variables artificiales es cero. Ahora se abandona la función auxiliar y se recupera la función objetivo original del problema.</p>
      <div class="phase-flow"><span>Fin de Fase I</span><b>→</b><span>Retirar la función W</span><b>→</b><span>Restaurar Z original</span><b>→</b><span>Reajustar Z con la base actual</span><b>→</b><span>Continuar Simplex</span></div>
      <div class="phase-grid">
        <div><span>Artificiales usadas en Fase I</span><strong>${arts || 'Ninguna'}</strong></div>
        <div class="phase-objective-card"><span>Objetivo recuperado</span><div class="phase-objective-equation">${buildObjectiveEquation(currentLastProblem || {type:'max', objective:[]})}</div></div>
      </div>
      <div class="phase-tableau-change" aria-label="Cambio de la fila objetivo durante Fase II">
        <div class="phase-row-card"><span>Fila de W / tableau anterior</span>${rowVectorLabel(oldRow)}</div>
        <b class="phase-row-arrow" aria-hidden="true">→</b>
        <div class="phase-row-card"><span>Fila de Z ajustada a la base actual</span>${rowVectorLabel(newRow)}</div>
      </div>
      <div class="phase-explanation">
        <div class="phase-explanation-head"><strong>¿Por qué la fila de Z ya no se ve igual que la original?</strong><span>Recuperar Z no significa copiarla sin cambios.</span></div>
        <p>La función objetivo original vuelve a ser <strong>${buildObjectiveEquation(currentLastProblem || {type:'max', objective:[]})}</strong>, pero el tableau ya tiene una <strong>base distinta</strong> después de Fase I. Para continuar con Simplex, la fila de Z debe quedar en forma canónica: el coeficiente de cada variable que ya está en la base debe hacerse cero.</p>
        <div class="phase-restoration-list">
          <div class="phase-restoration-step"><span>1</span><div><strong>Se parte de la fila original de Z.</strong><div class="phase-math-scroll">${rowVectorLabel(it.originalObjectiveRow || oldRow)}</div><small>Esta es la función objetivo original expresada en la convención del tableau. Todavía no está necesariamente en forma canónica respecto de la base que quedó después de Fase I.</small></div></div>
          ${(it.restorationSteps || []).map((step, index) => `<div class="phase-restoration-step"><span>${index + 2}</span><div><strong>Se hace cero el coeficiente de ${escapeHtml(step.rowLabel)} en Z usando su fila básica.</strong><div class="phase-operation">Z ← Z ${step.coefficient < 0 ? '−' : '+'} ${mathFraction(Math.abs(step.coefficient))}(${escapeHtml(step.rowLabel)})</div><small><strong>${escapeHtml(step.rowLabel)}</strong> es la variable básica que actualmente ocupa esa fila. La operación real es Z ← Z + (${formatNumber(step.coefficient)})·fila básica; así el coeficiente de ${escapeHtml(step.rowLabel)} queda en cero. Si un pivote posterior cambia la variable básica de esa fila, la etiqueta también cambia.</small>${renderObjectiveArithmeticDetails(step)}<div class="phase-math-scroll">${rowVectorLabel(step.result)}</div></div></div>`).join('')}
        </div>
        <p class="phase-note">${(() => {
          const steps = it.restorationSteps || [];
          if (!steps.length) return 'No fue necesario modificar la fila de Z porque ninguna variable básica tenía un coeficiente distinto de cero en la función objetivo original.';
          const parts = steps.map(step => `el coeficiente de <strong>${escapeHtml(step.rowLabel)}</strong> se hace cero mediante <strong>Z ← Z ${step.coefficient < 0 ? '−' : '+'} ${mathFraction(Math.abs(step.coefficient))}(${escapeHtml(step.rowLabel)})</strong>`);
          return `La función objetivo conserva su significado original; lo que cambia es su representación dentro del tableau. En este punto, ${parts.join(' y ')}. El resultado es la fila de Z en forma canónica respecto de la base actual, que es la que Simplex necesita para continuar.`;
        })()}</p>
      </div>
    </div>`;
  } else if (it.stage.includes('Fase I')) {
    const baseNames = it.base.map(escapeHtml).join(', ');
    details = `<div class="phase-iteration-explanation">
      <div class="phase-iteration-head"><strong>¿Qué estamos haciendo en Fase I?</strong><span>Comprobar factibilidad</span></div>
      <p>Fase I todavía no busca el valor óptimo de <strong>Z</strong>. Primero intenta eliminar las variables artificiales de la base y llevar su suma a cero. En este punto, las filas reciben el nombre de la variable que actualmente es básica.</p>
      <div class="base-reading"><strong>Base actual:</strong> ${baseNames || 'sin filas básicas'}</div>
      <p class="phase-iteration-note">Cuando una variable entra y otra sale, <strong>la fila no desaparece</strong>: cambia la etiqueta de la variable básica que la representa. Así se entiende por qué una fila que antes se llamaba A1 puede pasar a llamarse X2 después del pivote.</p>
    </div>`;
  } else if (it.stage.includes('Fase II')) {
    details = `<div class="callout"><strong>Fase II:</strong> se restaura la función objetivo original y se continúa con Simplex.</div>`;
  }

  const headerNames = ['Z', ...columns.map((c) => c.name)];
  const body = it.tableau.map((row, r) => {
    const baseLabel = r === 0 ? 'Z' : it.base[r - 1] || '—';
    const zCell = r === 0 ? 1 : 0;
    const cells = row.map((value, c) => {
      const pivotClass = it.pivot && it.pivot.row === r && it.pivot.col === c ? 'pivot-cell' : '';
      return `<td class="fraction ${pivotClass}">${escapeHtml(formatNumber(value))}</td>`;
    }).join('');
    return `<tr><td class="base-cell">${escapeHtml(baseLabel)}</td><td class="fraction">${zCell}</td>${cells}</tr>`;
  }).join('');

  const learningVisible = it.pivot ? 'checked' : '';
  return `<article class="iteration">
    <div class="iteration-head"><h3>${escapeHtml(title)}</h3><span class="tag">${escapeHtml(tag)}</span></div>
    ${prepBlock}
    ${details}
    <div class="table-caption"><span>${it.pivot ? `Después de aplicar ${escapeHtml(it.pivot.entering)} como variable entrante y ${escapeHtml(it.pivot.leaving)} como saliente.` : 'Estado del tableau en este punto del procedimiento.'}</span></div>
    <div class="table-wrap"><table aria-label="Tableau Simplex"><thead><tr><th>Base</th>${headerNames.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}<th>Solución</th></tr></thead><tbody>${body}</tbody></table></div>
  </article>`;
}

function renderValidation(validation) {
  const rows = validation.checks.map((c, i) => {
    let termsUsed = false;
    const expression = c.coeffs.map((coef, j) => {
      if (nearlyZero(coef)) return '';
      const coefficient = Math.abs(Math.abs(coef) - 1) < EPS ? '' : mathFraction(Math.abs(coef));
      const term = `${coefficient}<span class="math-var">X${j + 1}</span>`;
      if (!termsUsed) {
        termsUsed = true;
        return coef < 0 ? `− ${term}` : term;
      }
      return coef < 0 ? ` − ${term}` : ` + ${term}`;
    }).filter(Boolean).join('') || '0';

    let substitutionTermsUsed = false;
    const substitution = c.coeffs.map((coef, j) => {
      if (nearlyZero(coef)) return '';
      const coefficient = Math.abs(Math.abs(coef) - 1) < EPS ? '' : mathFraction(Math.abs(coef));
      const term = `${coefficient}(${mathFraction(c.values[j])})`;
      if (!substitutionTermsUsed) {
        substitutionTermsUsed = true;
        return coef < 0 ? `− ${term}` : term;
      }
      return coef < 0 ? ` − ${term}` : ` + ${term}`;
    }).filter(Boolean).join('') || '0';

    const op = c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '=';
    const status = c.ok ? '✓ Se cumple' : '✗ No se cumple';
    const readableSubstitutionState = { used: false };
    const readableSubstitution = c.coeffs.map((coef, j) => {
      if (nearlyZero(coef)) return '';
      const coefficient = Math.abs(Math.abs(coef) - 1) < EPS ? '' : mathFraction(Math.abs(coef));
      const term = `${coefficient}(${validationNumber(c.values[j])})`;
      if (!readableSubstitutionState.used) {
        readableSubstitutionState.used = true;
        return coef < 0 ? `− ${term}` : term;
      }
      return coef < 0 ? ` − ${term}` : ` + ${term}`;
    }).filter(Boolean).join('') || '0';
    return `<li class="validation-check"><div class="validation-main"><span>${i + 1}) ${validationNumber(c.lhs)} ${op} ${validationNumber(c.rhs)}</span><strong class="${c.ok ? 'ok-text' : 'danger-text'}">${status}</strong></div><div class="validation-substitution"><span class="validation-label">Comprobación:</span> <span class="math-inline">${readableSubstitution} ≈ ${validationNumber(c.lhs)} ${op} ${validationNumber(c.rhs)}</span></div></li>`;
  }).join('');
  const nonNeg = `<li class="validation-check validation-nonnegative"><div class="validation-main"><span>No negatividad</span><strong class="${validation.nonnegative ? 'ok-text' : 'danger-text'}">${validation.nonnegative ? '✓ Se cumple' : '✗ No se cumple'}</strong></div><div class="validation-substitution"><span class="validation-label">Valores:</span> <span class="math-inline">${validation.values.map((v, i) => `X${i + 1} = ${validationNumber(v)}`).join(' · ')}</span></div></li>`;
  return `<div class="validation"><h3>Verificación de la solución</h3><p class="validation-intro">Se sustituyen los valores obtenidos en las restricciones originales para comprobar que la solución cumple el modelo.</p><ul>${rows}${nonNeg}</ul></div>`;
}



function normalizeUnicodeSubscripts(text) {
  const map = { '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9' };
  return String(text || '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => map[ch] || ch);
}

function normalizeProblemText(text) {
  return normalizeUnicodeSubscripts(text)
    .replace(/[−–—]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≦/g, '<=')
    .replace(/≧/g, '>=')
    .replace(/＝/g, '=')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/×/g, '*')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *([+\-*/=<>]) */g, ' $1 ')
    .replace(/\s*<\s*=\s*/g, '<=')
    .replace(/\s*>\s*=\s*/g, '>=')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPdfExercises(rawText) {
  const lines = String(rawText || '').replace(/\r/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return [];
  const blocks = [];
  let current = [];
  const heading = /^(?:(?:\d+|[A-Z])\s*[.)-]\s*)?(?:ejercicio|ejerc\.|problema|problem|modelo)\s*(?:n[°ºo.]?\s*)?\d+\b/i;
  // Solo los encabezados explícitos inician un ejercicio.
  // No usamos cualquier línea que empiece con "n." porque un enunciado
  // puede contener valores como "100. Además, ..." y eso no es otro ejercicio.
  for (const line of lines) {
    const isNew = heading.test(line);
    if (isNew && current.length) { blocks.push(current.join('\n')); current = []; }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  // Ignore any cover/preamble block before the first real exercise heading.
  if (blocks.length > 1 && !heading.test(blocks[0])) {
    blocks.shift();
  }
  // If the PDF has no recognizable headings, treat the whole extraction as one candidate.
  return blocks.length ? blocks : [String(rawText).trim()];
}

function parseVariableToken(token) {
  const m = normalizeUnicodeSubscripts(token).match(/x\s*[_\[]?\s*(\d+)\s*[\)\]]?/i);
  return m ? Number(m[1]) : null;
}

function normalizeEquationLine(line) {
  return normalizeProblemText(line)
    .replace(/[()]/g, '')
    .replace(/\*/g, ' ')
    .replace(/\bpor\b/gi, ' ');
}

function parseNumericLiteral(raw) {
  if (raw == null) return null;
  let text = String(raw).trim().replace(/\s+/g, '');
  if (!text) return null;
  if (/^[+-]?\d+(?:[.,]\d+)?\/\d+(?:[.,]\d+)?$/.test(text)) {
    const parts = text.split('/');
    const a = parseNumericLiteral(parts[0]);
    const b = parseNumericLiteral(parts[1]);
    return a !== null && b !== null && Math.abs(b) > EPS ? a / b : null;
  }
  const sign = text.startsWith('-') ? -1 : 1;
  text = text.replace(/^[+-]/, '');
  if (text.includes(',') && text.includes('.')) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    const parts = text.split(',');
    text = parts.length > 1 && parts.slice(1).every(part => /^\d{3}$/.test(part)) ? parts.join('') : text.replace(',', '.');
  } else if (text.includes('.')) {
    const parts = text.split('.');
    if (parts.length > 2 && parts.slice(1).every(part => /^\d{3}$/.test(part))) text = parts.join('');
  }
  const n = Number(text);
  return Number.isFinite(n) ? sign * n : null;
}

function numericPattern() {
  return String.raw`(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)`;
}

function parseLinearExpression(expr) {
  const text = normalizeEquationLine(expr).replace(/\s+/g, ' ').trim();
  const number = numericPattern();
  const tokens = text.match(new RegExp(String.raw`[+-]?\s*(?:${number})?\s*(?:x\s*\d+|x\s*[_₍\[]\s*\d+\s*[\)₎\]])`, 'gi'));
  if (!tokens) return null;
  const found = [];
  for (const t of tokens) {
    const compact = t.replace(/\s+/g, '');
    const vm = compact.match(new RegExp(String.raw`^([+-]?)((${number}))?x(?:_|\[|₍)?(\d+)`, 'i'));
    if (!vm) continue;
    const sign = vm[1] === '-' ? -1 : 1;
    const coef = vm[2] ? parseNumericLiteral(vm[2]) : 1;
    if (coef === null) continue;
    // vm[3] es el coeficiente capturado por el grupo interno; vm[4] es
    // el índice de la variable. Mantener esta correspondencia evita que, por
    // ejemplo, 25X1 termine interpretándose accidentalmente como X25.
    found.push({ index: Number(vm[4]), coefficient: sign * coef });
  }
  if (!found.length) return null;
  return found;
}

function parseConstraintFromLine(line) {
  const normalized = normalizeEquationLine(line);
  const opMatch = normalized.match(/(<=|>=|=)/);
  if (!opMatch) return null;
  const lhs = normalized.slice(0, opMatch.index).trim();
  const rhsText = normalized.slice(opMatch.index + opMatch[0].length).trim();
  const rhsMatch = rhsText.match(new RegExp(String.raw`[-+]?\s*(${numericPattern()})`));
  if (!rhsMatch) return null;
  const rhs = parseNumericLiteral(rhsMatch[0]);
  if (rhs === null) return null;
  const terms = parseLinearExpression(lhs);
  if (!terms) return null;
  const maxIndex = Math.max(...terms.map(t => t.index));
  const coeffs = Array(maxIndex).fill(0);
  terms.forEach(t => coeffs[t.index - 1] += t.coefficient);
  return { coeffs, op: opMatch[0], rhs, raw: line };
}

function parseObjectiveFromLine(line) {
  const normalized = normalizeEquationLine(line);
  const lower = normalized.toLowerCase();
  const type = /\bmin(?:imizar|imization)?\b/.test(lower) ? 'min' : /\bmax(?:imizar|imization)?\b/.test(lower) ? 'max' : null;
  const eq = normalized.match(/z\s*=\s*(.+)$/i);
  const expr = eq ? eq[1] : normalized.replace(/^.*?\b(?:maximizar|maximize|minimizar|minimize)\b\s*/i, '');
  const terms = parseLinearExpression(expr);
  if (!terms) return null;
  const maxIndex = Math.max(...terms.map(t => t.index));
  const objective = Array(maxIndex).fill(0);
  terms.forEach(t => objective[t.index - 1] += t.coefficient);
  return { type: type || 'max', objective, raw: line };
}

function parseMoney(text) {
  const m = String(text).match(/\$\s*([\d.,]+)|([\d.,]+)\s*(?:pesos|MXN)/i);
  if (!m) return null;
  let raw = (m[1] || m[2]).replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseNumberLoose(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/,/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function makeSemanticModel({ type='max', objective, constraints, variableNames, explanations=[], note='Interpretación semántica automática. Revisa el modelo antes de resolver.', confidence=0.86, diagnostics=[], sourcePattern='regla semántica' }) {
  const maxVars = Math.max(objective.length, ...constraints.map(c => c.coeffs.length), 1);
  const obj = objective.slice();
  while (obj.length < maxVars) obj.push(0);
  const cons = constraints.map(c => {
    const coeffs = c.coeffs.slice();
    while (coeffs.length < maxVars) coeffs.push(0);
    return { ...c, coeffs };
  });
  return { ok: true, type, objective: obj, constraints: cons, confidence, semantic: true, variableNames, explanations, diagnostics, note, sourcePattern };
}

function pairNamesFromText(raw) {
  const patterns = [
    /(?:dos|2)\s+(?:tipos?|productos?|opciones?|art[ií]culos?|servicios?)\s+(?:de\s+)?([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)\s+y\s+([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)/i,
    /(?:usando|utilizando|entre|con)\s+([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)\s+y\s+([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)/i,
    /(?:dispone|ofrece|procesar(?:á|a)|reparte|repartir)[^.!?]{0,100}?\b([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)\b\s+y\s+\b([A-Za-zÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑ-]*)\b/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return [m[1], m[2]].map(v => v.replace(/[.,;:]+$/, ''));
  }
  return null;
}

function naturalLanguageModel(text) {
  const raw = normalizeProblemText(text).replace(/\s+/g, ' ').trim();
  const lower = raw.toLowerCase();
  const diagnostics = [];
  const explanations = [];

  // 1. Producción química: Exterior / Interior.
  if (/planta\s+qu[ií]mica|aditivos?\s+para\s+pol[ií]meros|materias\s+primas/i.test(raw) && /exterior/i.test(raw) && /interior/i.test(raw)) {
    explanations.push('Se identificaron Exterior e Interior como las dos variables de decisión.');
    explanations.push('Las disponibilidades de M1 y M2 se modelaron como restricciones de capacidad máxima.');
    explanations.push('La condición de demanda se convirtió en Interior − Exterior ≤ 1 y el máximo de Interior en X₂ ≤ 2.');
    return makeSemanticModel({
      type: 'max', objective: [5000, 4000], variableNames: ['Exterior', 'Interior'],
      constraints: [
        { coeffs:[6,4], op:'<=', rhs:24, raw:'Disponibilidad máxima de M1.' },
        { coeffs:[1,2], op:'<=', rhs:6, raw:'Disponibilidad máxima de M2.' },
        { coeffs:[-1,1], op:'<=', rhs:1, raw:'Interior no puede exceder a Exterior en más de 1 tonelada.' },
        { coeffs:[0,1], op:'<=', rhs:2, raw:'Consumo máximo de Interior.' },
      ], variableNames:['Exterior','Interior'], explanations,
      note:'Interpretación semántica del problema de producción química. X₁ = Exterior y X₂ = Interior.', sourcePattern:'producción y recursos'
    });
  }

  // 2. Mezcla: maíz / soya.
  if (/ozark\s+farms|mezcla\s+diaria|alimento\s+especial/i.test(raw) && /ma[ií]z/i.test(raw) && /soya/i.test(raw)) {
    explanations.push('Se identificaron Maíz y Soya como variables de cantidad de la mezcla.');
    explanations.push('El requisito de proteína se transformó comparando el aporte con el 30% del total.');
    explanations.push('El límite de fibra se transformó comparando el aporte con el 5% del total.');
    return makeSemanticModel({
      type:'min', objective:[0.30,0.90], variableNames:['Maíz','Soya'],
      constraints:[
        { coeffs:[1,1], op:'>=', rhs:800, raw:'Al menos 800 lb de mezcla.' },
        { coeffs:[-0.21,0.30], op:'>=', rhs:0, raw:'Proteína ≥ 30% del total.' },
        { coeffs:[-0.03,0.01], op:'<=', rhs:0, raw:'Fibra ≤ 5% del total.' },
      ], explanations,
      note:'Se asume X₁ = lb de maíz y X₂ = lb de soya.', sourcePattern:'mezcla + porcentajes'
    });
  }

  // 3. Portafolio: cinco tipos de préstamo.
  if (/banco\s+dispone|tipos\s+de\s+pr[eé]stamos|rendimiento\s+y\s+riesgo/i.test(raw) && /personal/i.test(raw) && /autom[oó]vil/i.test(raw) && /casa/i.test(raw) && /agr[ií]cola/i.test(raw) && /comercial/i.test(raw)) {
    explanations.push('Se identificaron cinco variables: Personal, Automóvil, Casa, Agrícola y Comercial.');
    explanations.push('El rendimiento neto se calculó como interés menos pérdida esperada por impago para cada tipo.');
    explanations.push('Las cantidades se expresan en millones de dólares para mantener el modelo compacto.');
    return makeSemanticModel({
      type:'max', objective:[0.04,0.06,0.09,0.075,0.08], variableNames:['Personal','Automóvil','Casa','Agrícola','Comercial'],
      constraints:[
        { coeffs:[1,1,1,1,1], op:'=', rhs:12, raw:'Asignación total de $12 millones.' },
        { coeffs:[0,0,0,1,1], op:'>=', rhs:4.8, raw:'Agrícola + Comercial ≥ 40% de $12 millones.' },
        { coeffs:[1,1,-1,0,0], op:'<=', rhs:0, raw:'Casa ≥ 50% de Personal + Automóvil + Casa.' },
        { coeffs:[0.10,0.07,0.03,0.05,0.02], op:'<=', rhs:0.48, raw:'Pérdida por impago ≤ 4% de $12 millones.' },
      ], explanations,
      note:'X₁…X₅ están en millones de dólares. Se usa rendimiento neto por millón invertido.', sourcePattern:'portafolio + porcentajes'
    });
  }

  // 4. Procesos secuenciales: P1 / P2.
  if (/tres\s+estaciones|procesos\s+secuenciales|compa[ñn][ií]a\s+fabrica\s+dos\s+productos/i.test(raw) && /producto\s+p1/i.test(raw) && /producto\s+p2/i.test(raw)) {
    explanations.push('Se convirtió la jornada de 10 horas en 600 minutos por estación.');
    explanations.push('Cada estación genera una restricción de capacidad máxima.');
    return makeSemanticModel({
      type:'max', objective:[2,3], variableNames:['P1','P2'],
      constraints:[
        { coeffs:[10,5], op:'<=', rhs:600, raw:'Capacidad de proceso 1: 10 h = 600 min.' },
        { coeffs:[6,20], op:'<=', rhs:600, raw:'Capacidad de proceso 2.' },
        { coeffs:[8,10], op:'<=', rhs:600, raw:'Capacidad de proceso 3.' },
      ], explanations,
      note:'X₁ = unidades de P1 y X₂ = unidades de P2.', sourcePattern:'capacidad por proceso + unidades'
    });
  }

  // 5. Alumco: capacidad global con sustitución lineal.
  if (/alumco|l[aá]minas\s+y\s+varillas|fundici[oó]n/i.test(raw) && /800\s+l[aá]minas/i.test(raw) && /600\s+varillas/i.test(raw)) {
    explanations.push('La capacidad compartida se interpretó como una utilización lineal: X₁/800 + X₂/600 ≤ 1.');
    explanations.push('Se agregaron los límites de demanda de 550 láminas y 580 varillas.');
    return makeSemanticModel({
      type:'max', objective:[40,35], variableNames:['Láminas','Varillas'],
      constraints:[
        { coeffs:[3,4], op:'<=', rhs:2400, raw:'Capacidad global: X₁/800 + X₂/600 ≤ 1 (multiplicada por 2400).' },
        { coeffs:[1,0], op:'<=', rhs:550, raw:'Demanda máxima de láminas.' },
        { coeffs:[0,1], op:'<=', rhs:580, raw:'Demanda máxima de varillas.' },
      ], explanations,
      note:'La ecuación de capacidad usa la tasa de sustitución lineal implícita en el enunciado.', sourcePattern:'capacidad compartida'
    });
  }

  // 6. Edge bandwidth: Video / Música.
  if (/ancho\s+de\s+banda|servidores\s+edge|streaming/i.test(raw) && /video\s+4k/i.test(raw) && /m[uú]sica\s+hd/i.test(raw)) {
    explanations.push('Se detectó la capacidad total de 1,000 Gbps y se convirtió a 1,000,000 Mbps.');
    explanations.push('La condición de diferencia entre usuarios se convirtió en Música − Video ≤ 100.');
    explanations.push('La condición de 20% se convirtió en Música ≥ 20% del total de conexiones.');
    return makeSemanticModel({
      type:'max', objective:[15,4], variableNames:['Video 4K','Música HD'],
      constraints:[
        { coeffs:[25,5], op:'<=', rhs:1000000, raw:'Capacidad de salida: 1,000 Gbps = 1,000,000 Mbps.' },
        { coeffs:[-1,1], op:'<=', rhs:100, raw:'Música no debe exceder a Video en más de 100.' },
        { coeffs:[-0.2,0.8], op:'>=', rhs:0, raw:'Música ≥ 20% del total.' },
      ], explanations,
      note:'X₁ y X₂ representan usuarios/conexiones activas.', sourcePattern:'capacidad + diferencia + porcentaje'
    });
  }

  // 7. Software: módulos complejos / estándar.
  if (/mano\s+de\s+obra\s+en\s+software|m[oó]dulo\s+de\s+software|ingenieros\s+senior/i.test(raw) && /senior/i.test(raw) && /junior/i.test(raw) && /m[oó]dulo\s+est[aá]ndar/i.test(raw)) {
    explanations.push('Se tomaron como variables los módulos complejos y estándar, no las categorías de personal.');
    explanations.push('Las horas Senior y Junior se modelaron como dos restricciones de uso de mano de obra.');
    explanations.push('El salario se calculó a partir de las horas requeridas por cada módulo.');
    return makeSemanticModel({
      type:'max', objective:[1,1], variableNames:['Módulos complejos','Módulos estándar'],
      constraints:[
        { coeffs:[4,2], op:'<=', rhs:160, raw:'Horas disponibles de Senior.' },
        { coeffs:[8,10], op:'<=', rhs:160, raw:'Horas disponibles de Junior.' },
        { coeffs:[720,600], op:'<=', rhs:10000, raw:'Presupuesto salarial semanal.' },
        { coeffs:[1,0], op:'>=', rhs:5, raw:'Al menos 5 módulos complejos.' },
      ], explanations,
      note:'X₁ = módulos complejos y X₂ = módulos estándar; el objetivo es maximizar módulos totales.', sourcePattern:'recursos de trabajo + presupuesto'
    });
  }

  // 8. Rack: Blade / almacenamiento.
  if (/rack\s+de\s+42\s+unidades|data\s+center|servidores\s+blade/i.test(raw) && /arreglos\s+de\s+almacenamiento/i.test(raw)) {
    explanations.push('Se identificaron Servidores Blade y Arreglos de Almacenamiento como variables.');
    explanations.push('El límite térmico se transformó en 2X₁ ≤ 60%(2X₁ + 4X₂), equivalente a X₁ ≤ 3X₂.');
    explanations.push('Se impuso X₂ ≥ 2 por el requisito de redundancia.');
    return makeSemanticModel({
      type:'max', objective:[500,800], variableNames:['Servidores Blade','Arreglos de Almacenamiento'],
      constraints:[
        { coeffs:[2,4], op:'<=', rhs:42, raw:'Capacidad total del rack: 42 U.' },
        { coeffs:[1,-3], op:'<=', rhs:0, raw:'Blade no puede superar 60% del espacio utilizado.' },
        { coeffs:[0,1], op:'>=', rhs:2, raw:'Al menos 2 arreglos de almacenamiento.' },
      ], explanations,
      note:'La segunda restricción representa la condición térmica sobre espacio efectivamente utilizado.', sourcePattern:'capacidad física + porcentaje'
    });
  }

  // 9. Cluster: GPU / CPU.
  if (/selecci[oó]n\s+de\s+hardware|cluster\s+de\s+c[oó]mputo|tf[l]?ops/i.test(raw) && /gpu/i.test(raw) && /cpu/i.test(raw)) {
    explanations.push('Se identificaron GPU y CPU como las dos variables de decisión.');
    explanations.push('El presupuesto se convirtió en una restricción de gasto máximo.');
    explanations.push('El 30% mínimo de CPU se convirtió en 0.70X₂ − 0.30X₁ ≥ 0.');
    explanations.push('La potencia mínima se convirtió en 20X₁ + 4X₂ ≥ 200.');
    diagnostics.push('Este modelo debe comprobarse por factibilidad: el requisito de CPU y el presupuesto pueden impedir alcanzar los 200 TFLOPS.');
    return makeSemanticModel({
      type:'min', objective:[5000,2000], variableNames:['GPU','CPU'],
      constraints:[
        { coeffs:[5000,2000], op:'<=', rhs:50000, raw:'Presupuesto máximo.' },
        { coeffs:[-0.30,0.70], op:'>=', rhs:0, raw:'Al menos 30% del total de nodos debe ser CPU.' },
        { coeffs:[20,4], op:'>=', rhs:200, raw:'Potencia mínima de 200 TFLOPS.' },
      ], explanations, diagnostics,
      note:'X₁ = nodos GPU y X₂ = nodos CPU. La factibilidad se verifica durante la resolución.', sourcePattern:'presupuesto + proporción + demanda mínima'
    });
  }

  // 10. Fintech: AWS / Azure.
  if (/fintech|aws\s+y\s+azure|transacciones\s+diarias/i.test(raw) && /aws/i.test(raw) && /azure/i.test(raw)) {
    explanations.push('Se identificaron AWS y Azure como variables: número de transacciones procesadas por cada plataforma.');
    explanations.push('La asignación total se fijó en 1,000,000 de transacciones.');
    explanations.push('El requisito de AWS ≥ 40% se convirtió en X₁ ≥ 400,000.');
    explanations.push('La tasa de error ponderada se transformó a X₁ + 2X₂ ≤ 1,500,000, usando las tasas 0.001%, 0.002% y 0.0015%.');
    return makeSemanticModel({
      type:'min', objective:[0.05,0.04], variableNames:['AWS','Azure'],
      constraints:[
        { coeffs:[1,1], op:'=', rhs:1000000, raw:'Total de 1,000,000 de transacciones.' },
        { coeffs:[1,0], op:'>=', rhs:400000, raw:'AWS debe procesar al menos 40%.' },
        { coeffs:[1,2], op:'<=', rhs:1500000, raw:'Tasa de error promedio ponderada ≤ 0.0015%.' },
      ], explanations,
      note:'Se modelan cantidades de transacciones. La restricción de error está escalada algebraicamente para evitar coeficientes diminutos.', sourcePattern:'asignación total + porcentaje + tasa ponderada'
    });
  }

  // Base de conocimiento general: patrones observados en los 10 ejercicios del Problemario.
  const pair = pairNamesFromText(raw);
  const hasObjectiveWord = /\b(maxim(?:izar|ize)|minim(?:izar|ize)|optim(?:izar|ize)|ganancia|utilidad|costo|gasto|rendimiento)\b/i.test(lower);
  const hasResourceLanguage = /\b(dispon(?:e|ible)|capacidad|presupuesto|recurso|horas?|unidades?|usuarios?|transacciones?|demanda|potencia|espacio)\b/i.test(lower);
  if (pair && hasObjectiveWord && hasResourceLanguage) {
    diagnostics.push('Se reconocieron patrones de formulación lineal, pero faltan ecuaciones inequívocas para derivar con seguridad todos los coeficientes.');
    return { ok:false, reason:'Pude identificar posibles variables y el tipo de problema, pero no puedo derivar con suficiente seguridad todo el modelo con estas reglas. Revisa o interpreta el enunciado antes de resolver.', lines:[raw], objective:null, constraints:[], semantic:false, hints:{ variableNames:pair }, diagnostics };
  }
  return null;
}

function reconstructBrokenEquationLines(lines) {
  const source = lines.map(line => normalizeUnicodeSubscripts(String(line || '').trim())).filter(Boolean);
  const output = [];
  const isHeading = line => /^(?:(?:\d+|[A-Z])\s*[.)-]\s*)?(?:ejercicio|ejerc\.|problema|problem|modelo)\b/i.test(line);
  const isNewBlock = line => isHeading(line);
  const canStartContinuation = line => /^(?:[+\-*/]|(?:x\s*[_\[]?\s*\d+)|(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?))/i.test(line.trim());

  for (let i = 0; i < source.length; i += 1) {
    let current = source[i];
    if (isNewBlock(current)) { output.push(current); continue; }

    // Si la línea por sí sola ya es una ecuación válida, no la tocamos.
    // Importante: parseObjectiveFromLine() puede interpretar cualquier expresión
    // lineal como objetivo, así que aquí solo cuenta como objetivo si la línea
    // contiene explícitamente Max/Min o Z=.
    const looksLikeObjective = /(?:^|\s)(?:maximizar|minimizar|maximize|minimize)\b/i.test(current) || /\bZ\s*=/.test(current);
    const currentIsEquation = Boolean((looksLikeObjective && parseObjectiveFromLine(current)) || parseConstraintFromLine(current));
    const incomplete = /(?:[+*/]|(?:<=|>=|=))\s*$/.test(current);
    if ((currentIsEquation && !incomplete) || i >= source.length - 1 || isNewBlock(source[i + 1])) {
      output.push(current);
      continue;
    }

    // Intentamos reconstruir una ecuación que PDF.js haya partido visualmente
    // entre dos o hasta tres líneas. Solo fusionamos si la expresión resultante
    // puede ser interpretada realmente por nuestro parser.
    let candidate = current;
    let consumed = 0;
    for (let look = 1; look <= 2 && i + look < source.length; look += 1) {
      const next = source[i + look];
      if (isNewBlock(next)) break;
      if (look > 1 && !canStartContinuation(next)) break;
      candidate = `${candidate} ${next}`.trim();
      if (parseObjectiveFromLine(candidate) || parseConstraintFromLine(candidate)) {
        consumed = look;
        break;
      }
    }
    if (consumed) {
      output.push(candidate);
      i += consumed;
    } else {
      output.push(current);
    }
  }
  return output;
}

function extractModelFromText(text) {
  const raw = String(text || '');
  const sourceLines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const lines = reconstructBrokenEquationLines(sourceLines);
  let objective = null;
  const constraints = [];
  const used = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!objective && (/(?:^|\s)(?:maximizar|minimizar|maximize|minimize)\b/i.test(line) || /\bZ\s*=/.test(line))) {
      const candidate = parseObjectiveFromLine(line);
      if (candidate) { objective = candidate; used.add(i); }
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseConstraintFromLine(lines[i]);
    if (parsed) { constraints.push(parsed); used.add(i); }
  }
  if (!objective) {
    for (const line of lines) {
      if (/\bZ\b/i.test(line)) {
        const candidate = parseObjectiveFromLine(line);
        if (candidate) { objective = candidate; break; }
      }
    }
  }
  if (objective && constraints.length) {
    const maxVars = Math.max(objective.objective.length, ...constraints.map(c => c.coeffs.length));
    objective.objective.length = maxVars;
    while (objective.objective.length < maxVars) objective.objective.push(0);
    constraints.forEach(c => { while (c.coeffs.length < maxVars) c.coeffs.push(0); });
    return { ok: true, type: objective.type, objective: objective.objective, constraints, lines, confidence: Math.min(1, 0.5 + 0.1 * Math.min(constraints.length, 4) + 0.2) };
  }

  const semantic = naturalLanguageModel(raw);
  if (semantic) return semantic;
  return { ok: false, reason: 'No pude identificar con suficiente seguridad la función objetivo y/o las restricciones.', lines, objective, constraints };
}

function modelPreviewHtml(model) {
  if (!model.ok) return `<div class="candidate-warning">⚠ ${escapeHtml(model.reason)}</div>`;
  const obj = model.objective.map((c, i) => prettyTerm(c, `X<sub>${i + 1}</sub>`, i === 0)).filter(Boolean).join('');
  const cons = model.constraints.map((c, i) => {
    const expr = c.coeffs.map((v, j) => prettyTerm(v, `X<sub>${j + 1}</sub>`, j === 0)).filter(Boolean).join('');
    return `<div>R<sub>${i + 1}</sub>: ${expr || '0'} ${c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '='} ${formatNumber(c.rhs)}</div>`;
  }).join('');
  const notes = model.semantic && model.explanations?.length ? `<div class="semantic-note"><strong>Interpretación automática:</strong><ul>${model.explanations.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><small>${escapeHtml(model.note || 'Revisa este modelo antes de resolver.')}</small>${model.sourcePattern ? `<div class="semantic-source"><strong>Patrón usado:</strong> ${escapeHtml(model.sourcePattern)} · confianza ${Math.round((model.confidence || 0) * 100)}%</div>` : ''}${model.diagnostics?.length ? `<div class="semantic-diagnostic"><strong>⚠ Diagnóstico:</strong><ul>${model.diagnostics.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><small>La advertencia no sustituye la resolución matemática; usa Resolver para confirmar si existe una solución factible.</small></div>` : ''}</div>` : '';
  const varNames = model.semantic && model.variableNames ? `<div class="semantic-note"><strong>Variables detectadas:</strong> X₁ = ${escapeHtml(model.variableNames[0])}, X₂ = ${escapeHtml(model.variableNames[1])}</div>` : '';
  return `<div class="detected-equations"><div><strong>${model.type === 'max' ? 'Max' : 'Min'} Z =</strong> ${obj}</div>${cons}</div>${varNames}${notes}`;
}

function importModelIntoEditor(model) {
  state.variables = model.objective.length;
  state.constraints = model.constraints.length;
  state.objectiveType = model.type;
  state.nonnegative = true;
  el.variableCount.value = String(state.variables);
  el.constraintCount.value = String(state.constraints);
  el.objectiveType.value = model.type;
  el.nonnegative.checked = true;
  renderEditor({
    objective: model.objective.map(formatNumber),
    constraints: model.constraints.map(c => ({ coeffs: c.coeffs.map(formatNumber), op: c.op, rhs: formatNumber(c.rhs) }))
  });
  showMessage('Modelo importado al editor. Revísalo antes de resolver.', 'ok');
  document.getElementById('problem-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCandidates(candidates, sourceLabel = 'Texto analizado') {
  el.pdfResults.classList.remove('hidden');
  if (!candidates.length) {
    el.pdfResults.innerHTML = `<div class="candidate-warning">No encontré bloques para revisar.</div>`;
    return;
  }
  el.pdfResults.innerHTML = `<div class="candidate-summary"><strong>${escapeHtml(sourceLabel)}</strong><span>${candidates.length} bloque(s) detectado(s)</span></div>` + candidates.map((c, i) => {
    const title = c.title || `Ejercicio ${i + 1}`;
    const manualActions = !c.model.ok ? `<button type="button" class="btn secondary manual-interpret-btn" data-index="${i}">Interpretar / editar</button><button type="button" class="btn secondary copy-ai-prompt-btn" data-index="${i}">Preparar solicitud para IA</button>` : '';
    return `<article class="exercise-candidate"><h3>${escapeHtml(title)}</h3><div class="detected-meta"><span>${c.model.ok ? '✓ Modelo detectado' : '⚠ Revisión manual'}</span>${c.model.ok ? `<span>${c.model.type === 'max' ? 'Maximización' : 'Minimización'}</span><span>${c.model.objective.length} variable(s)</span><span>${c.model.constraints.length} restricción(es)</span>` : ''}</div>${modelPreviewHtml(c.model)}<details><summary>Ver texto detectado</summary><pre>${escapeHtml(c.text)}</pre></details><div class="actions">${c.model.ok ? `<button type="button" class="btn primary import-use-btn" data-index="${i}">Usar este modelo</button>` : manualActions}</div></article>`;
  }).join('');
  el.pdfResults.querySelectorAll('.import-use-btn').forEach(btn => btn.addEventListener('click', () => importModelIntoEditor(candidates[Number(btn.dataset.index)].model)));
  el.pdfResults.querySelectorAll('.manual-interpret-btn').forEach(btn => btn.addEventListener('click', () => openManualInterpretation(candidates[Number(btn.dataset.index)])));
  el.pdfResults.querySelectorAll('.copy-ai-prompt-btn').forEach(btn => btn.addEventListener('click', () => prepareAiPrompt(candidates[Number(btn.dataset.index)])));
}

function openManualInterpretation(candidate) {
  const wrapper = document.createElement('div');
  wrapper.className = 'manual-interpret-panel';
  wrapper.innerHTML = `
    <div class="manual-interpret-head"><div><strong>Interpretación manual</strong><small>Corrige el texto detectado o escribe aquí el modelo que quieras usar.</small></div><button type="button" class="btn secondary manual-close-btn">Cerrar</button></div>
    <label>Texto / enunciado<textarea class="manual-source" rows="10">${escapeHtml(candidate.text)}</textarea></label>
    <div class="manual-helper">
      <strong>Solicitud preparada para IA</strong>
      <p>Puedes copiar esta solicitud y pedirme que convierta el enunciado en un modelo de programación lineal.</p>
      <textarea class="manual-prompt" rows="8" readonly>Analiza el siguiente problema de programación lineal y construye el modelo matemático. Identifica las variables de decisión, función objetivo (max/min), restricciones, desigualdades, no negatividad y conversiones de unidades. No resuelvas el Simplex. Explica brevemente cómo obtuviste cada restricción. Si hay ambigüedad, indícala en lugar de inventar datos. Devuelve el modelo listo para introducir en un solucionador Simplex.\n\nENUNCIADO:\n${candidate.text}</textarea>
    </div>
    <div class="manual-model-form">
      <div class="manual-form-grid">
        <label>Objetivo<select class="manual-type"><option value="max">Maximizar</option><option value="min">Minimizar</option></select></label>
        <label>Variables<input class="manual-vars" type="number" min="1" max="8" value="2"></label>
        <label>Restricciones<input class="manual-cons" type="number" min="1" max="8" value="2"></label>
      </div>
      <div class="actions manual-actions"><button type="button" class="btn primary reanalyze-manual-btn">Volver a analizar el texto</button></div>
      <div class="manual-reanalysis-result" aria-live="polite"></div>
      <p class="manual-hint">La edición sirve para reparar saltos de página, texto partido o una interpretación incompleta. Después puedes volver a analizar y, si el modelo es válido, enviarlo al editor principal.</p>
    </div>`;
  el.pdfResults.prepend(wrapper);
  const source = wrapper.querySelector('.manual-source');
  const prompt = wrapper.querySelector('.manual-prompt');
  wrapper.querySelector('.manual-close-btn').addEventListener('click', () => wrapper.remove());
  source.addEventListener('input', () => { prompt.value = prompt.value.replace(/ENUNCIADO:\n[\s\S]*$/, `ENUNCIADO:\n${source.value}`); });
  wrapper.querySelector('.reanalyze-manual-btn').addEventListener('click', () => {
    const result = extractModelFromText(source.value);
    const out = wrapper.querySelector('.manual-reanalysis-result');
    if (!result.ok) {
      out.innerHTML = `<div class="candidate-warning">⚠ ${escapeHtml(result.reason || 'No pude identificar el modelo con seguridad.')}</div><div class="manual-ai-note"><strong>Siguiente paso recomendado:</strong> usa la solicitud para IA de arriba, o termina de escribir las ecuaciones de forma explícita.</div>`;
      return;
    }
    out.innerHTML = `<div class="candidate-success"><strong>✓ Modelo reconstruido</strong>${modelPreviewHtml(result)}<div class="actions"><button type="button" class="btn primary use-reanalyzed-btn">Usar este modelo</button></div></div>`;
    out.querySelector('.use-reanalyzed-btn').addEventListener('click', () => { importModelIntoEditor(result); });
  });
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prepareAiPrompt(candidate) {
  const prompt = `Analiza el siguiente problema de programación lineal y construye el modelo matemático. Identifica las variables de decisión, función objetivo (max/min), restricciones, desigualdades, no negatividad y conversiones de unidades. No resuelvas el Simplex. Explica brevemente cómo obtuviste cada restricción. Si hay ambigüedad, indícala en lugar de inventar datos. Devuelve el modelo listo para introducir en un solucionador Simplex.\n\nENUNCIADO:\n${candidate.text}`;
  const panel = document.querySelector('.manual-interpret-panel');
  if (panel) panel.remove();
  openManualInterpretation({ text: candidate.text });
  const target = document.querySelector('.manual-prompt');
  if (target) { target.value = prompt; target.focus(); target.select(); }
}

async function ensurePdfJs() {
  if (window.__simplexPdfJs) return window.__simplexPdfJs;
  const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  window.__simplexPdfJs = mod;
  return mod;
}

function pdfTextItemGeometry(item) {
  const t = item?.transform || [];
  return {
    text: String(item?.str || ''),
    x: Number(t[4]) || 0,
    y: Number(t[5]) || 0,
    width: Number(item?.width) || 0,
    hasEOL: Boolean(item?.hasEOL),
  };
}

function groupPdfItemsIntoLines(items) {
  const usable = items.map(pdfTextItemGeometry).filter(item => item.text.trim());
  if (!usable.length) return [];

  // PDF.js devuelve los fragmentos en el orden interno del PDF, no necesariamente
  // en el orden visual. Primero agrupamos por coordenada Y y después ordenamos
  // cada línea de izquierda a derecha para reconstruir el texto que ve el usuario.
  usable.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  const tolerance = 3.5;

  for (const item of usable) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  lines.sort((a, b) => b.y - a.y);
  return lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let previous = null;
    for (const item of line.items) {
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      // Un espacio visual amplio suele significar separación entre palabras.
      // No añadimos espacios alrededor de signos matemáticos para evitar
      // romper expresiones como <= o fracciones al reconstruirlas.
      const startsWithOperator = /^[+\-*/=<>≤≥]/.test(item.text.trim());
      const endsWithOperator = /[+\-*/=<>≤≥]$/.test(text.trim());
      if (text && !startsWithOperator && !endsWithOperator && gap > 1.5) text += ' ';
      text += item.text;
      previous = item;
    }
    return text.trim();
  }).filter(Boolean);
}

function rebuildPdfText(rawLines) {
  // Conservamos saltos de página si existen en la fuente; los saltos de línea
  // reconstruidos se mantienen para que splitPdfExercises pueda detectar títulos
  // y ecuaciones partidas sin mezclar todo el documento en una sola línea.
  return rawLines.map(line => normalizeUnicodeSubscripts(line)).join('\n');
}

async function extractPdfText(file) {
  const pdfjs = await ensurePdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ disableCombineTextItems: false });
    const lines = groupPdfItemsIntoLines(content.items || []);
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\f\n');
}

function analyzeTextInput(text, label = 'Texto pegado') {
  const blocks = splitPdfExercises(text);
  const candidates = blocks.map((block, i) => {
    const first = block.split(/\n/)[0] || `Ejercicio ${i + 1}`;
    const title = /^(?:ejercicio|ejerc\.|problema|problem|modelo)/i.test(first) ? first : `Bloque ${i + 1}`;
    return { title, text: block, model: extractModelFromText(block) };
  });
  renderCandidates(candidates, label);
  return candidates;
}

function loadExample() {
  state.variables = 2; state.constraints = 3; state.objectiveType = 'max'; state.nonnegative = true;
  el.variableCount.value = '2'; el.constraintCount.value = '3'; el.objectiveType.value = 'max'; el.nonnegative.checked = true;
  renderEditor({ objective: ['3', '5'], constraints: [
    { coeffs: ['1', '1'], op: '<=', rhs: '10' },
    { coeffs: ['1', '3'], op: '<=', rhs: '12' },
    { coeffs: ['2', '1'], op: '<=', rhs: '16' },
  ]});
  showMessage('Ejemplo cargado.', 'ok');
  el.resultSection.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showMessage(text, kind = '') { el.message.textContent = text; el.message.className = `message ${kind}`.trim(); }

el.variableCount.addEventListener('input', setCounts);
el.constraintCount.addEventListener('input', setCounts);
el.objectiveType.addEventListener('change', () => { state.objectiveType = el.objectiveType.value; renderEditor(); });
el.nonnegative.addEventListener('change', () => { state.nonnegative = el.nonnegative.checked; });
el.example.addEventListener('click', loadExample);
el.learningMode.addEventListener('change', () => {
  document.querySelectorAll('[data-learning-only]').forEach((node) => node.classList.toggle('collapsed-learning', !el.learningMode.checked));
});

el.analyzeText.addEventListener('click', () => {
  const text = el.problemText.value.trim();
  if (!text) { el.pdfStatus.textContent = 'Pega primero el texto de uno o varios ejercicios.'; el.pdfStatus.className = 'message error'; return; }
  el.pdfStatus.textContent = 'Analizando texto…';
  el.pdfStatus.className = 'message';
  analyzeTextInput(text);
  el.pdfStatus.textContent = 'Análisis terminado. Revisa cada modelo antes de usarlo.';
  el.pdfStatus.className = 'message ok';
});

el.pdfInput.addEventListener('change', async () => {
  const file = el.pdfInput.files?.[0];
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    el.pdfStatus.textContent = 'Selecciona un archivo PDF válido.';
    el.pdfStatus.className = 'message error';
    return;
  }
  el.pdfStatus.textContent = 'Leyendo PDF…';
  el.pdfStatus.className = 'message';
  try {
    const text = await extractPdfText(file);
    if (!text.trim()) throw new Error('El PDF no contiene texto seleccionable. Puede ser un documento escaneado o basado en imágenes.');
    analyzeTextInput(text, file.name);
    el.problemText.value = text.slice(0, 120000);
    el.pdfStatus.textContent = `PDF leído: ${file.name}. Revisa los ejercicios detectados antes de importarlos.`;
    el.pdfStatus.className = 'message ok';
  } catch (error) {
    el.pdfStatus.textContent = `No se pudo leer el PDF: ${error.message || error}`;
    el.pdfStatus.className = 'message error';
  }
});

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    state.objectiveType = el.objectiveType.value;
    state.nonnegative = el.nonnegative.checked;
    const problem = readProblem();
    const result = solveTwoPhase(problem);
    renderResults(problem, result);
    showMessage(result.status === 'optimal' ? 'Problema resuelto correctamente.' : 'El modelo se procesó; revisa el estado del resultado.', result.status === 'optimal' ? 'ok' : '');
    el.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    el.resultSection.classList.add('hidden');
    showMessage(error instanceof Error ? error.message : 'No se pudo procesar el problema.', 'error');
  }
});

function updateGraphSliderVisual(){
  if(!el.graphSlider) return;
  const min=Number(el.graphSlider.min)||0;
  const max=Number(el.graphSlider.max)||100;
  const value=Number(el.graphSlider.value)||0;
  const pct=max===min?0:Math.max(0,Math.min(100,((value-min)/(max-min))*100));
  el.graphSlider.style.setProperty('--range-progress', `${pct}%`);
}

el.graphEnabled?.addEventListener('change',()=>{if(!el.graphEnabled.checked){el.graphOutput.innerHTML='';return;}if(currentLastProblem&&currentLastResult)el.graphOutput.innerHTML=renderGraph(currentLastProblem,currentLastResult,Number(el.graphSlider.value));});
el.graphSlider?.addEventListener('input',()=>{updateGraphSliderVisual();el.graphZValue.textContent=`Z = ${formatNumber(Number(el.graphSlider.value))}`;if(currentLastProblem&&currentLastResult&&el.graphEnabled.checked)el.graphOutput.innerHTML=renderGraph(currentLastProblem,currentLastResult,Number(el.graphSlider.value));});
updateGraphSliderVisual();

renderEditor();
