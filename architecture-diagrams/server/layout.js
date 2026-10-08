/**
 * Автоматическая раскладка (ТЗ §14).
 * Отдельный сервисный слой: детерминированный слоистый (rank-based) layout.
 * Ручные координаты пользователя считаются его данными и не перезаписываются
 * без явного действия — режим SYNC сохраняет существующие позиции (ТЗ §13).
 */

const DEFAULT_COL_GAP = 340;
const DEFAULT_ROW_GAP = 170;

/**
 * Слоистая раскладка: узлы распределяются по рангам (длина самого длинного пути
 * от источников), внутри ранга — по вертикали. Циклы безопасно игнорируются.
 * @param {Array<{id:string, size?:{width:number,height:number}}>} nodes
 * @param {Array<{source:string,target:string}>} edges
 * @returns {Record<string,{x:number,y:number}>}
 */
export function layeredLayout(nodes, edges, options = {}) {
  const colGap = options.colGap || DEFAULT_COL_GAP;
  const rowGap = options.rowGap || DEFAULT_ROW_GAP;
  const marginX = options.marginX ?? 80;
  const marginY = options.marginY ?? 80;

  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const outgoing = new Map(ids.map((id) => [id, []]));
  const indegree = new Map(ids.map((id) => [id, 0]));

  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    outgoing.get(edge.source).push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target) + 1);
  }

  // Ранг = самый длинный путь от источника (алгоритм Кана).
  const rank = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const seen = new Set(queue);
  const remaining = new Map(indegree);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of outgoing.get(current) || []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(current) ?? 0) + 1));
      remaining.set(next, (remaining.get(next) ?? 1) - 1);
      if (remaining.get(next) === 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  // Узлы, не попавшие в топологический обход (циклы), ставим следующим рангом.
  const maxRank = Math.max(0, ...Array.from(rank.values()));
  for (const id of ids) {
    if (!seen.has(id)) rank.set(id, maxRank + 1);
  }

  // Группируем по рангу и внутри ранга — по родителю, чтобы границы шли блоками.
  const byRank = new Map();
  for (const node of nodes) {
    const r = rank.get(node.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(node);
  }

  const positions = {}
  for (const group of byRank.values()) {
    let cursorY = marginY
    for (const node of group) {
      const height = node.size?.height ?? 100
      positions[node.id] = { x: marginX, y: cursorY }
      cursorY += height + 30
    }
  }

  // Уточняем межколоночный сдвиг с учётом фактических ширин.
  const rankWidth = new Map();
  for (const node of nodes) {
    const r = rank.get(node.id) ?? 0;
    const width = node.size?.width ?? 240;
    rankWidth.set(r, Math.max(rankWidth.get(r) ?? 0, width));
  }
  const rankOffset = new Map();
  let running = marginX;
  for (const r of Array.from(rankWidth.keys()).sort((a, b) => a - b)) {
    rankOffset.set(r, running);
    running += (rankWidth.get(r) ?? 240) + (colGap - 240);
  }
  for (const node of nodes) {
    const r = rank.get(node.id) ?? 0;
    positions[node.id].x = rankOffset.get(r) ?? marginX;
  }

  return positions;
}

/** Раскладка «сеткой» — используется для Deployment-схем и фрагментов. */
export function gridLayout(nodes, options = {}) {
  const columns = options.columns || 4;
  const colGap = options.colGap || 300;
  const rowGap = options.rowGap || 160;
  const positions = {};
  nodes.forEach((node, index) => {
    positions[node.id] = {
      x: 80 + (index % columns) * colGap,
      y: 80 + Math.floor(index / columns) * rowGap,
    };
  });
  return positions;
}
