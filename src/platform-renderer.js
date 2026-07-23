export async function copyPlatformValue(value, clipboard = globalThis.navigator?.clipboard) {
  try {
    if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
    await clipboard.writeText(value);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function renderPlatformCards(container, entries, options = {}) {
  const statusTimers = new Set();
  const listeners = [];
  const ownerDocument = container.ownerDocument;
  const clipboard = options.clipboard ?? globalThis.navigator?.clipboard;
  const setTimeoutFn = options.setTimeout ?? globalThis.setTimeout;
  const clearTimeoutFn = options.clearTimeout ?? globalThis.clearTimeout;
  let destroyed = false;

  container.textContent = '';

  for (const entry of entries) {
    const card = ownerDocument.createElement('div');
    card.className = 'platform-card';
    card.dataset.platformId = entry.id;
    card.dataset.iconSide = entry.iconSide === 'right' ? 'right' : 'left';

    const iconImg = ownerDocument.createElement('img');
    iconImg.className = 'platform-card__icon';
    iconImg.alt = '';
    iconImg.src = entry.icon;
    iconImg.width = 56;
    iconImg.height = 56;

    const textBlock = ownerDocument.createElement('div');
    textBlock.className = 'platform-card__text';

    const titleEl = ownerDocument.createElement('div');
    titleEl.className = 'platform-card__title';
    titleEl.textContent = entry.title;
    textBlock.append(titleEl);

    const descEl = ownerDocument.createElement('div');
    descEl.className = 'platform-card__description';
    descEl.textContent = entry.description;
    textBlock.append(descEl);

    const statusEl = ownerDocument.createElement('span');
    statusEl.className = 'platform-card__copy-status';
    statusEl.textContent = '';
    statusEl.setAttribute('aria-live', 'polite');
    textBlock.append(statusEl);

    if (entry.iconSide === 'right') card.append(textBlock, iconImg);
    else card.append(iconImg, textBlock);

    if (entry.action.type === 'link') {
      const anchor = ownerDocument.createElement('a');
      anchor.href = entry.action.value;
      if (entry.action.newTab) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      anchor.className = 'platform-card__action';
      anchor.setAttribute('aria-label', `${entry.title}：打开链接`);
      anchor.append(card);
      container.append(anchor);
    } else {
      const button = ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'platform-card__action';
      button.setAttribute('aria-label', `${entry.title}：复制内容`);
      const listener = async () => {
        if (destroyed) return;
        const result = await copyPlatformValue(entry.action.value, clipboard);
        if (destroyed) return;
        statusEl.textContent = result === 'copied' ? '已复制' : '复制失败';
        const timer = setTimeoutFn(() => {
          statusEl.textContent = '';
          statusTimers.delete(timer);
        }, 1600);
        statusTimers.add(timer);
      };
      button.addEventListener('click', listener);
      listeners.push([button, listener]);
      button.append(card);
      container.append(button);
    }
  }

  return {
    destroy({ clear = true } = {}) {
      destroyed = true;
      for (const [button, listener] of listeners) button.removeEventListener('click', listener);
      listeners.length = 0;
      for (const timer of statusTimers) clearTimeoutFn(timer);
      statusTimers.clear();
      if (clear) container.textContent = '';
    }
  };
}
