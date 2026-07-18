import { animationConfig } from '../config.js?v=20260711-5';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js?v=20260711-5';

export function cloneDraft(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function replaceTexts(draft, texts) {
  return { ...draft, texts: texts.map((item) => ({ ...item })) };
}

export function deleteText(draft, index) {
  if (draft.texts.length === 1) {
    return replaceTexts(draft, [{ text: '', holdMs: draft.texts[0].holdMs ?? 1800 }]);
  }
  return replaceTexts(draft, draft.texts.filter((_, itemIndex) => itemIndex !== index));
}

export function duplicateText(draft, index) {
  const texts = draft.texts.map((item) => ({ ...item }));
  texts.splice(index + 1, 0, cloneDraft(texts[index]));
  return replaceTexts(draft, texts);
}

export function moveText(draft, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= draft.texts.length) return replaceTexts(draft, draft.texts);
  const texts = draft.texts.map((item) => ({ ...item }));
  const [item] = texts.splice(index, 1);
  texts.splice(target, 0, item);
  return replaceTexts(draft, texts);
}

export function serializeDraft(draft) {
  return JSON.stringify(normalizeConfig(cloneDraft(draft)), null, 2);
}

export function importDraft(source, currentDraft) {
  try {
    const parsed = JSON.parse(source);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('配置根节点必须是对象');
    }
    const normalized = normalizeConfig(parsed);
    const imported = normalized.texts.length > 0
      ? normalized
      : { ...normalized, texts: [{ text: '', holdMs: DEFAULT_CONFIG.texts[0].holdMs }] };
    return { ok: true, draft: cloneDraft(imported), error: '' };
  } catch (error) {
    return { ok: false, draft: currentDraft, error: `导入失败：${error.message}` };
  }
}

function readPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function updatePath(source, path, value) {
  const [group, key] = path.split('.');
  return { ...source, [group]: { ...source[group], [key]: value } };
}

function textCard(item, index, count) {
  const article = document.createElement('article');
  article.className = `text-card${item.text.trim() ? '' : ' is-invalid'}`;
  article.dataset.textItem = '';
  article.dataset.index = String(index);
  article.innerHTML = `
    <div class="text-card-grid">
      <label class="text-value">文本 ${index + 1}
        <textarea name="text" data-text-field="text" aria-describedby="text-error-${index}"></textarea>
      </label>
      <label>停留 (ms)<input name="holdMs" type="number" min="0" max="20000" step="10" data-text-field="holdMs"></label>
      <label>单条展开 (ms，可选)<input name="revealMs" type="number" min="0" max="20000" step="10" data-text-field="revealMs"></label>
      <label>单条最大宽度 (px，可选)<input type="number" min="120" max="2400" data-text-layout="maxWidth"></label>
      <label>单条字号 (px，可选)<input type="number" min="12" max="240" data-text-layout="fontSize"></label>
      <label>单条行高 (可选)<input type="number" min="0.8" max="2" step="0.01" data-text-layout="lineHeight"></label>
      <label>单条圆球大小 (em，可选)<input type="number" min="0.2" max="2" step="0.01" data-text-layout="ballSizeEm"></label>
      <label>单条圆球间距 (em，可选)<input type="number" min="0.2" max="2" step="0.01" data-text-layout="ballGapEm"></label>
      <label>单条水平位置 (可选)<input type="text" placeholder="35% 或 240px" data-text-layout="x"></label>
      <label>单条垂直位置 (可选)<input type="text" placeholder="60% 或 180px" data-text-layout="y"></label>
      <label>单条缩放 (可选)<input type="number" min="0.25" max="4" step="0.01" data-text-layout="scale"></label>
    </div>
    <div class="text-actions" aria-label="文本 ${index + 1} 操作">
      <button type="button" data-action="move-up" ${index === 0 ? 'disabled' : ''} aria-label="上移文本 ${index + 1}">↑</button>
      <button type="button" data-action="move-down" ${index === count - 1 ? 'disabled' : ''} aria-label="下移文本 ${index + 1}">↓</button>
      <button type="button" data-action="duplicate-text">复制</button>
      <button type="button" data-action="delete-text">删除</button>
    </div>
    <p class="validation-message" id="text-error-${index}">${item.text.trim() ? '' : '请输入文本；至少需要一条有效内容。'}</p>`;
  article.querySelector('[data-text-field="text"]').value = item.text;
  article.querySelector('[data-text-field="holdMs"]').value = item.holdMs ?? '';
  article.querySelector('[data-text-field="revealMs"]').value = item.revealMs ?? '';
  for (const control of article.querySelectorAll('[data-text-layout]')) {
    control.value = item.layout?.[control.dataset.textLayout] ?? '';
  }
  return article;
}

