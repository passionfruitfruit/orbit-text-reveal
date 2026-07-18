import {
  createPlatformEntry,
  duplicatePlatform,
  movePlatform,
  normalizePlatformConfig,
  removePlatform,
  serializePlatformConfig
} from './platform-config.js?v=20260718-3';
import { renderPlatformCards } from './platform-renderer.js?v=20260718-3';

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function validation(entry) {
  if (!entry || typeof entry !== 'object') return '平台数据必须是对象。';
  if (!String(entry.title ?? '').trim()) return '请输入平台名称。';
  if (!String(entry.description ?? '').trim()) return '请输入平台简介。';
  if (!String(entry.icon ?? '').trim()) return '请输入图标路径或图片 URL。';
  if (!['left', 'right'].includes(entry.iconSide)) return '图标位置只能是 left 或 right。';
  if (!['link', 'copy'].includes(entry.action?.type)) return '动作类型只能是 link 或 copy。';
  if (!String(entry.action?.value ?? '').trim()) return '请输入链接地址或复制内容。';
  return '';
}

function setValue(control, value) {
  if (control.type === 'checkbox') control.checked = Boolean(value);
  else control.value = value ?? '';
}

function nearest(target, selector) {
  if (target?.closest) {
    const found = target.closest(selector);
    if (found) return found;
  }
  let current = target;
  while (current) {
    if (selector === '[data-platform-field]' && current.dataset?.platformField) return current;
    if (selector === '[data-platform-item]' && current.dataset?.platformItem !== undefined) return current;
    if (selector === '[data-action]' && current.dataset?.action) return current;
    current = current.parentNode;
  }
  return null;
}

