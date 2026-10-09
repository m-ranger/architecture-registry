/**
 * Экспорт схемы (ТЗ §15).
 * Все форматы строятся из единой внутренней графовой модели,
 * чтобы canvas и экспорт не расходились (ТЗ §3, §15).
 */

export const EXPORT_FORMATS = ['svg', 'plantuml', 'mermaid', 'json'];

const VARIANT_STYLE = {
  primary: { fill: '#e8efff', stroke: '#2f6bff', text: '#12234a', tag: '#2f6bff' },
  application: { fill: '#ffffff', stroke: '#c7d3e8', text: '#1f2a37', tag: '#64748b' },
  external: { fill: '#f8fafc', stroke: '#94a3b8', text: '#334155', tag: '#64748b' },
  infrastructure: { fill: '#fff7ed', stroke: '#f59e0b', text: '#7c3f04', tag: '#b45309' },
  boundary: { fill: 'none', stroke: '#94a3b8', text: '#475569', tag: '#64748b' },
};

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isBoundary = (c4Type) => c4Type === 'SystemBoundary' || c4Type === 'EnvironmentBoundary';

/** Узел размещения — контейнер для экземпляров модулей (ТЗ §10.3). */
const isContainer = (c4Type) => c4Type === 'DeploymentNode';

/** Отступ состава от рамки узла и высота «шапки» узла — как на canvas. */
const CONTAINER_PADDING = 16;
const CONTAINER_HEADER = 84;

const sanitizeKey = (value) => String(value ?? '').replace(/[^A-Za-z0-9_]/g, '_');

/** Обрезка длинного текста под ширину карточки. */
const clip = (value, max) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * Сетевые адреса узла размещения (ТЗ §10.3) — строка для подписи в экспорте.
 * Узел размещения описывает адреса развертывания: у кластера — набор адресов,
 * у сервера — интерфейсы. Без маски подсети, роль адреса указывается рядом.
 */
const nodeAddresses = (node) => {
  const list = Array.isArray(node.style?.addresses) ? node.style.addresses : [];
  return list
    .slice(0, 3)
    .map((item) => {
      const ip = String(item.ip_address || item.ipAddress || '').replace(/\/\d+$/, '');
      const role = item.address_role || item.addressRole;
      return role ? `${ip} (${role})` : ip;
    })
    .filter(Boolean)
    .join(', ');
};

/** Рекурсивный bbox узла с учётом вложенных детей (границы контуров). */
function nodeBbox(nodeId, byId, childrenOf, cache) {
  if (cache.has(nodeId)) return cache.get(nodeId);
  const node = byId.get(nodeId);
  if (!node) return null;

  const children = childrenOf.get(nodeId) || [];
  let box = {
    x: node.position.x,
    y: node.position.y,
    w: node.size.width,
    h: node.size.height,
  };

  // Границы контуров описываются только составом вложенных элементов (ТЗ §10.3).
  const childrenOnly = isBoundary(node.c4Type) && children.length > 0;
  if (childrenOnly) box = null;

  for (const child of children) {
    const childBox = nodeBbox(child.id, byId, childrenOf, cache);
    if (!childBox) continue;
    if (!box) {
      box = { ...childBox };
      continue;
    }
    const x1 = Math.min(box.x, childBox.x);
    const y1 = Math.min(box.y, childBox.y);
    const x2 = Math.max(box.x + box.w, childBox.x + childBox.w);
    const y2 = Math.max(box.y + box.h, childBox.y + childBox.h);
    box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  if (!box) return null;
  cache.set(nodeId, box);
  return box;
}

/** Карта прямоугольников: для границ — bbox детей, для остальных — собственная рамка. */
function buildBoxes(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
    childrenOf.get(node.parent).push(node);
  }

  const cache = new Map();
  const boxes = new Map();
  for (const node of nodes) {
    const box = nodeBbox(node.id, byId, childrenOf, cache);
    if (!box) continue;
    if (isBoundary(node.c4Type)) {
      const padding = 26;
      boxes.set(node.id, {
        x: box.x - padding,
        y: box.y - padding,
        w: box.w + padding * 2,
        h: box.h + padding * 2,
      });
      continue;
    }
    if (isContainer(node.c4Type)) {
      // Рамка узла размещения растягивается под состав экземпляров: позиция узла
      // не смещается, рамка растёт вправо и вниз (ТЗ §10.3).
      let w = Math.max(Number(node.size?.width) || 0, CONTAINER_PADDING * 2 + 230);
      let h = Math.max(Number(node.size?.height) || 0, CONTAINER_HEADER);
      for (const child of childrenOf.get(node.id) || []) {
        const childBox = nodeBbox(child.id, byId, childrenOf, cache);
        if (!childBox) continue;
        w = Math.max(w, childBox.x + childBox.w + CONTAINER_PADDING - node.position.x);
        h = Math.max(h, childBox.y + childBox.h + CONTAINER_PADDING - node.position.y);
      }
      boxes.set(node.id, { x: node.position.x, y: node.position.y, w, h });
      continue;
    }
    boxes.set(node.id, box);
  }
  return boxes;
}

