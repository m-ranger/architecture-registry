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

// ---------------------------------------------------------------------------
// Узлы размещения и их состав (ТЗ §10.3)
//
// Узел размещения (DeploymentNode: server / cluster) — контейнер: внутри его
// рамки находятся экземпляры модулей (DeploymentInstance). Поэтому «узел
// расширяется» и «экземпляр лежит внутри узла» — одно правило: рамка узла
// считается по составу, а состав притягивается внутрь рамки.
// Те же правила и константы повторены на клиенте (src/layout/layoutService.ts),
// чтобы canvas, раскладка и экспорт не расходились (ТЗ §3, §14).
// ---------------------------------------------------------------------------

export const CONTAINER_PADDING = 16;
export const CONTAINER_HEADER = 84;
export const CONTAINER_GAP = 12;
export const CONTAINER_MIN_WIDTH = 270;
export const CONTAINER_MIN_HEIGHT = 120;
const CONTAINER_MAX_COLUMNS = 3;

/** Границы контуров: System Boundary / Environment Boundary. */
export const isBoundaryType = (c4Type) =>
  c4Type === 'SystemBoundary' || c4Type === 'EnvironmentBoundary';

/** Узел размещения — контейнер экземпляров модулей (ТЗ §6, §10.3). */
export const isContainerNode = (node) => Boolean(node) && node.c4Type === 'DeploymentNode';

/** Размер узла: узел размещения — по рамке, экземпляр — типовой C4-карточкой. */
const nodeSize = (node) => ({
  width: Number(node.size?.width) || (isContainerNode(node) ? CONTAINER_MIN_WIDTH : 230),
  height: Number(node.size?.height) || (isContainerNode(node) ? CONTAINER_MIN_HEIGHT : 88),
});

/** Экземпляры, размещённые на узле (прямые дети-экземпляры). */
export function containerChildren(container, nodes) {
  return nodes.filter(
    (node) => node.parent === container.id && node.c4Type === 'DeploymentInstance',
  );
}

/**
 * Сетка экземпляров внутри рамки узла: короткий состав — одна колонка
 * («стойка»), длинный — до трёх, чтобы узел не вытягивался в бесконечную полосу.
 * @returns {{placements:Array<{id:string,x:number,y:number}>,width:number,height:number,rows:number,columns:number}}
 */
export function packContainerChildren(children) {
  // Узел без состава имеет типовой размер C4-карточки: рамка растёт только под экземпляры.
  if (children.length === 0) {
    return {
      placements: [],
      rows: 0,
      columns: 0,
      width: CONTAINER_MIN_WIDTH,
      height: CONTAINER_MIN_HEIGHT,
    };
  }
  const sizes = children.map(nodeSize);
  const columns = children.length <= 3 ? 1 : children.length <= 8 ? 2 : CONTAINER_MAX_COLUMNS;
  const columnWidth = Math.max(230, ...sizes.map((size) => size.width));
  const rowHeight = Math.max(88, ...sizes.map((size) => size.height));
  const rows = Math.max(1, Math.ceil(children.length / columns));
  const placements = children.map((child, index) => ({
    id: child.id,
    x: CONTAINER_PADDING + (index % columns) * (columnWidth + CONTAINER_GAP),
    y:
      CONTAINER_HEADER +
      CONTAINER_PADDING +
      Math.floor(index / columns) * (rowHeight + CONTAINER_GAP),
  }));
  return {
    placements,
    rows,
    columns,
    width: Math.max(
      CONTAINER_MIN_WIDTH,
      CONTAINER_PADDING * 2 + columns * columnWidth + (columns - 1) * CONTAINER_GAP,
    ),
    height: Math.max(
      CONTAINER_MIN_HEIGHT,
      CONTAINER_HEADER + CONTAINER_PADDING * 2 + rows * rowHeight + (rows - 1) * CONTAINER_GAP,
    ),
  };
}

/**
 * Рамка узла размещения: растягивается под состав экземпляров.
 * Позиция узла — ручная координата пользователя (ТЗ §14), поэтому рамка растёт
 * вправо и вниз, а состав притягивается внутрь за «шапку» и левую границу.
 */