export function startDeveloperPage(documentRef = document, environment = {}) {
  const editor = documentRef.querySelector('[data-editor]');
  if (!editor) return null;

  const preview = documentRef.querySelector('orbit-text-reveal');
  const list = documentRef.querySelector('[data-text-list]');
  const previewEmpty = documentRef.querySelector('[data-preview-empty]');
  const previewState = documentRef.querySelector('[data-preview-state]');
  const ioStatus = documentRef.querySelector('[data-io-status]');
  let draft = cloneDraft(animationConfig);
  let restartTimer;
  const clipboardWriteText = environment.clipboardWriteText ?? ((text) => {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    return globalThis.navigator.clipboard.writeText(text);
  });
  const copyFallback = environment.copyFallback ?? (() => documentRef.execCommand?.('copy'));
  const createObjectURL = environment.createObjectURL ?? ((blob) => globalThis.URL.createObjectURL(blob));
  const revokeObjectURL = environment.revokeObjectURL ?? ((url) => globalThis.URL.revokeObjectURL(url));
  const triggerDownload = environment.triggerDownload ?? ((link) => link.click());

  const showStatus = (message, isError = false) => {
    ioStatus.textContent = message;
    ioStatus.classList.toggle('is-error', isError);
  };

  const renderControls = () => {
    list.replaceChildren(...draft.texts.map((item, index) => textCard(item, index, draft.texts.length)));
    for (const control of editor.querySelectorAll('[data-path]')) {
      const value = readPath(draft, control.dataset.path);
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else control.value = value ?? '';
    }
  };

  const updatePreview = () => {
    const config = normalizeConfig(cloneDraft(draft));
    const enabled = config.texts.length > 0;
    preview.hidden = !enabled;
    previewEmpty.hidden = enabled;
    previewState.textContent = enabled ? `${config.texts.length} 条有效文本` : '预览已停用';
    preview.setAttribute('aria-disabled', String(!enabled));
    if (!enabled) {
      preview.updateConfig({ ...config, texts: [] }, { immediate: true });
      return;
    }
    preview.updateConfig(cloneDraft(config), { immediate: true });
  };

  const schedulePreview = () => {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(updatePreview, 120);
  };

  editor.addEventListener('input', (event) => {
    const field = event.target.closest('[data-text-field], [data-text-layout]');
    if (field) {
      const card = field.closest('[data-text-item]');
      const index = Number(card.dataset.index);
      const item = { ...draft.texts[index] };
      if (field.dataset.textField === 'text') {
        item.text = field.value;
        const isInvalid = item.text.trim() === '';
        card.classList.toggle('is-invalid', isInvalid);
        card.querySelector('.validation-message').textContent = isInvalid
          ? '请输入文本；至少需要一条有效内容。'
          : '';
      } else if (field.dataset.textLayout) {
        const layout = { ...(item.layout ?? {}) };
        if (field.value === '') delete layout[field.dataset.textLayout];
        else layout[field.dataset.textLayout] = field.type === 'number' ? Number(field.value) : field.value;
        if (Object.keys(layout).length > 0) item.layout = layout;
        else delete item.layout;
      } else if (field.value === '') {
        delete item[field.dataset.textField];
      } else {
        item[field.dataset.textField] = Number(field.value);
      }
      draft = replaceTexts(draft, draft.texts.map((entry, itemIndex) => itemIndex === index ? item : entry));
      schedulePreview();
      return;
    }

    const control = event.target.closest('[data-path]');
    if (!control) return;
    const value = control.type === 'checkbox'
      ? control.checked
      : control.type === 'number' ? Number(control.value) : control.value;
    draft = updatePath(draft, control.dataset.path, value);
    schedulePreview();
  });

  documentRef.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'play-preview') preview.play();
    else if (action === 'pause-preview') preview.pause();
    else if (action === 'replay-current') preview.restart();
    else if (action === 'preview-full-loop') {
      preview.updateConfig(normalizeConfig(cloneDraft(draft)), { immediate: true });
      preview.play();
    }
  });

  editor.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action || action === 'import-config') return;
    const card = event.target.closest('[data-text-item]');
    const index = card ? Number(card.dataset.index) : -1;

    if (action === 'add-text') {
      draft = replaceTexts(draft, [...draft.texts, { text: '', holdMs: DEFAULT_CONFIG.texts[0].holdMs }]);
      renderControls();
      schedulePreview();
    } else if (action === 'delete-text') {
      draft = deleteText(draft, index);
      renderControls();
      schedulePreview();
    } else if (action === 'duplicate-text') {
      draft = duplicateText(draft, index);
      renderControls();
      schedulePreview();
    } else if (action === 'move-up' || action === 'move-down') {
      draft = moveText(draft, index, action === 'move-up' ? -1 : 1);
      renderControls();
      schedulePreview();
    } else if (action === 'copy-config') {
      const json = serializeDraft(draft);
      try {
        await clipboardWriteText(json);
      } catch {
        const fallback = documentRef.createElement('textarea');
        fallback.value = json;
        fallback.setAttribute('readonly', '');
        fallback.style.cssText = 'position:fixed;left:-9999px;top:0';
        documentRef.body.append(fallback);
        fallback.select();
        const copied = copyFallback(fallback);
        fallback.remove();
        if (!copied) {
          showStatus('无法自动复制，请使用支持剪贴板的浏览器。', true);
          return;
        }
      }
      showStatus('已复制规范化 JSON。');
    } else if (action === 'download-config') {
      const blob = new Blob([serializeDraft(draft)], { type: 'application/json;charset=utf-8' });
      const url = createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'orbit-text-config.json';
      documentRef.body.append(link);
      triggerDownload(link);
      link.remove();
      setTimeout(() => revokeObjectURL(url), 0);
      showStatus('已生成 orbit-text-config.json。');
    }
  });

  editor.querySelector('[data-action="import-config"]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = importDraft(await file.text(), draft);
      if (!result.ok) {
        showStatus(result.error, true);
        return;
      }
      draft = result.draft;
      renderControls();
      updatePreview();
      showStatus('已导入并应用 JSON 配置。');
    } catch (error) {
      showStatus(`导入失败：${error.message}`, true);
    } finally {
      event.target.value = '';
    }
  });

  renderControls();
  updatePreview();
  return { getDraft: () => cloneDraft(draft), updatePreview };
}

if (typeof document !== 'undefined') {
  await import('./orbit-text-reveal.js?v=20260718-2');
  startDeveloperPage(document, globalThis.__ORBIT_DEV_TEST_ENV__);
}