/** Ортогональный маршрут связи: выход справа, вход слева. */
function edgeRoute(boxes, edge) {
  const source = boxes.get(edge.source);
  const target = boxes.get(edge.target);
  if (!source || !target) return null;

  const sx = source.x + source.w;
  const sy = source.y + source.h / 2;
  const tx = target.x;
  const ty = target.y + target.h / 2;
  const midX = tx > sx + 40 ? (sx + tx) / 2 : Math.max(sx, tx + target.w) + 40;
  const points = [
    [sx, sy],
    [midX, sy],
    [midX, ty],
    [tx, ty],
  ];
  return { points, labelX: midX, labelY: (sy + ty) / 2 };
}

/** SVG-рендер из внутренней модели (P0, ТЗ §15). */
export function exportSvg(graph, meta = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const boxes = buildBoxes(nodes);

  let minX = 0;
  let minY = 0;
  let maxX = 800;
  let maxY = 600;
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }

  const pad = 48;
  const headerH = 52;
  const width = Math.ceil(maxX - minX + pad * 2);
  const height = Math.ceil(maxY - minY + pad * 2 + headerH);
  const title = meta.name || 'Архитектурная схема';
  const subtitle = [meta.diagramType, meta.code].filter(Boolean).join(' · ');

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="${minX - pad} ${minY - pad - headerH} ${width} ${height}" ` +
      `font-family="Inter, Segoe UI, Arial, sans-serif">`,
  );
  parts.push(
    '<defs><marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>',
  );
  parts.push(
    `<rect x="${minX - pad}" y="${minY - pad - headerH}" width="${width}" height="${height}" fill="#ffffff"/>`,
  );
  parts.push(
    `<text x="${minX}" y="${minY - pad - headerH + 30}" font-size="18" font-weight="600" fill="#1f2a37">${escapeXml(title)}</text>`,
  );
  if (subtitle) {
    parts.push(
      `<text x="${minX}" y="${minY - pad - headerH + 48}" font-size="11" fill="#64748b">${escapeXml(subtitle)}</text>`,
    );
  }

  // 1. Границы контуров (первым слоем, чтобы были под узлами).
  for (const node of nodes) {
    if (!isBoundary(node.c4Type)) continue;
    const box = boxes.get(node.id);
    if (!box) continue;
    parts.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="14" ` +
        'fill="rgba(148,163,184,0.07)" stroke="#94a3b8" stroke-dasharray="6 6"/>',
    );
    parts.push(
      `<text x="${box.x + 14}" y="${box.y + 20}" font-size="10" font-weight="600" ` +
        `fill="#475569" letter-spacing="0.08em">${escapeXml(String(node.name).toUpperCase())}</text>`,
    );
  }

  // 2. Связи.
  for (const edge of edges) {
    const route = edgeRoute(boxes, edge);
    if (!route) continue;
    const d = route.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    parts.push(
      `<path d="${d}" fill="none" stroke="#64748b" stroke-width="1.4" marker-end="url(#arch-arrow)"/>`,
    );
    if (edge.label) {
      // Подпись связи схемы развертывания — адреса «откуда → куда», поэтому
      // обрезка мягче, чем для имени потока (ТЗ §10.3).
      parts.push(
        `<text x="${route.labelX}" y="${route.labelY - 6}" text-anchor="middle" font-size="11" ` +
          `fill="#334155">${escapeXml(clip(edge.label, 42))}</text>`,
      );
    }
    if (edge.technology) {
      parts.push(
        `<text x="${route.labelX}" y="${route.labelY + 10}" text-anchor="middle" font-size="10" ` +
          `fill="#64748b" font-family="monospace">${escapeXml(clip(edge.technology, 28))}</text>`,
      );
    }
  }

  // 3. Узлы: узлы размещения рисуются первыми, их состав — экземпляры — поверх
  // рамки узла (ТЗ §10.3). Порядок задаёт глубина вложенности.
  const childrenOf = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
    childrenOf.get(node.parent).push(node);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node) => {
    let depth = 0;
    let current = node.parent ? byId.get(node.parent) : null;
    while (current && depth < 100) {
      depth += 1;
      current = current.parent ? byId.get(current.parent) : null;
    }
    return depth;
  };
  const drawableNodes = nodes
    .filter((node) => !isBoundary(node.c4Type))
    .sort((a, b) => depthOf(a) - depthOf(b));

  for (const node of drawableNodes) {
    const box = boxes.get(node.id);
    if (!box) continue;
    const style = VARIANT_STYLE[node.style?.variant] || VARIANT_STYLE.application;
    const container = isContainer(node.c4Type);
    const childCount = container ? (childrenOf.get(node.id) || []).length : 0;
    parts.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="12" ` +
        `fill="${container ? 'rgba(245,158,11,0.08)' : style.fill}" stroke="${style.stroke}" ` +
        `stroke-width="${container ? 1.6 : 1.2}"/>`,
    );
    if (container) {
      // «Шапка» узла размещения непрозрачна, чтобы подписи читались, а тело узла
      // остаётся полупрозрачным: связи между экземплярами внутри узла видны.
      parts.push(
        `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${CONTAINER_HEADER}" rx="12" ` +
          'fill="#fff7ed" fill-opacity="0.85"/>',
      );
      parts.push(
        `<path d="M ${box.x} ${box.y + CONTAINER_HEADER} L ${box.x + box.w} ` +
          `${box.y + CONTAINER_HEADER}" stroke="${style.stroke}" stroke-width="1"/>`,
      );
    }
    parts.push(
      `<text x="${box.x + 16}" y="${box.y + (container ? 28 : 30)}" font-size="14" font-weight="600" ` +
        `fill="${style.text}">${escapeXml(clip(node.name, container ? 34 : 26))}</text>`,
    );
    if (node.technology) {
      parts.push(
        `<text x="${box.x + 16}" y="${box.y + (container ? 46 : 50)}" font-size="11" ` +
          `fill="${style.tag}" font-family="monospace">` +
          `${escapeXml(clip(node.technology, 40))}</text>`,
      );
    }
    // Адреса развертывания — отдельной строкой (ТЗ §10.3): из схемы должно быть
    // видно, на каком адресе размещен экземпляр. Карточка узла — 270px, поэтому
    // строка адресов обрезается мягче, чем имя.
    const addresses = nodeAddresses(node);
    if (addresses && (container || box.h >= 100)) {
      parts.push(
        `<text x="${box.x + 16}" y="${box.y + (container ? 62 : 68)}" font-size="10" fill="#0f766e" ` +
          `font-family="monospace">${escapeXml(clip(addresses, 48))}</text>`,
      );
    }
    if (container) {
      // Состав узла размещения: сколько экземпляров модулей лежит внутри рамки.
      parts.push(
        `<text x="${box.x + 16}" y="${box.y + 78}" font-size="10" fill="#b45309">` +
          `${escapeXml(`экземпляров: ${childCount}`)}</text>`,
      );
      if (node.style?.code) {
        parts.push(
          `<text x="${box.x + box.w - 16}" y="${box.y + 78}" text-anchor="end" font-size="10" ` +
            `fill="${style.tag}">${escapeXml(node.style.code)}</text>`,
        );
      }
      continue;
    }
    if (node.style?.code) {
      parts.push(
        `<text x="${box.x + 16}" y="${box.y + box.h - 12}" font-size="10" fill="${style.tag}">` +
          `${escapeXml(node.style.code)}</text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

const escPuml = (value) => String(value ?? '').replace(/"/g, "'").replace(/\r?\n/g, ' ');

/** PlantUML / C4-PlantUML (P1, ТЗ §15, Приложение В). */
export function exportPlantUml(graph, meta = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const type = String(meta.diagramType || 'CONTAINER').toUpperCase();
  const include =
    type === 'DEPLOYMENT' ? 'C4_Deployment' : type === 'SYSTEM_CONTEXT' ? 'C4_Context' : 'C4_Container';

  const childrenOf = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
    childrenOf.get(node.parent).push(node);
  }
  const ids = new Set(nodes.map((n) => n.id));

  const lines = [];
  lines.push('@startuml');
  lines.push(
    `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/${include}.puml`,
  );
  if (type === 'DEPLOYMENT') {
    lines.push(
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml',
    );
  }
  lines.push('');
  lines.push(`title ${meta.name || 'Архитектурная схема'}`);
  lines.push('');

  const emit = (node, depth) => {
    const indent = '  '.repeat(depth);
    const key = sanitizeKey(node.id);
    const name = escPuml(node.name);
    // Адреса развертывания идут в описание узла: схема развертывания отвечает
    // на вопрос «с какого адреса на какой выполняется поток» (ТЗ §10.3).
    const addresses = nodeAddresses(node);
    const desc = escPuml([node.description, addresses].filter(Boolean).join(' · '));
    const tech = escPuml(node.technology || '');
    let head;
    let block = false;

    switch (node.c4Type) {
      case 'SystemBoundary':
        head = `${indent}System_Boundary(${key}, "${name}") {`;
        block = true;
        break;
      case 'EnvironmentBoundary':
        head = `${indent}Deployment_Node(${key}, "${name}") {`;
        block = true;
        break;
      case 'DeploymentNode':
        head = `${indent}Deployment_Node(${key}, "${name}", "${tech}", "${desc}") {`;
        block = true;
        break;
      case 'Container':
      case 'DeploymentInstance':
        head = `${indent}Container(${key}, "${name}", "${tech}", "${desc}")`;
        break;
      case 'SoftwareSystem':
        head =
          node.style?.variant === 'external'
            ? `${indent}System_Ext(${key}, "${name}", "${desc}")`
            : `${indent}System(${key}, "${name}", "${desc}")`;
        break;
      default:
        head = `${indent}System(${key}, "${name}", "${desc}")`;
    }

    lines.push(head);
    for (const child of childrenOf.get(node.id) || []) {
      emit(child, block ? depth + 1 : depth);
    }
    if (block) lines.push(`${indent}}`);
  };

  for (const root of nodes.filter((n) => !n.parent)) emit(root, 0);

  lines.push('');
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    lines.push(
      `Rel(${sanitizeKey(edge.source)}, ${sanitizeKey(edge.target)}, ` +
        `"${escPuml(edge.label || '')}", "${escPuml(edge.technology || '')}")`,
    );
  }
  lines.push('@enduml');
  return lines.join('\n');
}

const escMermaid = (value) =>
  String(value ?? '')
    .replace(/"/g, '#quot;')
    .replace(/\[/g, '#91;')
    .replace(/\]/g, '#93;')
    .replace(/\r?\n/g, ' ');

const mermaidId = (id) => `n_${sanitizeKey(id)}`;

/** Mermaid flowchart (P2, ТЗ §15). */
export function exportMermaid(graph, meta = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const ids = new Set(nodes.map((n) => n.id));

  const childrenOf = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
    childrenOf.get(node.parent).push(node);
  }

  const lines = ['flowchart LR'];
  lines.push(`%% ${meta.name || 'Архитектурная схема'}${meta.diagramType ? ` (${meta.diagramType})` : ''}`);

  const emit = (node, depth) => {
    const indent = '  '.repeat(depth);
    const key = mermaidId(node.id);
    const label = escMermaid(node.name);
    const children = childrenOf.get(node.id) || [];
    // Узел размещения с составом — блок: экземпляры модулей лежат внутри узла (ТЗ §10.3).
    const container = isContainer(node.c4Type) && children.length > 0;
    if (isBoundary(node.c4Type) || container) {
      const meta = container
        ? `<br/>${escMermaid(
            [node.technology, `экземпляров: ${children.length}`].filter(Boolean).join(' · '),
          )}`
        : '';
      lines.push(`${indent}subgraph ${key}["${label}${meta}"]`);
      for (const child of children) emit(child, depth + 1);
      lines.push(`${indent}end`);
      return;
    }
    const tech = node.technology ? `<br/>${escMermaid(node.technology)}` : '';
    const addresses = nodeAddresses(node);
    const addr = addresses ? `<br/>${escMermaid(addresses)}` : '';
    lines.push(`${indent}${key}["${label}${tech}${addr}"]`);
    for (const child of children) emit(child, depth);
  };

  for (const root of nodes.filter((n) => !n.parent)) emit(root, 1);

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    const label = [edge.label, edge.technology].filter(Boolean).join('<br/>');
    const arrow = label ? `-->|"${escMermaid(label)}"|` : '-->';
    lines.push(`  ${mermaidId(edge.source)} ${arrow} ${mermaidId(edge.target)}`);
  }

  return lines.join('\n');
}

/** JSON-снапшот внутренней графовой модели (ТЗ §8). */
export function exportJson(graph, meta = {}) {
  return JSON.stringify(
    {
      schemaVersion: graph.schemaVersion || '1.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        id: meta.id || null,
        code: meta.code || null,
        name: meta.name || null,
        type: meta.diagramType || null,
        version: meta.version ?? null,
        status: meta.status || null,
      },
      nodes: graph.nodes || [],
      edges: graph.edges || [],
    },
    null,
    2,
  );
}

/** Единая точка экспорта (ТЗ §15): renderer не влияет на исходную схему. */
export function exportDiagram(format, graph, meta = {}) {
  switch (String(format || 'json').toLowerCase()) {
    case 'svg':
      return {
        contentType: 'image/svg+xml; charset=utf-8',
        extension: 'svg',
        body: exportSvg(graph, meta),
      };
    case 'plantuml':
    case 'puml':
      return {
        contentType: 'text/plain; charset=utf-8',
        extension: 'puml',
        body: exportPlantUml(graph, meta),
      };
    case 'mermaid':
    case 'mmd':
      return {
        contentType: 'text/plain; charset=utf-8',
        extension: 'mmd',
        body: exportMermaid(graph, meta),
      };
    case 'json':
      return {
        contentType: 'application/json; charset=utf-8',
        extension: 'json',
        body: exportJson(graph, meta),
      };
    default:
      throw Object.assign(new Error(`Unsupported export format: ${format}`), { status: 400 });
  }
}



