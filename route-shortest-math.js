/* Pure helpers for the shortest-path module. Dijkstra requires non-negative weights. */
(function (root) {
  'use strict';
  function parseEdgeText(text) {
    const edges = [], warnings = [];
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      if (/^(aristas?|conexiones?|origen\s*[,|;\t ]+destino|nodo\s*[,|;\t ]+nodo|desde\b|ejercicio\b|problema\b|ruta más corta)/i.test(line) && !/\d/.test(line)) continue;
      let m = line.match(/^(.+?)\s*(?:->|→|⟶|—|–|:|\s+-\s+)\s*(.+?)\s*(?:[,;|\t ]+)(-?\d+(?:[.,]\d+)?)\s*$/);
      if (!m) m = line.match(/^desde\s+(.+?)\s+hasta\s+(.+?)\s+(?:con\s+)?(?:costo|coste|peso|distancia|distancia\s+de)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)\s*$/i);
      if (!m) {
        const cols = line.split(/\s*(?:\||;|\t|,)\s*/);
        if (cols.length >= 3 && /^-?\d+(?:[.,]\d+)?$/.test(cols[cols.length - 1])) m = [line, cols[0], cols[1], cols[2]];
      }
      if (!m) {
        const generic = line.match(/^([\p{L}\p{N}_.-]+)\s+([\p{L}\p{N}_.-]+)\s+(-?\d+(?:[.,]\d+)?)\s*$/u);
        if (generic) m = generic;
      }
      if (!m) { if (/\d/.test(line) && !/^(distancia|peso|costo|coste|valor)/i.test(line)) warnings.push(`Línea ${i + 1}: no se pudo interpretar «${line.slice(0, 90)}».`); continue; }
      const from = String(m[1]).trim().replace(/^desde\s+/i, '').replace(/[:;,|]+$/, ''), to = String(m[2]).trim().replace(/^hasta\s+/i, '').replace(/[:;,|]+$/, ''), weight = Number(String(m[3]).replace(',', '.'));
      if (!from || !to || !Number.isFinite(weight)) { warnings.push(`Línea ${i + 1}: datos incompletos.`); continue; }
      edges.push({ from, to, weight });
    }
    if (!edges.length) throw new Error('No encontré aristas con origen, destino y peso. Usa una fila por conexión, por ejemplo: A B 4 o A -> B: 4.');
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