export function startPlatformDeveloperEditor({
  documentRef = globalThis.document,
  container,
  platformData = [],
  renderCards = renderPlatformCards,
  clipboard,
  clipboardWriteText = (text) => {
    const writer = clipboard?.writeText ?? globalThis.navigator?.clipboard?.writeText;
    if (!writer) return Promise.reject(new Error('Clipboard API unavailable'));
    return writer.call(clipboard ?? globalThis.navigator.clipboard, text);
  },
  BlobCtor = globalThis.Blob,
  Blob: BlobAlias,
  URLRef,
  createObjectURL = (blob) => (URLRef ?? globalThis.URL).createObjectURL(blob),
  revokeObjectURL = (url) => (URLRef ?? globalThis.URL).revokeObjectURL(url),
  triggerDownload = (link) => link.click(),
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  timers
} = {}) {
  if (!documentRef || !container) return { getDraft: () => [], destroy() {} };
  BlobCtor = BlobAlias ?? BlobCtor;
  setTimeoutFn = timers?.setTimeout ?? setTimeoutFn;
  clearTimeoutFn = timers?.clearTimeout ?? clearTimeoutFn;
  let entries = clone(Array.isArray(platformData) ? platformData : []);
  let debounceTimer = null;
  const ownedTimers = new Set();
  let previewView = null;
  let destroyed = false;

  const section = documentRef.createElement('section');
  section.className = 'editor-section platform-editor-section';
  section.dataset.platformEditor = '';
  const heading = documentRef.createElement('div');
  heading.className = 'section-heading';
  const title = documentRef.createElement('h3');
  title.id = 'platform-editor-title';
  title.textContent = '平台入口';
  const add = documentRef.createElement('button');
  add.type = 'button'; add.dataset.action = 'add-platform'; add.textContent = '添加平台';
  heading.append(title, add);
  const list = documentRef.createElement('div');
  list.className = 'platform-editor-list'; list.dataset.platformList = '';
  const previewArea = documentRef.createElement('div');
  previewArea.className = 'platform-preview-area';
  const previewTitle = documentRef.createElement('h4');
  previewTitle.className = 'preview-subtitle'; previewTitle.textContent = '实时预览';
  const previewGrid = documentRef.createElement('div');
  previewGrid.className = 'platform-preview-grid'; previewGrid.dataset.platformPreview = '';
  previewArea.append(previewTitle, previewGrid);
  const actions = documentRef.createElement('div');
  actions.className = 'action-grid platform-editor-actions';
  const copy = documentRef.createElement('button');
  copy.type = 'button'; copy.dataset.action = 'copy-platform-config'; copy.textContent = '复制平台配置';
  const download = documentRef.createElement('button');
  download.type = 'button'; download.dataset.action = 'download-platform-config'; download.textContent = '下载平台配置';
  actions.append(copy, download);
  const status = documentRef.createElement('p');
  status.className = 'io-status'; status.dataset.platformIoStatus = ''; status.setAttribute('role', 'status');
  section.append(heading, list, previewArea, actions, status);
  container.append(section);

  function validEntries() { return normalizePlatformConfig(entries.filter((entry) => !validation(entry))); }
  function updatePreview() {
    if (destroyed) return;
    const normalized = validEntries();
    if (previewView?.destroy) previewView.destroy();
    previewView = renderCards(previewGrid, normalized, { clipboard, setTimeout: setTimeoutFn, clearTimeout: clearTimeoutFn });
  }
  function schedulePreview() {
    if (debounceTimer !== null) clearTimeoutFn(debounceTimer);
    debounceTimer = setTimeoutFn(() => { debounceTimer = null; updatePreview(); }, 120);
  }
  function field(labelText, field, value, type = 'text') {
    const label = documentRef.createElement('label'); label.textContent = labelText;
    const control = documentRef.createElement(type === 'select' ? 'select' : 'input');
    control.dataset.platformField = field;
    if (type !== 'select') control.type = type;
    if (type === 'select') {
      const options = field === 'action.type' ? [['link', '打开链接'], ['copy', '复制内容']] : [['left', '左侧'], ['right', '右侧']];
      for (const [v, text] of options) { const option = documentRef.createElement('option'); option.value = v; option.textContent = text; control.append(option); }
    }
    setValue(control, value); label.append(control); return label;
  }
  function renderList() {
    list.textContent = '';
    entries.forEach((entry, index) => {
      const article = documentRef.createElement('article'); article.className = 'platform-editor-card'; article.dataset.platformItem = String(index);
      const head = documentRef.createElement('div'); head.className = 'platform-card-header';
      const number = documentRef.createElement('strong'); number.textContent = `平台 ${index + 1}`;
      const toolbar = documentRef.createElement('div'); toolbar.className = 'platform-card-actions';
      for (const [action, text] of [['move-up', '上移'], ['move-down', '下移'], ['duplicate-platform', '复制'], ['delete-platform', '删除']]) {
        const button = documentRef.createElement('button'); button.type = 'button'; button.dataset.action = action; button.dataset.index = String(index); button.textContent = text;
        if ((action === 'move-up' && index === 0) || (action === 'move-down' && index === entries.length - 1)) button.disabled = true;
        toolbar.append(button);
      }
      head.append(number, toolbar); article.append(head);
      const grid = documentRef.createElement('div'); grid.className = 'platform-field-grid';
      grid.append(field('名称', 'title', entry.title), field('简介', 'description', entry.description), field('图标路径', 'icon', entry.icon), field('图标位置', 'iconSide', entry.iconSide, 'select'));
      grid.append(field('动作类型', 'action.type', entry.action?.type, 'select'));
      grid.append(field('链接或复制内容', 'action.value', entry.action?.value));
      const newTab = field('链接在新标签页打开', 'action.newTab', entry.action?.newTab, 'checkbox'); newTab.className = 'check-field'; grid.append(newTab);
      article.append(grid);
      const error = documentRef.createElement('p'); error.className = 'validation-message'; error.dataset.platformError = ''; error.textContent = validation(entry); article.classList.toggle('is-invalid', Boolean(error.textContent)); article.append(error);
      list.append(article);
    });
  }
  function setNested(entry, path, value) { const next = clone(entry); if (path === 'action.type' || path === 'action.value' || path === 'action.newTab') next.action = { ...(next.action ?? {}), [path.slice(7)]: value }; else next[path] = value; return next; }
  function handleInput(event) {
    const control = nearest(event.target, '[data-platform-field]'); const item = nearest(event.target, '[data-platform-item]');
    if (!control || !item) return;
    const index = Number(item.dataset.platformItem); const value = control.type === 'checkbox' ? control.checked : control.value;
    entries[index] = setNested(entries[index], control.dataset.platformField, value);
    const message = item.querySelector?.('[data-platform-error]'); const error = validation(entries[index]);
    item.classList.toggle('is-invalid', Boolean(error)); if (message) message.textContent = error;
    schedulePreview();
  }
  async function handleClick(event) {
    const button = nearest(event.target, '[data-action]'); const action = button?.dataset?.action; if (!action || destroyed) return;
    const index = Number(button.dataset.index);
    if (action === 'add-platform') { entries = [...entries, createPlatformEntry()]; renderList(); updatePreview(); }
    else if (action === 'delete-platform') { entries = removePlatform(entries, index); renderList(); updatePreview(); }
    else if (action === 'duplicate-platform') { entries = duplicatePlatform(entries, index); renderList(); updatePreview(); }
    else if (action === 'move-up') { entries = movePlatform(entries, index, -1); renderList(); updatePreview(); }
    else if (action === 'move-down') { entries = movePlatform(entries, index, 1); renderList(); updatePreview(); }
    else if (action === 'copy-platform-config') { try { await clipboardWriteText(serializePlatformConfig(validEntries())); status.textContent = '已复制平台配置。'; } catch { status.textContent = '无法复制平台配置。'; } }
    else if (action === 'download-platform-config') {
      const blob = new BlobCtor([serializePlatformConfig(validEntries())], { type: 'application/json;charset=utf-8' }); const url = createObjectURL(blob); const link = documentRef.createElement('a'); link.href = url; link.download = 'platform-config.json'; documentRef.body.append(link); triggerDownload(link); link.remove(); const timer = setTimeoutFn(() => { ownedTimers.delete(timer); revokeObjectURL(url); }, 0); ownedTimers.add(timer); status.textContent = '已生成 platform-config.json。';
    }
  }
  section.addEventListener('input', handleInput); section.addEventListener('change', handleInput); section.addEventListener('click', handleClick);
  renderList(); updatePreview();
  return { getDraft: () => clone(entries), destroy() { if (destroyed) return; destroyed = true; section.removeEventListener('input', handleInput); section.removeEventListener('change', handleInput); section.removeEventListener('click', handleClick); if (debounceTimer !== null) clearTimeoutFn(debounceTimer); for (const timer of ownedTimers) clearTimeoutFn(timer); ownedTimers.clear(); previewView?.destroy?.(); section.remove(); } };
}
