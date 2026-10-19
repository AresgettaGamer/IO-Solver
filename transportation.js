'use strict';

/* IO Solver v8.0.0 · Modelos de transporte, Esquina Noroeste y Costo Mínimo.
 * El módulo es independiente de los motores de Simplex y PERT/CPM. Comparte
 * tokens, servicios de almacenamiento/impresión y el sistema de navegación.
 */
(function initTransportationModule() {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const EPS = 1e-9;
  const MIN_DIM = 2;
  const MAX_DIM = 8;

  const el = {
    root: $('#transportation-module'),
    projectName: $('#transport-project-name'),
    inputTable: $('#transport-input-table'),
    balancePreview: $('#transport-balance-preview'),
    message: $('#transport-message'),
    addSource: $('#transport-add-source'),
    removeSource: $('#transport-remove-source'),
    addDestination: $('#transport-add-destination'),
    removeDestination: $('#transport-remove-destination'),
    exampleBalanced: $('#transport-example-balanced'),
    exampleSurplus: $('#transport-example-surplus'),
    newProject: $('#transport-new-btn'),
    saveProject: $('#transport-save-btn'),
    loadProject: $('#transport-load-btn'),
    fileInput: $('#transport-file-input'),
    solve: $('#transport-solve-btn'),
    result: $('#transport-result'),
    modelOutput: $('#transport-model-output'),
    stepStatus: $('#transport-step-status'),
    stepText: $('#transport-step-text'),
    stepTable: $('#transport-step-table'),
    previous: $('#transport-previous-step'),
    next: $('#transport-next-step'),
    showAll: $('#transport-show-all'),
    resetSteps: $('#transport-reset-steps'),
    finalSummary: $('#transport-final-summary'),
    finalTable: $('#transport-final-table'),
    finalSection: $('#transport-final-section'),
    methodInputs: $$('input[name=transport-method]'),
    tieMode: $('#transport-tie-mode'),
    tieChoice: $('#transport-tie-choice'),
    stepHeading: $('#transport-step-heading'),
    stepDescription: $('#transport-step-description'),
    print: $('#transport-print-btn'),
  };
  if (!el.root || !el.inputTable) return;

  const state = {
    projectName: 'Ejercicio de transporte',
    sources: [],
    destinations: [],
    costs: [],
    forbidden: [],
    method: 'northwest',
    manualTieSelection: false,
    tieDecisions: [],
    result: null,
    stepIndex: 0,
    showAll: false,
  };

  const examples = {
    balanced: {
      name: 'Ejemplo · Fuentes A–C y destinos D–H',
      sources: [
        { label: 'A', supply: '19' },
        { label: 'B', supply: '28' },
        { label: 'C', supply: '25' },
      ],
      destinations: [
        { label: 'D', demand: '11' },
        { label: 'E', demand: '13' },
        { label: 'F', demand: '7' },
        { label: 'G', demand: '17' },
        { label: 'H', demand: '24' },
      ],
      costs: [[42, 42, 44, 40, 44], [34, 42, 40, 46, 48], [46, 44, 42, 48, 46]],
    },
    surplus: {
      name: 'Ejemplo · Excedente de oferta',
      sources: [
        { label: 'A', supply: '550' },
        { label: 'B', supply: '300' },
        { label: 'C', supply: '260' },
      ],
      destinations: [
        { label: 'C1', demand: '250' },
        { label: 'C2', demand: '300' },
        { label: 'C3', demand: '200' },
        { label: 'C4', demand: '160' },
      ],
      costs: [[8, 3, 4, 5], [7, 6, 5, 2], [2, 4, 3, 3]],
    },
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const numText = value => {
    if (!Number.isFinite(Number(value))) return '—';
    const n = Math.abs(Number(value)) < EPS ? 0 : Number(value);
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(n);
  };
  const variable = (i, j) => `x${i + 1}${j + 1}`;
  const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);

  function message(text, kind = '') {
    el.message.textContent = text;
    el.message.className = `message ${kind}`.trim();
  }

  function updateMethodControls() {
    const selected = el.methodInputs.find(input => input.checked);
    if (selected) state.method = selected.value;
    const manualTieControl = $('#transport-manual-tie-control');
    if (manualTieControl) manualTieControl.hidden = state.method !== 'minimum-cost';
    if (el.tieMode) {
      el.tieMode.setAttribute('aria-pressed', String(state.manualTieSelection));
      el.tieMode.textContent = `Elegir empates manualmente: ${state.manualTieSelection ? 'Activado' : 'Desactivado'}`;
    }
    if (el.stepHeading) el.stepHeading.textContent = state.method === 'minimum-cost' ? '3. Método de Costo Mínimo' : '3. Método de la Esquina Noroeste';
    if (el.stepDescription) el.stepDescription.textContent = state.method === 'minimum-cost'
      ? 'En cada paso se elige una ruta permitida con el menor costo unitario disponible y se asigna el mínimo entre oferta y demanda restantes.'
      : 'En cada paso se asigna el mínimo entre la oferta de la fuente activa y la demanda del destino activo, comenzando desde la esquina superior izquierda.';
  }

  function refreshResultInvalidation() {
    state.result = null;
    state.stepIndex = 0;
    state.showAll = false;
    el.result.classList.add('hidden');
    if (el.tieChoice) { el.tieChoice.innerHTML = ''; el.tieChoice.classList.add('hidden'); }
    if (el.finalSection) el.finalSection.classList.remove('hidden');
    el.showAll.setAttribute('aria-pressed', 'false');
  }

  function renderInputTable() {
    if (!state.forbidden.length) state.forbidden = state.sources.map(() => state.destinations.map(() => false));
    const head = `<thead><tr><th scope="col">Fuente / destino</th>${state.destinations.map((d, j) => `
      <th scope="col"><label class="transport-table-label"><span>Destino ${j + 1}</span><input type="text" maxlength="12" value="${esc(d.label)}" data-destination-label="${j}" aria-label="Nombre del destino ${j + 1}"></label></th>`).join('')}
      <th scope="col"><span class="transport-supply-heading">Oferta</span></th></tr></thead>`;
    const rows = state.sources.map((source, i) => `<tr>
      <th scope="row"><label class="transport-table-label"><span>Fuente ${i + 1}</span><input type="text" maxlength="12" value="${esc(source.label)}" data-source-label="${i}" aria-label="Nombre de la fuente ${i + 1}"></label></th>
      ${state.destinations.map((_, j) => {
        const blocked = Boolean(state.forbidden[i]?.[j]);
        const cost = state.costs[i]?.[j] ?? '';
        return `<td><div class="transport-cost-editor ${blocked ? 'is-forbidden' : ''}">${blocked
          ? `<span class="transport-route-x" aria-label="Ruta prohibida">X</span>`
          : `<input class="transport-number" type="number" min="0" step="any" value="${esc(cost)}" data-cost-row="${i}" data-cost-col="${j}" aria-label="Costo de ${esc(source.label)} a ${esc(state.destinations[j].label)}">`}
          <button class="transport-route-toggle" type="button" data-route-toggle="${i},${j}" aria-pressed="${String(blocked)}" aria-label="Estado de prohibición de ruta ${esc(source.label)} a ${esc(state.destinations[j].label)}" title="${blocked ? 'Permitir ruta' : 'Marcar ruta como imposible (X)'}">${blocked ? '↺' : '×'}</button></div></td>`;
      }).join('')}
      <td><input class="transport-number transport-offer-input" type="number" min="0" step="any" value="${esc(source.supply)}" data-supply="${i}" aria-label="Oferta de la fuente ${i + 1}"></td>
    </tr>`).join('');
    const demandRow = `<tr class="transport-demand-input-row"><th scope="row">Demanda</th>${state.destinations.map((d, j) => `<td><input class="transport-number transport-demand-input" type="number" min="0" step="any" value="${esc(d.demand)}" data-demand="${j}" aria-label="Demanda del destino ${j + 1}"></td>`).join('')}<td class="transport-total-input"><span>Demanda total</span><strong id="transport-total-preview">—</strong></td></tr>`;
    el.inputTable.innerHTML = `${head}<tbody>${rows}${demandRow}</tbody>`;
    updateDimensionButtons();
    updateBalancePreview();
  }

  function updateDimensionButtons() {
    el.addSource.disabled = state.sources.length >= MAX_DIM;
    el.removeSource.disabled = state.sources.length <= MIN_DIM;
    el.addDestination.disabled = state.destinations.length >= MAX_DIM;
    el.removeDestination.disabled = state.destinations.length <= MIN_DIM;
  }

  function readInputState() {
    const sourceLabels = $$('[data-source-label]', el.inputTable);
    const destinationLabels = $$('[data-destination-label]', el.inputTable);
    const supplies = $$('[data-supply]', el.inputTable);
    const demands = $$('[data-demand]', el.inputTable);
    state.sources = sourceLabels.map((input, i) => ({ label: input.value.trim(), supply: supplies[i]?.value ?? '' }));
    state.destinations = destinationLabels.map((input, j) => ({ label: input.value.trim(), demand: demands[j]?.value ?? '' }));
    const costs = Array.from({ length: state.sources.length }, (_, i) => Array.from({ length: state.destinations.length }, (_, j) => state.costs[i]?.[j] ?? ''));
    $$('[data-cost-row]', el.inputTable).forEach(input => { costs[Number(input.dataset.costRow)][Number(input.dataset.costCol)] = input.value; });
    state.costs = costs;
    if (state.forbidden.length !== state.sources.length || state.forbidden.some(row => row.length !== state.destinations.length)) {
      state.forbidden = Array.from({ length: state.sources.length }, (_, i) => Array.from({ length: state.destinations.length }, (_, j) => Boolean(state.forbidden[i]?.[j])));
    }
    return state;
  }

  function getTotalsFromInput() {
    readInputState();
    const supplyRaw = state.sources.map(s => String(s.supply).trim());
    const demandRaw = state.destinations.map(d => String(d.demand).trim());
    if (supplyRaw.some(v => v === '') || demandRaw.some(v => v === '')) return null;
    const supplies = supplyRaw.map(Number);
    const demands = demandRaw.map(Number);
    if (!supplies.every(Number.isFinite) || !demands.every(Number.isFinite)) return null;
    const costsComplete = state.costs.every((row, i) => row.every((value, j) => state.forbidden[i]?.[j] || (String(value).trim() !== '' && Number.isFinite(Number(value)))));
    return { supply: sum(supplies), demand: sum(demands), difference: sum(supplies) - sum(demands), costsComplete };
  }

  function updateBalancePreview() {
    const totals = getTotalsFromInput();
    const totalPreview = $('#transport-total-preview');
    if (totalPreview) totalPreview.textContent = totals ? numText(totals.demand) : '—';
    if (!totals) {
      el.balancePreview.innerHTML = '<span class="transport-balance-indicator is-incomplete">Introduce valores de oferta y demanda para comprobar el balance.</span>';
      return;
    }
    const { supply, demand, difference, costsComplete } = totals;
    let balanceMarkup;
    if (Math.abs(difference) < EPS) {
      balanceMarkup = `<span class="transport-balance-indicator is-balanced"><span aria-hidden="true">✓</span> Modelo balanceado</span><span>Oferta: <strong>${numText(supply)}</strong></span><span>Demanda: <strong>${numText(demand)}</strong></span>`;
    } else if (difference < 0) {
      balanceMarkup = `<span class="transport-balance-indicator is-adjusted">Falta oferta</span><span>Oferta: <strong>${numText(supply)}</strong></span><span>Demanda: <strong>${numText(demand)}</strong></span><span>Déficit: <strong>${numText(-difference)}</strong></span><span>Se añadirá una fábrica ficticia con oferta ${numText(-difference)} y costos cero.</span>`;
    } else {
      balanceMarkup = `<span class="transport-balance-indicator is-adjusted">Excedente de oferta</span><span>Oferta: <strong>${numText(supply)}</strong></span><span>Demanda: <strong>${numText(demand)}</strong></span><span>Excedente: <strong>${numText(difference)}</strong></span><span>Se añadirá un cliente ficticio con demanda ${numText(difference)} y costos cero.</span>`;
    }
    if (!costsComplete) balanceMarkup += '<span>Completa los costos unitarios para poder resolver.</span>';
    el.balancePreview.innerHTML = balanceMarkup;
  }

  function loadExample(which, notify = true) {
    const example = examples[which];
    state.projectName = example.name;
    state.sources = example.sources.map(s => ({ ...s }));
    state.destinations = example.destinations.map(d => ({ ...d }));
    state.costs = example.costs.map(row => row.map(String));
    state.forbidden = example.costs.map(row => row.map(() => false));
    state.tieDecisions = [];
    state.result = null;
    state.stepIndex = 0;
    state.showAll = false;
    el.projectName.value = state.projectName;
    el.showAll.setAttribute('aria-pressed', 'false');
    renderInputTable();
    el.result.classList.add('hidden');
    if (notify) message(which === 'surplus' ? 'Ejemplo cargado. La oferta supera a la demanda; al analizarlo se agregará un cliente ficticio para absorber el excedente.' : 'Ejemplo cargado. Oferta y demanda están balanceadas.', 'ok');
  }

  function validateInput() {
    readInputState();
    if (state.sources.length < MIN_DIM || state.destinations.length < MIN_DIM) throw new Error('El modelo necesita al menos 2 fuentes y 2 destinos.');
    const validateLabels = (items, noun) => {
      const seen = new Set();
      items.forEach((item, i) => {
        if (!item.label) throw new Error(`Falta el nombre de la ${noun} ${i + 1}.`);
        const key = item.label.toLocaleLowerCase('es-MX');
        if (seen.has(key)) throw new Error(`El nombre “${item.label}” está repetido entre las ${noun === 'fuente' ? 'fuentes' : 'destinos'}.`);
        seen.add(key);
      });
    };
    validateLabels(state.sources, 'fuente');
    validateLabels(state.destinations, 'destino');
    state.sources.forEach((source, i) => {
      const value = Number(source.supply);
      if (source.supply === '' || !Number.isFinite(value) || value < 0) throw new Error(`La oferta de la fuente ${source.label} debe ser un número finito igual o mayor que cero.`);
    });
    state.destinations.forEach(dest => {
      const value = Number(dest.demand);
      if (dest.demand === '' || !Number.isFinite(value) || value < 0) throw new Error(`La demanda del destino ${dest.label} debe ser un número finito igual o mayor que cero.`);
    });
    state.costs.forEach((row, i) => row.forEach((raw, j) => {
      if (state.forbidden[i]?.[j]) return;
      const cost = Number(raw);
      if (raw === '' || !Number.isFinite(cost) || cost < 0) throw new Error(`El costo de ${state.sources[i].label} a ${state.destinations[j].label} debe ser un número finito igual o mayor que cero, o marca la ruta como prohibida (X).`);
    }));
    const totals = { supply: sum(state.sources.map(s => Number(s.supply))), demand: sum(state.destinations.map(d => Number(d.demand))) };
    if (!(totals.supply > EPS) || !(totals.demand > EPS)) throw new Error('La oferta total y la demanda total deben ser mayores que cero.');
    // Si falta oferta, la fuente ficticia puede cubrir demanda; en balance o excedente, un destino sin rutas reales es imposible.
    if (totals.supply + EPS >= totals.demand) {
      state.destinations.forEach((dest, j) => {
        if (Number(dest.demand) > EPS && state.sources.every((_, i) => state.forbidden[i]?.[j])) {
          throw new Error(`El destino ${dest.label} tiene demanda, pero todas sus rutas están prohibidas (X). Habilita al menos una ruta.`);
        }
      });
    }
    return { ...totals, difference: totals.supply - totals.demand };
  }

  function uniqueModelLabel(base, items) {
    const names = new Set(items.map(item => String(item.label).toLocaleLowerCase('es-MX')));
    if (!names.has(base.toLocaleLowerCase('es-MX'))) return base;
    let suffix = 2;
    while (names.has(`${base} ${suffix}`.toLocaleLowerCase('es-MX'))) suffix++;
    return `${base} ${suffix}`;
  }

  function createModel(totals) {
    const surplus = totals.difference > EPS;
    const shortage = totals.difference < -EPS;
    const sources = state.sources.map((source, i) => ({
      label: source.label,
      supply: Number(source.supply),
      kind: 'real',
      costs: state.costs[i].map((value, j) => state.forbidden[i]?.[j] ? 0 : Number(value)),
      forbidden: state.forbidden[i].map(Boolean),
      originalIndex: i,
    }));
    const originalDestinations = state.destinations.map((d, index) => ({ ...d, demand: Number(d.demand), kind: 'real', originalIndex: index }));
    const destinations = originalDestinations.map(dest => ({ ...dest }));
    const difference = totals.difference;

    if (shortage) {
      // Demanda > oferta: una fuente ficticia completa la oferta faltante.
      const deficit = -difference;
      sources.push({
        label: uniqueModelLabel('Ficticia', sources),
        supply: deficit,
        kind: 'dummy',
        costs: destinations.map(() => 0),
        forbidden: destinations.map(() => false),
        originalIndex: -1,
      });
    } else if (surplus) {
      // Oferta > demanda: un cliente ficticio absorbe el excedente a costo cero.
      const excess = difference;
      const dummyDestination = {
        label: uniqueModelLabel('Cliente ficticio', destinations),
        demand: excess,
        kind: 'dummy',
        originalIndex: -1,
      };
      destinations.push(dummyDestination);
      sources.forEach(source => {
        source.costs.push(0);
        source.forbidden.push(false);
      });
    }

    const demands = destinations.map(dest => Number(dest.demand));
    const adjustedSupply = sum(sources.map(source => source.supply));
    const adjustedDemand = sum(demands);
    return {
      originalSources: state.sources.map(s => ({ ...s, supply: Number(s.supply) })),
      originalDestinations,
      originalCosts: state.costs.map(row => row.map(value => value === '' ? null : Number(value))),
      sources,
      destinations,
      forbidden: sources.map(source => source.forbidden.slice()),
      demands,
      supplyTotal: totals.supply,
      demandTotal: totals.demand,
      adjustedSupply,
      adjustedDemand,
      difference,
      balanced: Math.abs(difference) < EPS,
      surplus,
      shortage,
    };
  }

  function createSolutionSnapshot(model, allocations, steps, supplyLeft, demandLeft, extra = {}) {
    const remainingDemand = demandLeft.reduce((total, value) => total + value, 0);
    const cost = allocations.reduce((total, row, i) => total + row.reduce((acc, value, j) => acc + value * (model.sources[i].costs[j] || 0), 0), 0);
    const usedBySource = allocations.map(row => sum(row));
    const unusedBySource = supplyLeft.map(value => Math.abs(value) < EPS ? 0 : value);
    return {
      allocations, steps, cost, supplyLeft: unusedBySource,
      demandLeft: demandLeft.map(value => Math.abs(value) < EPS ? 0 : value), usedBySource,
      hasUnusedSupply: unusedBySource.some((v, idx) => model.sources[idx].kind === 'real' && v > EPS),
      completed: remainingDemand <= 1e-6, ...extra,
    };
  }

  function eligibleCells(model, supplyLeft, demandLeft) {
    const cells = [];
    for (let i = 0; i < model.sources.length; i++) {
      if (supplyLeft[i] <= EPS) continue;
      for (let j = 0; j < model.destinations.length; j++) {
        if (demandLeft[j] <= EPS || model.forbidden[i]?.[j]) continue;
        cells.push({ sourceIndex: i, destinationIndex: j, cost: model.sources[i].costs[j] });
      }
    }
    return cells;
  }

  function allocateCell(model, allocations, supplyLeft, demandLeft, steps, cell, method, tieInfo = null) {
    const i = cell.sourceIndex; const j = cell.destinationIndex;
    const supplyBefore = supplyLeft[i]; const demandBefore = demandLeft[j];
    const amount = Math.min(supplyBefore, demandBefore);
    const supplyAfter = Math.abs(supplyBefore - amount) < EPS ? 0 : supplyBefore - amount;
    const demandAfter = Math.abs(demandBefore - amount) < EPS ? 0 : demandBefore - amount;
    allocations[i][j] += amount; supplyLeft[i] = supplyAfter; demandLeft[j] = demandAfter;
    const rowComplete = supplyAfter === 0; const colComplete = demandAfter === 0;
    const bothComplete = rowComplete && colComplete;
    steps.push({
      number: steps.length + 1, sourceIndex: i, destinationIndex: j,
      sourceLabel: model.sources[i].label, destinationLabel: model.destinations[j].label,
      sourceKind: model.sources[i].kind, destinationKind: model.destinations[j].kind, supplyBefore, demandBefore, amount, supplyAfter, demandAfter,
      rowComplete, colComplete, bothComplete, cost: cell.cost, method,
      tieInfo: tieInfo ? { ...tieInfo } : null,
      nextMove: bothComplete ? 'diagonal' : rowComplete ? 'down' : 'right',
    });
  }

  function createNorthwestSolution(model) {
    const supplyLeft = model.sources.map(s => s.supply);
    const demandLeft = model.demands.slice();
    const allocations = model.sources.map(() => model.destinations.map(() => 0));
    const steps = [];
    let guard = 0;
    while (demandLeft.some(value => value > EPS) && guard++ < model.sources.length * model.destinations.length + 1) {
      const eligible = eligibleCells(model, supplyLeft, demandLeft);
      if (!eligible.length) throw new Error('Esquina Noroeste no pudo completar la demanda respetando las rutas prohibidas. Revisa las X: quizá se necesita cambiar el orden de asignación o habilitar alguna ruta.');
      // Sin restricciones, la primera celda elegible en orden de matriz reproduce la esquina noroeste clásica.
      allocateCell(model, allocations, supplyLeft, demandLeft, steps, eligible[0], 'northwest');
    }
    if (demandLeft.some(value => value > 1e-6)) throw new Error('No se pudo cubrir toda la demanda con las rutas permitidas. Comprueba el modelo.');
    return createSolutionSnapshot(model, allocations, steps, supplyLeft, demandLeft);
  }

  function createMinimumCostSolution(model, manualTieSelection = false, tieDecisions = []) {
    const supplyLeft = model.sources.map(s => s.supply);
    const demandLeft = model.demands.slice();
    const allocations = model.sources.map(() => model.destinations.map(() => 0));
    const steps = [];
    let tieOrdinal = 0;
    let guard = 0;
    while (demandLeft.some(value => value > EPS) && guard++ < model.sources.length * model.destinations.length + 1) {
      const eligible = eligibleCells(model, supplyLeft, demandLeft);
      if (!eligible.length) throw new Error('Costo Mínimo no pudo completar la demanda respetando las rutas permitidas. Es posible que las X hayan dejado una combinación sin solución para este método; revisa el modelo o elige otra estrategia.');
      const minCost = Math.min(...eligible.map(cell => cell.cost));
      const tied = eligible.filter(cell => Math.abs(cell.cost - minCost) < EPS);
      let chosen = tied[0];
      let tieInfo = null;
      if (tied.length > 1) {
        const decisionKey = tieDecisions[tieOrdinal];
        if (manualTieSelection && !decisionKey) {
          const partial = createSolutionSnapshot(model, allocations, steps, supplyLeft, demandLeft, {
            pendingTie: { ordinal: tieOrdinal, cost: minCost, candidates: tied.map(cell => ({ ...cell })), tieCount: tieOrdinal + 1 },
          });
          return partial;
        }
        if (manualTieSelection && decisionKey) {
          chosen = tied.find(cell => `${cell.sourceIndex},${cell.destinationIndex}` === decisionKey) || tied[0];
          tieInfo = { count: tied.length, mode: 'manual', candidates: tied.map(cell => `${cell.sourceIndex},${cell.destinationIndex}`), selected: `${chosen.sourceIndex},${chosen.destinationIndex}` };
        } else {
          chosen = tied[0];
          tieInfo = { count: tied.length, mode: 'automatic', candidates: tied.map(cell => `${cell.sourceIndex},${cell.destinationIndex}`), selected: `${chosen.sourceIndex},${chosen.destinationIndex}` };
        }
        tieOrdinal++;
      }
      allocateCell(model, allocations, supplyLeft, demandLeft, steps, chosen, 'minimum-cost', tieInfo);
    }
    if (demandLeft.some(value => value > 1e-6)) throw new Error('No se pudo cubrir toda la demanda con las rutas permitidas. Comprueba el modelo.');
    return createSolutionSnapshot(model, allocations, steps, supplyLeft, demandLeft);
  }

  function makeConstraintModel(model) {
    const terms = [];
    const routeVariables = (i, j) => !model.forbidden[i]?.[j];
    model.sources.forEach((source, i) => model.destinations.forEach((dest, j) => {
      if (!routeVariables(i, j)) return;
      const cost = source.costs[j];
      if (Math.abs(cost) > EPS) terms.push(`${numText(cost)}${variable(i, j)}`);
    }));
    const objective = terms.length ? `Min Z = ${terms.join(' + ')}` : 'Min Z = 0';
    // El modelo transformado siempre queda balanceado: todas las restricciones son igualdades.
    const supplyConstraints = model.sources.map((source, i) => {
      const vars = model.destinations.map((_, j) => variable(i, j));
      return `${source.label}: ${vars.join(' + ')} = ${numText(source.supply)}${source.kind === 'dummy' ? '  (fuente ficticia)' : ''}`;
    });
    const demandConstraints = model.destinations.map((dest, j) => {
      const vars = model.sources.map((_, i) => variable(i, j));
      return `${dest.label}: ${vars.join(' + ')} = ${numText(dest.demand)}${dest.kind === 'dummy' ? '  (cliente ficticio)' : ''}`;
    });
    const forbiddenConstraints = [];
    model.sources.forEach((source, i) => model.destinations.forEach((dest, j) => {
      if (model.forbidden[i]?.[j]) forbiddenConstraints.push(`${variable(i, j)} = 0  (ruta prohibida: ${source.label} → ${dest.label})`);
    }));
    return { objective, supplyConstraints, demandConstraints, forbiddenConstraints, nonnegative: 'xᵢⱼ ≥ 0 para todas las rutas permitidas.' };
  }

  function renderModel(model) {
    const constraints = makeConstraintModel(model);
    let diffNote;
    if (model.balanced) {
      diffNote = `<div class="transport-model-note is-balanced"><strong>Modelo balanceado.</strong> Oferta total ${numText(model.supplyTotal)} = demanda total ${numText(model.demandTotal)}. No se requiere una fuente ni un cliente ficticio.</div>`;
    } else if (model.shortage) {
      const deficit = -model.difference;
      diffNote = `<div class="transport-model-note is-adjusted"><strong>Falta oferta por ${numText(deficit)}.</strong> Como la demanda (${numText(model.demandTotal)}) supera a la oferta (${numText(model.supplyTotal)}), se añade una <strong>fuente ficticia</strong> con oferta ${numText(deficit)} y costo cero hacia todos los destinos. Balance: ${numText(model.supplyTotal)} + ${numText(deficit)} = ${numText(model.adjustedSupply)} = ${numText(model.adjustedDemand)}.</div>`;
    } else {
      const excess = model.difference;
      diffNote = `<div class="transport-model-note is-adjusted"><strong>Excedente de oferta por ${numText(excess)}.</strong> Como la oferta (${numText(model.supplyTotal)}) supera a la demanda (${numText(model.demandTotal)}), se añade un <strong>cliente ficticio</strong> con demanda ${numText(excess)} y costo cero desde todas las fuentes. Balance: ${numText(model.adjustedSupply)} = ${numText(model.demandTotal)} + ${numText(excess)} = ${numText(model.adjustedDemand)}. Las asignaciones a ese cliente representan unidades sobrantes que no se envían a clientes reales.</div>`;
    }
    const constraintsMarkup = (title, items) => `<div class="transport-formula-group"><h4>${title}</h4><div class="transport-formula-list">${items.map(item => `<div class="transport-formula-line">${esc(item)}</div>`).join('')}</div></div>`;
    el.modelOutput.innerHTML = `${diffNote}
      <div class="transport-formula-group"><h4>Función objetivo</h4><div class="transport-formula-line transport-objective">${esc(constraints.objective)}</div><p class="muted transport-formula-hint">El costo total suma cada asignación por el costo unitario de su celda. Las celdas con costo cero se omiten de la expresión.</p></div>
      <p class="muted transport-formula-hint">Cada variable xᵢⱼ representa las unidades enviadas desde la fuente i hacia el destino j. Las fuentes o clientes ficticios son elementos de balanceo matemático.</p>${constraintsMarkup('Restricciones de oferta', constraints.supplyConstraints)}
      ${constraintsMarkup('Restricciones de demanda', constraints.demandConstraints)}
      ${constraints.forbiddenConstraints.length ? constraintsMarkup('Rutas prohibidas', constraints.forbiddenConstraints) : ''}
      <div class="transport-formula-group"><h4>No negatividad</h4><div class="transport-formula-line">${esc(constraints.nonnegative)}</div></div>`;
  }

  function transitionMarkup(before, after) {
    if (Math.abs(before - after) < EPS) return `<span class="transport-value-single">${numText(after)}</span>`;
    return `<span class="transport-transition"><span class="transport-before">${numText(before)}</span><span class="transport-arrow" aria-hidden="true">→</span><strong class="transport-after">${numText(after)}</strong></span>`;
  }

  function remainingAt(stepIndex) {
    const model = state.result.model;
    const supplies = model.sources.map(source => source.supply);
    const demands = model.demands.slice();
    for (let k = 0; k <= stepIndex && k < state.result.solution.steps.length; k++) {
      const step = state.result.solution.steps[k];
      supplies[step.sourceIndex] = step.supplyAfter;
      demands[step.destinationIndex] = step.demandAfter;
    }
    return { supplies, demands };
  }

  function renderStepTable(step, index) {
    const { model, solution, pendingTie } = state.result;
    const allocations = model.sources.map(() => model.destinations.map(() => 0));
    const lastIndex = state.showAll || !step ? solution.steps.length - 1 : index;
    for (let k = 0; k <= lastIndex; k++) {
      const s = solution.steps[k];
      if (s) allocations[s.sourceIndex][s.destinationIndex] += s.amount;
    }
    const remaining = remainingAt(lastIndex);
    const tieKeys = new Set((pendingTie?.candidates || []).map(cell => `${cell.sourceIndex},${cell.destinationIndex}`));
    const head = `<thead><tr><th scope="col">Fuente / destino</th>${model.destinations.map(d => `<th scope="col">${esc(d.label)}${d.kind === 'dummy' ? '<small>Cliente ficticio · sobrante</small>' : ''}</th>`).join('')}<th scope="col">Oferta restante</th></tr></thead>`;
    const rows = model.sources.map((source, i) => {
      const stepIsSource = !state.showAll && step && step.sourceIndex === i;
      const cells = model.destinations.map((dest, j) => {
        const blocked = Boolean(model.forbidden[i]?.[j]);
        const active = !state.showAll && step && step.sourceIndex === i && step.destinationIndex === j;
        const tieCandidate = tieKeys.has(`${i},${j}`);
        const assigned = allocations[i][j] > EPS;
        if (blocked) return `<td class="is-forbidden" aria-label="Ruta prohibida de ${esc(source.label)} a ${esc(dest.label)}"><span class="transport-route-x">X</span><small class="transport-forbidden-label">Prohibida</small></td>`;
        const amountMarkup = active
          ? `<strong class="transport-cell-allocation">${numText(step.amount)}</strong>`
          : `<strong class="transport-cell-allocation">${assigned ? numText(allocations[i][j]) : '—'}</strong>`;
        return `<td class="${active ? 'is-active' : tieCandidate ? 'is-tie-candidate' : assigned ? 'is-assigned' : ''} ${dest.kind === 'dummy' ? 'is-dummy-destination-cell' : ''}">${tieCandidate ? '<span class="transport-tie-marker">Empate mínimo</span>' : ''}<span class="transport-cell-cost">costo ${numText(source.costs[j])}</span>${amountMarkup}</td>`;
      }).join('');
      const supplyValue = state.showAll || !step
        ? `<span class="transport-value-single">${numText(remaining.supplies[i])}</span>`
        : stepIsSource ? transitionMarkup(step.supplyBefore, step.supplyAfter) : `<span class="transport-value-single">${numText(remaining.supplies[i])}</span>`;
      const supplyMarkup = `${supplyValue}${source.kind === 'dummy' ? '<small>ficticia</small>' : ''}`;
      return `<tr class="${stepIsSource ? 'is-current-source' : ''} ${source.kind === 'dummy' ? 'is-dummy-source' : ''}"><th scope="row">${esc(source.label)}${source.kind === 'dummy' ? '<small>Fuente ficticia</small>' : ''}</th>${cells}<td class="transport-remaining-cell">${supplyMarkup}</td></tr>`;
    }).join('');
    
    const demandCells = model.destinations.map((dest, j) => {
      const stepIsDemand = !state.showAll && step && step.destinationIndex === j;
      return `<td class="${stepIsDemand ? 'is-current-demand' : ''}">${state.showAll || !step ? `<span class="transport-value-single">${numText(remaining.demands[j])}</span>` : stepIsDemand ? transitionMarkup(step.demandBefore, step.demandAfter) : `<span class="transport-value-single">${numText(remaining.demands[j])}</span>`}</td>`;
    }).join('');
    const demandRow = `<tr class="transport-demand-row"><th scope="row">Demanda restante</th>${demandCells}<td class="transport-remaining-cell">${pendingTie ? 'Desempate' : state.showAll ? '—' : 'Paso ' + (index + 1)}</td></tr>`;
    el.stepTable.innerHTML = `<div class="table-wrap transport-grid-wrap"><table class="transport-step-grid">${head}<tbody>${rows}${demandRow}</tbody></table></div>`;
  }

  function renderStep() {
    const { model, solution, pendingTie } = state.result;
    updateMethodControls();
    if (pendingTie) {
      el.stepStatus.textContent = `Desempate pendiente · costo ${numText(pendingTie.cost)}`;
      el.stepText.innerHTML = `<p>Hay <strong>${pendingTie.candidates.length} rutas disponibles</strong> empatadas con el costo mínimo <strong class="transport-accent-value">${numText(pendingTie.cost)}</strong>. Elige la celda en la que quieres realizar la siguiente asignación.</p><p>Las celdas resaltadas en la matriz son opciones válidas. Después de tu elección, el método continuará y volverá a preguntarte si aparece otro empate.</p>`;
      renderStepTable(null, solution.steps.length - 1);
      el.tieChoice.innerHTML = `<p class="transport-tie-prompt">Selecciona una de las rutas empatadas:</p><div class="transport-tie-options">${pendingTie.candidates.map(cell => `<button class="btn secondary transport-tie-option" type="button" data-tie-choice="${cell.sourceIndex},${cell.destinationIndex}"><strong>${esc(model.sources[cell.sourceIndex].label)} → ${esc(model.destinations[cell.destinationIndex].label)}</strong><span>Costo ${numText(cell.cost)} · asignar min(${numText(solution.supplyLeft[cell.sourceIndex])}, ${numText(solution.demandLeft[cell.destinationIndex])})</span></button>`).join('')}</div>`;
      el.tieChoice.classList.remove('hidden');
      if (el.finalSection) el.finalSection.classList.add('hidden');
      el.previous.disabled = true; el.next.disabled = true; el.showAll.disabled = true;
      el.resetSteps.disabled = false;
      el.showAll.textContent = 'Mostrar solución completa';
      el.showAll.setAttribute('aria-pressed', 'false');
      return;
    }
    el.tieChoice.classList.add('hidden');
    if (el.finalSection) el.finalSection.classList.toggle('hidden', !solution.completed);
    const total = solution.steps.length;
    if (!total) {
      el.stepStatus.textContent = 'Sin asignaciones necesarias';
      el.stepText.innerHTML = '<p>La tabla no requiere asignaciones positivas. Revisa las fuentes y demandas de cero.</p>';
      renderStepTable(null, -1);
      el.previous.disabled = true; el.next.disabled = true; el.showAll.disabled = true;
      return;
    }
    el.showAll.disabled = false;
    state.stepIndex = Math.max(0, Math.min(total - 1, state.stepIndex));
    const step = solution.steps[state.stepIndex];
    const methodLabel = step.method === 'minimum-cost' ? 'Costo Mínimo' : 'Esquina Noroeste';
    el.stepStatus.textContent = state.showAll ? `Solución completa · ${total} iteraciones` : `Iteración ${step.number} de ${total}`;
    let text;
    const fictitiousExplanation = step?.destinationKind === 'dummy'
      ? '<p class="transport-next-move">El cliente ficticio representa el excedente de oferta: estas unidades quedan sin distribuir a destinos reales. La ruta ficticia tiene costo cero y permite balancear el modelo.</p>'
      : step?.sourceKind === 'dummy'
        ? '<p class="transport-next-move">La fuente ficticia representa el déficit de oferta: esta asignación cubre demanda no atendida por las fuentes reales y tiene costo cero.</p>'
        : '';
    if (state.showAll) {
      text = `<p>Se muestran todas las asignaciones obtenidas por el método de ${methodLabel}. Esta es una solución inicial factible; por sí solo, el método no garantiza que el costo sea óptimo.</p>`;
    } else if (step.method === 'minimum-cost') {
      const tieText = step.tieInfo
        ? step.tieInfo.mode === 'manual'
          ? `<p class="transport-next-move">Había un empate entre ${step.tieInfo.count} celdas con costo ${numText(step.cost)}. Elegiste ${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}.</p>`
          : `<p class="transport-next-move">Había un empate entre ${step.tieInfo.count} celdas con costo ${numText(step.cost)}. En modo automático se eligió la primera en orden de matriz: ${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}.</p>`
        : '';
      text = `<p><strong>Ruta seleccionada: ${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}.</strong> Su costo unitario es <strong class="transport-accent-value">${numText(step.cost)}</strong>, el menor entre las rutas que siguen disponibles.</p>
        <div class="transport-allocation-equation"><span>min(${numText(step.supplyBefore)}, ${numText(step.demandBefore)})</span><span aria-hidden="true">=</span><strong>${numText(step.amount)}</strong></div>
        <p>Se asigna <strong>${numText(step.amount)}</strong> unidad(es). La oferta cambia de <strong class="transport-accent-value">${numText(step.supplyBefore)}</strong> a <strong>${numText(step.supplyAfter)}</strong>; la demanda cambia de <strong class="transport-accent-value">${numText(step.demandBefore)}</strong> a <strong>${numText(step.demandAfter)}</strong>.</p>${tieText}${fictitiousExplanation}
        <p class="transport-next-move">Se actualizan la oferta y la demanda; después se vuelve a buscar el menor costo disponible. Las rutas marcadas con X no participan.</p>`;
    } else {
      text = `<p><strong>Ahora fuente ${esc(step.sourceLabel)}, destino ${esc(step.destinationLabel)}.</strong> Lo máximo posible entre la oferta disponible <strong>${numText(step.supplyBefore)}</strong> y la demanda pendiente <strong>${numText(step.demandBefore)}</strong> es:</p>
         <div class="transport-allocation-equation"><span>min(${numText(step.supplyBefore)}, ${numText(step.demandBefore)})</span><span aria-hidden="true">=</span><strong>${numText(step.amount)}</strong></div>
         <p>Se asigna <strong>${numText(step.amount)}</strong> unidad(es) a <strong>${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}</strong>. La oferta se actualiza de <strong class="transport-accent-value">${numText(step.supplyBefore)}</strong> a <strong>${numText(step.supplyAfter)}</strong>; la demanda, de <strong class="transport-accent-value">${numText(step.demandBefore)}</strong> a <strong>${numText(step.demandAfter)}</strong>.</p>
         <p class="transport-next-move">${step.bothComplete ? 'Oferta y demanda llegan a cero al mismo tiempo; avanzamos en diagonal a la siguiente fila y columna.' : step.rowComplete ? `La fuente ${esc(step.sourceLabel)} agotó su oferta; continuamos con otra fuente disponible.` : `El destino ${esc(step.destinationLabel)} queda satisfecho; continuamos con el siguiente destino disponible.`}</p>${fictitiousExplanation}`;
    }
    el.stepText.innerHTML = text;
    renderStepTable(step, state.stepIndex);
    el.previous.disabled = state.showAll || state.stepIndex <= 0;
    el.next.disabled = state.showAll || state.stepIndex >= total - 1;
    el.showAll.textContent = state.showAll ? 'Ver paso a paso' : 'Mostrar solución completa';
    el.showAll.setAttribute('aria-pressed', String(state.showAll));
  }

  function renderFinalTable() {
    const { model, solution } = state.result;
    const allocatedBySource = solution.usedBySource;
    const allocatedByDemand = model.destinations.map((_, j) => sum(solution.allocations.map(row => row[j])));
    const head = `<thead><tr><th scope="col">Fuente / destino</th>${model.destinations.map(d => `<th scope="col">${esc(d.label)}${d.kind === 'dummy' ? '<small>Cliente ficticio · sobrante</small>' : ''}</th>`).join('')}<th scope="col">Asignado / oferta</th></tr></thead>`;
    const rows = model.sources.map((source, i) => `<tr class="${source.kind === 'dummy' ? 'is-dummy-source' : ''}"><th scope="row">${esc(source.label)}${source.kind === 'dummy' ? '<small>Fuente ficticia · costo 0</small>' : ''}</th>${model.destinations.map((dest, j) => {
      const value = solution.allocations[i][j];
      if (model.forbidden[i]?.[j]) return '<td class="is-forbidden"><span class="transport-route-x">X</span><small class="transport-forbidden-label">Prohibida</small></td>';
      return `<td class="${value > EPS ? 'is-assigned' : ''} ${dest.kind === 'dummy' ? 'is-dummy-destination-cell' : ''}"><span class="transport-cell-cost">costo ${numText(source.costs[j])}</span><strong class="transport-cell-allocation">${value > EPS ? numText(value) : '—'}</strong></td>`;
    }).join('')}<td class="transport-total-cell"><strong>${numText(allocatedBySource[i])}</strong><small>de ${numText(source.supply)}</small>${allocatedBySource[i] + EPS < source.supply ? `<em>restan ${numText(source.supply - allocatedBySource[i])}</em>` : ''}</td></tr>`).join('');
    const demand = `<tr class="transport-demand-row"><th scope="row">Demanda cubierta</th>${model.destinations.map((dest, j) => `<td class="${Math.abs(allocatedByDemand[j] - dest.demand) < 1e-6 ? 'is-satisfied' : 'is-unsatisfied'}"><strong>${numText(allocatedByDemand[j])}</strong><small>de ${numText(dest.demand)}</small></td>`).join('')}<td class="transport-total-cell"><strong>${numText(sum(allocatedByDemand))}</strong><small>de ${numText(model.adjustedDemand)}</small></td></tr>`;
    el.finalTable.innerHTML = `<div class="table-wrap transport-grid-wrap"><table class="transport-step-grid transport-final-grid">${head}<tbody>${rows}${demand}</tbody></table></div>`;
    const dummySourceAllocation = model.shortage
      ? `<p class="transport-result-note">La fuente ficticia cubre ${numText(solution.usedBySource.find((_, i) => model.sources[i].kind === 'dummy') || 0)} unidad(es) de la insuficiencia de oferta, con costo cero. No representa una fábrica real.</p>`
      : '';
    const dummyDestinationAllocation = model.surplus
      ? `<p class="transport-result-note">Se asignaron ${numText(sum(solution.allocations.map(row => row[model.destinations.findIndex(dest => dest.kind === 'dummy')] || 0)))} unidad(es) al cliente ficticio. Representan el excedente de oferta que no se distribuye a clientes reales; no son envíos reales.</p>`
      : '';
    el.finalSummary.innerHTML = `<div class="transport-summary-cards"><div class="transport-summary-card"><span>Oferta original</span><strong>${numText(model.supplyTotal)}</strong></div><div class="transport-summary-card"><span>Demanda original</span><strong>${numText(model.demandTotal)}</strong></div><div class="transport-summary-card is-primary"><span>Costo de la solución inicial</span><strong>${numText(solution.cost)}</strong></div></div>
      <p class="transport-result-note">La matriz de resolución está balanceada con oferta ajustada ${numText(model.adjustedSupply)} y demanda ajustada ${numText(model.adjustedDemand)}. Esta es la solución inicial obtenida por el método de ${state.method === 'minimum-cost' ? 'Costo Mínimo' : 'la Esquina Noroeste'}. <strong>No implica que el costo sea mínimo global</strong>; para verificar optimalidad se necesita un método de mejora.</p>${dummySourceAllocation}${dummyDestinationAllocation}`;
  }

  function printReport() {
    if (!state.result || state.result.pendingTie || !window.IOSolverServices?.print?.open) return;
    const { model, solution } = state.result;
    const methodLabel = state.method === 'minimum-cost' ? 'Costo Mínimo' : 'Esquina Noroeste';
    const reportStyles = `
      .transport-print-lead{color:#475569;margin-bottom:20px}
      .transport-print-table{border-collapse:collapse;width:100%;font-size:9pt;margin:12px 0 22px}
      .transport-print-table th,.transport-print-table td{border:1px solid #cbd5e1;padding:6px 7px;text-align:center}
      .transport-print-table th{background:#f1f5f9}
      .transport-print-table td.is-assigned{background:#eaf5ff;font-weight:700}
      .transport-print-table td.is-forbidden{background:#fee2e2;color:#991b1b;font-weight:800}
      .transport-print-snapshot{font-size:7.5pt;margin:8px 0 2px}
      .transport-print-snapshot th,.transport-print-snapshot td{padding:4px 5px}
      .transport-print-step h4{margin:10px 0 4px;font-size:9.5pt}
      .transport-print-step{break-inside:avoid-page}
      .transport-print-section{margin-top:22px}
      .transport-print-step{border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin:10px 0;break-inside:avoid}
      .transport-print-step h3{margin:0 0 6px;font-size:11pt}
      .transport-print-note{background:#f8fafc;border-left:3px solid #0f766e;padding:10px}
    `;
    const table = `<table class="transport-print-table"><thead><tr><th>Fuente / destino</th>${model.destinations.map(d => `<th>${esc(d.label)}${d.kind === 'dummy' ? '<br><small>Cliente ficticio</small>' : ''}</th>`).join('')}<th>Oferta</th></tr></thead><tbody>${model.sources.map((source, i) => `<tr><th>${esc(source.label)}${source.kind === 'dummy' ? '<br><small>Fuente ficticia</small>' : ''}</th>${model.destinations.map((d, j) => model.forbidden[i]?.[j] ? '<td class="is-forbidden">X<br><small>Ruta prohibida</small></td>' : `<td class="${solution.allocations[i][j] > EPS ? 'is-assigned' : ''}">${numText(solution.allocations[i][j])}<br><small>costo ${numText(source.costs[j])}</small></td>`).join('')}<td>${numText(source.supply)}</td></tr>`).join('')}<tr><th>Demanda ajustada</th>${model.demands.map(d => `<td>${numText(d)}</td>`).join('')}<td>${numText(model.adjustedSupply)}</td></tr></tbody></table>`;
    // Crear una instantánea completa de la matriz después de cada asignación.
    // La exportación anterior describía el paso, pero no mostraba la tabla resultante.
    const allocationsByStep = model.sources.map(() => model.destinations.map(() => 0));
    const remainingSupplyByStep = model.sources.map(source => source.supply);
    const remainingDemandByStep = model.demands.slice();
    let cumulativeCost = 0;
    const steps = solution.steps.map(step => {
      allocationsByStep[step.sourceIndex][step.destinationIndex] += step.amount;
      remainingSupplyByStep[step.sourceIndex] = step.supplyAfter;
      remainingDemandByStep[step.destinationIndex] = step.demandAfter;
      const stepCost = step.amount * step.cost;
      cumulativeCost += stepCost;
      const tie = step.tieInfo ? `<p>Desempate ${step.tieInfo.mode === 'manual' ? 'elegido por el usuario' : 'automático'} entre ${step.tieInfo.count} rutas de costo ${numText(step.cost)}.</p>` : '';
      const selection = step.method === 'minimum-cost' ? `Seleccionar la ruta de menor costo disponible (${numText(step.cost)}): ${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}.` : `Seleccionar la siguiente celda elegible en orden de Esquina Noroeste.`;
      const snapshotRows = model.sources.map((source, i) => `<tr><th>${esc(source.label)}</th>${model.destinations.map((dest, j) => {
        if (model.forbidden[i]?.[j]) return '<td class="is-forbidden">X</td>';
        const amount = allocationsByStep[i][j];
        return `<td class="${amount > EPS ? 'is-assigned' : ''}">${amount > EPS ? `<strong>${numText(amount)}</strong>` : '—'}<br><small>costo ${numText(source.costs[j])}</small></td>`;
      }).join('')}<td><strong>${numText(remainingSupplyByStep[i])}</strong></td></tr>`).join('');
      const snapshotDemand = `<tr><th>Demanda restante</th>${remainingDemandByStep.map(value => `<td><strong>${numText(value)}</strong></td>`).join('')}<td>—</td></tr>`;
      const snapshot = `<table class="transport-print-table transport-print-snapshot"><thead><tr><th>Fuente / destino</th>${model.destinations.map(dest => `<th>${esc(dest.label)}</th>`).join('')}<th>Oferta restante</th></tr></thead><tbody>${snapshotRows}${snapshotDemand}</tbody></table>`;
      return `<article class="transport-print-step"><h3>Iteración ${step.number} · ${esc(step.sourceLabel)} → ${esc(step.destinationLabel)}</h3><p>${selection}</p><p>Asignar min(${numText(step.supplyBefore)}, ${numText(step.demandBefore)}) = <strong>${numText(step.amount)}</strong>.</p><p>Oferta: ${numText(step.supplyBefore)} − ${numText(step.amount)} = ${numText(step.supplyAfter)}. Demanda: ${numText(step.demandBefore)} − ${numText(step.amount)} = ${numText(step.demandAfter)}.</p><p>Costo de esta asignación: ${numText(step.amount)} × ${numText(step.cost)} = <strong>${numText(stepCost)}</strong>. Costo acumulado: <strong>${numText(cumulativeCost)}</strong>.</p>${tie}<h4>Tabla después de la iteración ${step.number}</h4>${snapshot}</article>`;
    }).join('');
    const c = state.result.constraints;
    const formulation = `<section class="transport-print-section"><h2>Modelo matemático</h2><h3>Función objetivo</h3><p>${esc(c.objective)}</p><h3>Restricciones de oferta</h3><ul>${c.supplyConstraints.map(line => `<li>${esc(line)}</li>`).join('')}</ul><h3>Restricciones de demanda</h3><ul>${c.demandConstraints.map(line => `<li>${esc(line)}</li>`).join('')}</ul>${c.forbiddenConstraints.length ? `<h3>Rutas prohibidas</h3><ul>${c.forbiddenConstraints.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}<p>${esc(c.nonnegative)}</p></section>`;
    const balance = model.balanced
      ? `Oferta = demanda = ${numText(model.supplyTotal)}.`
      : model.shortage
        ? `La demanda supera a la oferta por ${numText(-model.difference)}. Se agregó una fuente ficticia: ${numText(model.supplyTotal)} + ${numText(-model.difference)} = ${numText(model.adjustedSupply)} = ${numText(model.adjustedDemand)}.`
        : `La oferta supera a la demanda por ${numText(model.difference)}. Se agregó un cliente ficticio: ${numText(model.demandTotal)} + ${numText(model.difference)} = ${numText(model.adjustedDemand)} = ${numText(model.adjustedSupply)}. Las asignaciones al cliente ficticio representan excedente no distribuido.`;
    const content = `<header><p class="eyebrow">Investigación de Operaciones · IO Solver v8.1.5</p><h1>${esc(state.projectName || 'Ejercicio de transporte')}</h1><p class="transport-print-lead">Modelo de transporte · Método de ${methodLabel}</p><p>${esc(balance)}</p></header><section class="transport-print-section"><h2>Tabla de costos y balance</h2>${table}</section>${formulation}<section class="transport-print-section"><h2>Procedimiento</h2>${steps}</section><section class="transport-print-section"><h2>Costo de la solución inicial</h2><p><strong>Z = ${numText(solution.cost)}</strong></p><p class="transport-print-note">El método produce una solución inicial factible, no necesariamente óptima.</p></section>`;
    try { window.IOSolverServices.print.open({ title: `IO Solver · ${state.projectName}`, content, styles: reportStyles }); }
    catch (error) { message(error.message || 'No se pudo abrir la vista de impresión.', 'error'); }
  }

  function runSolution(model) {
    const solution = state.method === 'minimum-cost'
      ? createMinimumCostSolution(model, state.manualTieSelection, state.tieDecisions)
      : createNorthwestSolution(model);
    state.result = { model, solution, constraints: makeConstraintModel(model), pendingTie: solution.pendingTie || null };
    state.stepIndex = 0;
    state.showAll = false;
    renderModel(model);
    renderStep();
    if (solution.completed) renderFinalTable();
    el.result.classList.remove('hidden');
    if (state.result.pendingTie) {
      message(`Empate detectado entre ${solution.pendingTie.candidates.length} rutas con costo ${numText(solution.pendingTie.cost)}. Elige una para continuar.`, 'ok');
    } else {
      const methodLabel = state.method === 'minimum-cost' ? 'Costo Mínimo' : 'Esquina Noroeste';
      message(`Modelo resuelto por ${methodLabel}. ${solution.steps.length} iteraciones. Costo de la solución inicial: ${numText(solution.cost)}.`, 'ok');
    }
    el.result.scrollIntoView({ behavior: window.ioScrollBehavior ? window.ioScrollBehavior() : 'auto', block: 'start' });
  }

  function analyseAndSolve() {
    try {
      const totals = validateInput();
      state.projectName = el.projectName.value.trim() || 'Ejercicio de transporte';
      el.projectName.value = state.projectName;
      state.tieDecisions = [];
      runSolution(createModel(totals));
    } catch (error) {
      refreshResultInvalidation();
      message(error.message || 'No se pudo analizar el modelo.', 'error');
    }
  }

  function continueAfterTie(choiceKey) {
    if (!state.result?.pendingTie || state.method !== 'minimum-cost') return;
    const pending = state.result.pendingTie;
    const validChoice = pending.candidates.some(cell => `${cell.sourceIndex},${cell.destinationIndex}` === choiceKey);
    if (!validChoice) return;
    state.tieDecisions[pending.ordinal] = choiceKey;
    try {
      const model = state.result.model;
      runSolution(model);
    } catch (error) {
      message(error.message || 'No se pudo continuar el desempate.', 'error');
    }
  }

  function changeDimension(type, delta) {
    readInputState();
    if (type === 'source') {
      const next = state.sources.length + delta;
      if (next < MIN_DIM || next > MAX_DIM) return;
      if (delta > 0) state.sources.push({ label: String.fromCharCode(65 + (state.sources.length % 26)), supply: '10' });
      else state.sources.pop();
      const old = state.costs; const oldForbidden = state.forbidden;
      state.costs = Array.from({ length: state.sources.length }, (_, i) => Array.from({ length: state.destinations.length }, (_, j) => old[i]?.[j] ?? '1'));
      state.forbidden = Array.from({ length: state.sources.length }, (_, i) => Array.from({ length: state.destinations.length }, (_, j) => Boolean(oldForbidden[i]?.[j])));
    } else {
      const next = state.destinations.length + delta;
      if (next < MIN_DIM || next > MAX_DIM) return;
      if (delta > 0) state.destinations.push({ label: `D${state.destinations.length + 1}`, demand: '10' });
      else state.destinations.pop();
      state.costs = state.costs.map(row => row.slice(0, state.destinations.length).concat(Array(Math.max(0, state.destinations.length - row.length)).fill('1')));
      state.forbidden = state.forbidden.map(row => row.slice(0, state.destinations.length).concat(Array(Math.max(0, state.destinations.length - row.length)).fill(false)));
    }
    state.tieDecisions = [];
    refreshResultInvalidation(); renderInputTable();
  }

  function newProject() {
    state.projectName = 'Ejercicio de transporte';
    state.sources = [{ label: 'A', supply: '' }, { label: 'B', supply: '' }, { label: 'C', supply: '' }];
    state.destinations = [{ label: 'D1', demand: '' }, { label: 'D2', demand: '' }, { label: 'D3', demand: '' }];
    state.costs = [['', '', ''], ['', '', ''], ['', '', '']];
    state.forbidden = [[false, false, false], [false, false, false], [false, false, false]];
    state.tieDecisions = [];
    el.projectName.value = state.projectName;
    refreshResultInvalidation(); renderInputTable(); message('Nuevo modelo vacío listo para editar.', 'ok');
  }

  function saveProject() {
    readInputState();
    state.projectName = el.projectName.value.trim() || 'Ejercicio de transporte';
    const data = { app: 'IO Solver', module: 'Transporte', type: 'transportation', version: '8.0.0', projectName: state.projectName, sources: state.sources, destinations: state.destinations, costs: state.costs, forbidden: state.forbidden, savedAt: new Date().toISOString() };
    try {
      window.IOSolverServices.storage.downloadJson(data, state.projectName, 'io-solver-transporte');
      message('Modelo exportado a JSON.', 'ok');
    } catch (error) { message(error.message || 'No se pudo guardar el modelo.', 'error'); }
  }

  async function loadProject(file) {
    try {
      const data = await window.IOSolverServices.storage.readJsonFile(file);
      if (data?.type !== 'transportation' || !Array.isArray(data.sources) || !Array.isArray(data.destinations) || !Array.isArray(data.costs)) throw new Error('El archivo no es un proyecto de transporte de IO Solver.');
      if (data.sources.length < MIN_DIM || data.sources.length > MAX_DIM || data.destinations.length < MIN_DIM || data.destinations.length > MAX_DIM) throw new Error(`El proyecto debe tener entre ${MIN_DIM} y ${MAX_DIM} fuentes y destinos.`);
      if (data.costs.length !== data.sources.length || data.costs.some(row => !Array.isArray(row) || row.length !== data.destinations.length)) throw new Error('La matriz de costos no coincide con las dimensiones del proyecto.');
      state.projectName = String(data.projectName || 'Ejercicio de transporte').slice(0, 100);
      state.sources = data.sources.map(s => ({ label: String(s.label ?? ''), supply: String(s.supply ?? '') }));
      state.destinations = data.destinations.map(d => ({ label: String(d.label ?? ''), demand: String(d.demand ?? '') }));
      state.costs = data.costs.map(row => row.map(value => String(value ?? '')));
      if (data.forbidden != null && (!Array.isArray(data.forbidden) || data.forbidden.length !== state.sources.length || data.forbidden.some(row => !Array.isArray(row) || row.length !== state.destinations.length))) throw new Error('La matriz de rutas prohibidas no coincide con las dimensiones del proyecto.');
      state.forbidden = data.forbidden ? data.forbidden.map(row => row.map(Boolean)) : state.sources.map(() => state.destinations.map(() => false));
      state.tieDecisions = [];
      el.projectName.value = state.projectName;
      refreshResultInvalidation(); renderInputTable(); message('Proyecto de transporte cargado. Analízalo para reconstruir el procedimiento.', 'ok');
    } catch (error) { message(error.message || 'No se pudo cargar el proyecto.', 'error'); }
    finally { el.fileInput.value = ''; }
  }

  el.inputTable.addEventListener('input', () => { refreshResultInvalidation(); updateBalancePreview(); });
  el.inputTable.addEventListener('click', event => {
    const button = event.target.closest('[data-route-toggle]');
    if (!button) return;
    readInputState();
    const [i, j] = button.dataset.routeToggle.split(',').map(Number);
    state.forbidden[i][j] = !state.forbidden[i][j];
    state.tieDecisions = [];
    refreshResultInvalidation(); renderInputTable();
    message(state.forbidden[i][j] ? `Ruta ${state.sources[i].label} → ${state.destinations[j].label} marcada como prohibida (X).` : `Ruta ${state.sources[i].label} → ${state.destinations[j].label} habilitada.`, 'ok');
  });
  el.addSource.addEventListener('click', () => changeDimension('source', 1));
  el.removeSource.addEventListener('click', () => changeDimension('source', -1));
  el.addDestination.addEventListener('click', () => changeDimension('destination', 1));
  el.removeDestination.addEventListener('click', () => changeDimension('destination', -1));
  el.exampleBalanced.addEventListener('click', () => loadExample('balanced'));
  el.exampleSurplus.addEventListener('click', () => loadExample('surplus'));
  el.newProject.addEventListener('click', newProject);
  el.saveProject.addEventListener('click', saveProject);
  el.loadProject.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', () => { if (el.fileInput.files?.[0]) loadProject(el.fileInput.files[0]); });
  el.methodInputs.forEach(input => input.addEventListener('change', () => {
    state.method = input.value;
    state.tieDecisions = [];
    refreshResultInvalidation(); updateMethodControls();
  }));
  el.tieMode.addEventListener('click', () => {
    state.manualTieSelection = !state.manualTieSelection;
    state.tieDecisions = [];
    refreshResultInvalidation(); updateMethodControls();
  });
  el.tieChoice.addEventListener('click', event => {
    const button = event.target.closest('[data-tie-choice]');
    if (button) continueAfterTie(button.dataset.tieChoice);
  });
  updateMethodControls();
  el.solve.addEventListener('click', analyseAndSolve);
  el.previous.addEventListener('click', () => { if (!state.result || state.stepIndex <= 0) return; state.stepIndex--; renderStep(); });
  el.next.addEventListener('click', () => { if (!state.result || state.stepIndex >= state.result.solution.steps.length - 1) return; state.stepIndex++; renderStep(); });
  el.showAll.addEventListener('click', () => { if (!state.result) return; state.showAll = !state.showAll; renderStep(); });
  el.resetSteps.addEventListener('click', () => { if (!state.result) return; if (state.result.pendingTie) { state.tieDecisions = []; try { runSolution(state.result.model); } catch (error) { message(error.message || 'No se pudo reiniciar el procedimiento.', 'error'); } return; } state.stepIndex = 0; state.showAll = false; renderStep(); });
  el.print.addEventListener('click', printReport);
  el.projectName.addEventListener('input', () => { state.projectName = el.projectName.value; });

  /* v7.11.0 · Entrada controlada para un modelo importado y REVISADO por el usuario (PDF/imagen → revisión → aquí).
     Solo escribe en el editor de datos: no resuelve, no toca los resultados y respeta los límites y validaciones del módulo. */
  function applyImportedModel(model) {
    try {
      if (!model || !Array.isArray(model.sources) || !Array.isArray(model.destinations) || !Array.isArray(model.costs) || !Array.isArray(model.forbidden)) throw new Error('El modelo importado no tiene la estructura esperada.');
      const n = model.sources.length, m = model.destinations.length;
      if (n < MIN_DIM || m < MIN_DIM || n > MAX_DIM || m > MAX_DIM) throw new Error(`El modelo debe tener entre ${MIN_DIM} y ${MAX_DIM} fuentes y destinos (recibido ${n} × ${m}).`);
      if (model.costs.length !== n || model.forbidden.length !== n || model.costs.some(r => !Array.isArray(r) || r.length !== m) || model.forbidden.some(r => !Array.isArray(r) || r.length !== m)) throw new Error('Las dimensiones de la matriz no coinciden con las fuentes y destinos.');
      state.projectName = String(model.projectName || 'Ejercicio importado').slice(0, 100);
      state.sources = model.sources.map(s => ({ label: String(s.label), supply: String(s.supply) }));
      state.destinations = model.destinations.map(d => ({ label: String(d.label), demand: String(d.demand) }));
      state.costs = model.costs.map(row => row.map(String));
      state.forbidden = model.forbidden.map(row => row.map(Boolean));
      state.tieDecisions = []; state.result = null; state.stepIndex = 0; state.showAll = false;
      el.projectName.value = state.projectName; el.showAll.setAttribute('aria-pressed', 'false');
      renderInputTable(); el.result.classList.add('hidden');
      message('Modelo importado y aplicado al editor. Revisa las tablas y resuelve cuando estés listo: no se ha resuelto nada automáticamente.', 'ok');
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  window.IOTransportAPI = { applyImportedModel, MIN_DIM, MAX_DIM };

  loadExample('balanced', false);
})();
