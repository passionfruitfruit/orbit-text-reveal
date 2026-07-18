const DEFAULT_ENTRY = Object.freeze({
  id: 'platform',
  title: '新平台',
  description: '平台介绍',
  icon: './assets/platforms/mail.svg',
  iconSide: 'left',
  action: Object.freeze({ type: 'link', value: 'https://example.com', newTab: true })
});

export function normalizePlatformConfig(value) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();
    const icon = String(item.icon ?? '').trim();
    const actionValue = String(item.action?.value ?? '').trim();
    if (!title || !description || !icon || !actionValue) return [];
    const baseId = String(item.id ?? title).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || `platform-${index + 1}`;
    let id = baseId;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    used.add(id);
    const type = item.action?.type === 'copy' ? 'copy' : 'link';
    return [{
      id,
      title,
      description,
      icon,
      iconSide: item.iconSide === 'right' ? 'right' : 'left',
      action: { type, value: actionValue, newTab: type === 'link' && item.action?.newTab !== false }
    }];
  });
}

export function createPlatformEntry(overrides = {}) {
  const merged = { ...DEFAULT_ENTRY, ...overrides };
  merged.action = { ...DEFAULT_ENTRY.action, ...(overrides.action ?? {}) };
  return normalizePlatformConfig([merged])[0];
}

export function duplicatePlatform(entries, index) {
  const source = entries[index];
  if (!source) return [...entries];
  const used = new Set(entries.map((e) => e.id));
  let id = source.id;
  for (let suffix = 2; used.has(id); suffix += 1) id = `${source.id}-${suffix}`;
  const copy = {
    ...source,
    id,
    action: { ...source.action }
  };
  const result = [...entries];
  result.splice(index + 1, 0, copy);
  return result;
}

export function movePlatform(entries, index, direction) {
  if (index < 0 || index >= entries.length) return [...entries];
  const target = index + direction;
  if (target < 0 || target >= entries.length) return [...entries];
  const result = [...entries];
  const [item] = result.splice(index, 1);
  result.splice(target, 0, item);
  return result;
}

export function removePlatform(entries, index) {
  return entries.filter((_, i) => i !== index);
}

export function serializePlatformConfig(entries) {
  return JSON.stringify(normalizePlatformConfig(entries), null, 2) + '\n';
}
