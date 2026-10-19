/* Pure helpers for the shortest-path module. Dijkstra requires non-negative weights. */
(function (root) {
  'use strict';
  function parseEdgeText(text) {
    const edges = [], warnings = [];
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const node = String.raw`[\p{L}\p{N}_][\p{L}\p{N}_.-]{0,24}`;
    const weightRE = /^-?\d+(?:[.,]\d+)?$/;
    const safeNode = value => new RegExp(`^${node}$`, 'u').test(String(value || '').trim());
    const separators = /\s*(?:\||;|\t)\s*/;
    // La tabla necesita una fila de encabezados explícita con separadores; el orden de las columnas es libre.
    const headerLine = lines.findIndex(line => /origen|desde|nodo\s*(?:inicial|inicial)|inicio/i.test(line) && /destino|hasta|nodo\s*(?:final|destino)|fin/i.test(line) && /peso|coste|costo|distancia|tiempo|valor/i.test(line));
    let header = null;
    if (headerLine >= 0) {
      const cols = lines[headerLine].trim().split(separators).map(x => x.trim());
      const from = cols.findIndex(c => /origen|desde|nodo\s*inicial|inicio/i.test(c));
      const to = cols.findIndex(c => /destino|hasta|nodo\s*final|fin/i.test(c));
      const weight = cols.findIndex(c => /peso|coste|costo|distancia|tiempo|valor/i.test(c));
      if (cols.length >= 3 && from >= 0 && to >= 0 && weight >= 0 && new Set([from, to, weight]).size === 3) header = { from, to, weight };
    }
    const addWarning = (lineNo, line) => {
      if (warnings.length >= 8) return;
      warnings.push(`Línea ${lineNo}: parece una conexión, pero no pude asignar origen, destino y peso con seguridad («${line.slice(0, 90)}»).`);
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      if (header && i === headerLine) continue;
      if (header && i > headerLine && /[|;\t,]/.test(line)) {
        const cols = line.split(separators).map(x => x.trim());
        if (cols.length !== Math.max(header.from, header.to, header.weight) + 1) continue;
        const from = cols[header.from] || '', to = cols[header.to] || '', raw = cols[header.weight] || '';
        if (from && to && weightRE.test(raw)) edges.push({ from, to, weight: Number(raw.replace(',', '.')) });
        else if (cols.length === 3 && cols.some(Boolean)) addWarning(i + 1, line);
        continue;
      }
      if (/^(aristas?|conexiones?|origen\s*[,|;\t ]+destino|nodo\s*[,|;\t ]+nodo|ejercicio\b|problema\b|ruta más corta)/i.test(line) && !/->|→|⟶/.test(line)) continue;
      let m = line.match(new RegExp(`^(${node})\\s*(?:->|→|⟶|—|–|\\s+-\\s+)\\s*(${node})\\s*(?::|=|,|\\s+)\\s*(-?\\d+(?:[.,]\\d+)?)\\s*$`, 'u'));
      if (!m) m = line.match(/^desde\s+(.+?)\s+hasta\s+(.+?)\s+(?:con\s+)?(?:costo|coste|peso|distancia|tiempo)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)\s*$/i);
      if (!m) {
        const cols = line.split(separators).map(x => x.trim());
        if (cols.length === 3 && safeNode(cols[0]) && safeNode(cols[1]) && weightRE.test(cols[2])) m = [line, cols[0], cols[1], cols[2]];
        else if (cols.length === 3 && safeNode(cols[0]) && safeNode(cols[1]) && cols[2]) addWarning(i + 1, line);
      }
      if (!m) {
        // Solo advertir sobre líneas con apariencia estructural de arista; prosa, pies, fórmulas y OCR suelto se ignoran.
        const arrowCount = (line.match(/(?:->|→|⟶|—|–)/g) || []).length;
        const simpleArrowCandidate = arrowCount === 1 && /\d/.test(line) && new RegExp(`^${node}\\s*(?:->|→|⟶|—|–|\\s+-\\s+)\\s*${node}\\s+[^ ]+$`, 'u').test(line);
        if (simpleArrowCandidate) addWarning(i + 1, line);
        continue;
      }
      const from = String(m[1]).trim().replace(/^desde\s+/i, '').replace(/[:;,|]+$/, ''), to = String(m[2]).trim().replace(/^hasta\s+/i, '').replace(/[:;,|]+$/, ''), weight = Number(String(m[3]).replace(',', '.'));
      if (!from || !to || !Number.isFinite(weight)) { addWarning(i + 1, line); continue; }
      edges.push({ from, to, weight });
    }
    if (!edges.length) throw new Error('No encontré aristas claramente identificadas. Usa una conexión por línea (A B 4 o A -> B: 4), o una tabla con encabezados y columnas separadas. El texto narrativo y los pies de página no se tomarán como conexiones.');
    return { edges, warnings };
  }
  function computeShortestPath(inputEdges, start, goal, directed = false) {
    if (!Array.isArray(inputEdges) || !inputEdges.length) throw new Error('Añade al menos una conexión.');
    const names = new Map(), edges = [];
    const rawEdges = [];
    inputEdges.forEach((e, i) => {
      const from = String(e.from ?? '').trim(), to = String(e.to ?? '').trim(), weight = Number(e.weight);
      if (!from || !to || !Number.isFinite(weight)) throw new Error(`La conexión ${i + 1} tiene campos incompletos.`);
      if (weight < 0) throw new Error(`La conexión ${from} → ${to} tiene peso negativo. Dijkstra requiere pesos no negativos.`);
      names.set(from.toLocaleLowerCase(), names.get(from.toLocaleLowerCase()) || from); names.set(to.toLocaleLowerCase(), names.get(to.toLocaleLowerCase()) || to); rawEdges.push({ from, to, weight });
    });
    const nodes = [...names.values()]; if (nodes.length > 40) throw new Error('La red admite hasta 40 nodos.');
    const canonical = name => names.get(String(name).toLocaleLowerCase());
    rawEdges.forEach(e => edges.push({ from: canonical(e.from), to: canonical(e.to), weight: e.weight }));
    const findNode = value => nodes.find(n => n.toLocaleLowerCase() === String(value || '').trim().toLocaleLowerCase());
    const s = findNode(start || nodes[0]), t = findNode(goal || nodes[nodes.length - 1]);
    if (!s || !t) throw new Error(`Indica un origen y destino que existan en la red. Nodos detectados: ${nodes.join(', ')}.`);
    const adjacency = new Map(nodes.map(n => [n, []]));
    edges.forEach(e => { adjacency.get(e.from).push({ node: e.to, weight: e.weight }); if (!directed) adjacency.get(e.to).push({ node: e.from, weight: e.weight }); });
    const dist = Object.fromEntries(nodes.map(n => [n, Infinity])), prev = Object.fromEntries(nodes.map(n => [n, null]));
    const visited = new Set(), steps = []; dist[s] = 0;
    while (visited.size < nodes.length) {
      const current = nodes.filter(n => !visited.has(n)).sort((a, b) => dist[a] - dist[b] || nodes.indexOf(a) - nodes.indexOf(b))[0];
      if (!current || !Number.isFinite(dist[current])) { steps.push({ node: null, note: 'No quedan nodos alcanzables desde el origen.', distances: { ...dist }, previous: { ...prev }, relaxations: [] }); break; }
      visited.add(current); const relaxations = [];
      for (const edge of adjacency.get(current)) {
        if (visited.has(edge.node)) continue;
        const candidate = dist[current] + edge.weight;
        if (candidate < dist[edge.node] - 1e-10) { const old = dist[edge.node]; dist[edge.node] = candidate; prev[edge.node] = current; relaxations.push({ to: edge.node, old, next: candidate, weight: edge.weight, via: current }); }
      }
      steps.push({ node: current, distance: dist[current], distances: { ...dist }, previous: { ...prev }, relaxations, visited: [...visited] });
      if (current === t) break;
    }
    const reachable = Number.isFinite(dist[t]); let path = [];
    if (reachable) { let node = t, guard = 0; while (node && guard++ <= nodes.length) { path.unshift(node); if (node === s) break; node = prev[node]; } if (path[0] !== s) path = []; }
    return { nodes, edges, directed, source: s, target: t, distances: dist, previous: prev, steps, reachable: reachable && path.length > 0, path, distance: reachable && path.length ? dist[t] : Infinity };
  }
  const api = { parseEdgeText, computeShortestPath };
  root.IORouteShortestAPI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