export function containerFrame(container, children) {
  let width = Math.max(CONTAINER_MIN_WIDTH, nodeSize(container).width);
  let height = Math.max(CONTAINER_MIN_HEIGHT, nodeSize(container).height);
  for (const child of children) {
    const size = nodeSize(child);
    width = Math.max(width, child.position.x + size.width + CONTAINER_PADDING - container.position.x);
    height = Math.max(
      height,
      child.position.y + size.height + CONTAINER_PADDING - container.position.y,
    );
  }
  return { x: container.position.x, y: container.position.y, width, height };
}


/**
 * Приведение состава узлов размещения к инварианту схемы (ТЗ §10.3):
 * экземпляры находятся внутри рамки своего узла, а рамка растянута под состав.
 * Функция идемпотентна: на согласованной схеме координаты не меняются.
 * Возвращает новый массив узлов (входные объекты не изменяются).
 */
export function normalizeContainers(nodes) {
  if (!nodes.some(isContainerNode)) return nodes;

  const result = nodes.map((node) => ({
    ...node,
    position: { x: node.position.x, y: node.position.y },
    size: { ...nodeSize(node) },
  }));

  for (const container of result.filter(isContainerNode)) {
    const children = containerChildren(container, result);
    for (const child of children) {
      // Экземпляр не входит в «шапку» узла и не выходит за его левую границу.
      child.position.x = Math.max(child.position.x, container.position.x + CONTAINER_PADDING);
      child.position.y = Math.max(child.position.y, container.position.y + CONTAINER_HEADER);
    }
    const frame = containerFrame(container, children);
    container.size = { width: frame.width, height: frame.height };
  }
  return result;
}

/**
 * Раскладка схемы развертывания: контуры сред → узлы размещения → экземпляры.
 * Экземпляры укладываются внутрь своего узла, рамка узла растягивается под
 * состав; контуры сред (EnvironmentBoundary) считаются по составу на canvas и
 * в экспорте (ТЗ §10.3, §14).
 * @param {Array} nodes узлы графа (позиции и размеры возвращаются отдельно)
 * @returns {{positions:Record<string,{x:number,y:number}>,sizes:Record<string,{width:number,height:number}>}}
 */
export function deploymentLayout(nodes, options = {}) {
  const marginX = options.marginX ?? 80;
  const marginY = options.marginY ?? 80;
  const nodeGap = options.nodeGap ?? 90;
  const groupGap = options.groupGap ?? 90;
  const maxPerRow = options.maxPerRow ?? 3;

  const positions = {};
  const sizes = {};

  // Узел размещения всегда принадлежит контуру среды: контур задаёт полосу
  // раскладки, поэтому узлы группируются по своему родителю.
  const groups = new Map();
  for (const container of nodes.filter(isContainerNode)) {
    const key = container.parent || '__root__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(container);
  }

  let cursorY = marginY;
  for (const group of groups.values()) {
    let cursorX = marginX;
    let rowY = cursorY;
    let rowHeight = 0;
    let placed = 0;
    for (const container of group) {
      const packed = packContainerChildren(containerChildren(container, nodes));
      positions[container.id] = { x: cursorX, y: rowY };
      sizes[container.id] = { width: packed.width, height: packed.height };
      for (const placement of packed.placements) {
        positions[placement.id] = { x: cursorX + placement.x, y: rowY + placement.y };
      }
      rowHeight = Math.max(rowHeight, packed.height);
      cursorX += packed.width + nodeGap;
      placed += 1;
      if (placed % maxPerRow === 0) {
        rowY += rowHeight + groupGap;
        rowHeight = 0;
        cursorX = marginX;
      }
    }
    cursorY = rowY + rowHeight + groupGap;
  }

  // Элементы вне узлов размещения (аннотации, свободные экземпляры) — ниже полос сред.
  let orphanY = cursorY;
  for (const node of nodes) {
    if (isBoundaryType(node.c4Type) || positions[node.id]) continue;
    positions[node.id] = { x: marginX, y: orphanY };
    orphanY += nodeSize(node).height + 30;
  }

  return { positions, sizes };
}

