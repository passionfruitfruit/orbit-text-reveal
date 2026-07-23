import assert from 'node:assert/strict';
import test from 'node:test';
import { copyPlatformValue, renderPlatformCards } from '../src/platform-renderer.js';

class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  async dispatch(type) {
    return this.listeners.get(type)?.({ type, currentTarget: this });
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

function makeContainer() {
  return new FakeElement(new FakeDocument(), 'section');
}

function cardFromAction(container) {
  return container.children[0].children[0];
}

 test('copyPlatformValue returns copied only after the clipboard resolves', async () => {
   const writes = [];
   assert.equal(await copyPlatformValue('mail@example.com', { writeText: async (value) => writes.push(value) }), 'copied');
   assert.deepEqual(writes, ['mail@example.com']);
 });

test('copyPlatformValue reports failure without throwing', async () => {
  assert.equal(await copyPlatformValue('mail@example.com', { writeText: async () => { throw new Error('denied'); } }), 'failed');
});

test('renderPlatformCards uses the container document and preserves side-specific child order', () => {
  const previousDocument = globalThis.document;
  globalThis.document = undefined;
  try {
    const container = makeContainer();
    renderPlatformCards(container, [
      { id: 'left', title: '左平台', description: '左描述', icon: './left.svg', iconSide: 'left', action: { type: 'link', value: '/left', newTab: false } },
      { id: 'right', title: '右平台', description: '右描述', icon: './right.svg', iconSide: 'right', action: { type: 'link', value: '/right', newTab: false } }
    ]);

    const leftCard = container.children[0].children[0];
    const rightCard = container.children[1].children[0];
    assert.equal(leftCard.dataset.iconSide, 'left');
    assert.equal(rightCard.dataset.iconSide, 'right');
    assert.equal(leftCard.children[0].tagName, 'IMG');
    assert.equal(leftCard.children[1].className, 'platform-card__text');
    assert.equal(rightCard.children[0].className, 'platform-card__text');
    assert.equal(rightCard.children[1].tagName, 'IMG');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('link cards expose exact href, new-tab security, and accessible intent labels', () => {
  const container = makeContainer();
  renderPlatformCards(container, [
    { id: 'new', title: '新平台', description: '描述', icon: './icon.svg', iconSide: 'left', action: { type: 'link', value: 'https://example.com/a', newTab: true } },
    { id: 'same', title: '站内', description: '描述', icon: './icon.svg', iconSide: 'right', action: { type: 'link', value: '/inside', newTab: false } }
  ]);
  const newTab = container.children[0];
  const sameTab = container.children[1];
  assert.equal(newTab.href, 'https://example.com/a');
  assert.equal(newTab.target, '_blank');
  assert.equal(newTab.rel, 'noopener noreferrer');
  assert.match(newTab.attributes['aria-label'], /新平台/);
  assert.match(newTab.attributes['aria-label'], /打开/);
  assert.equal(sameTab.href, '/inside');
  assert.equal(sameTab.target, undefined);
  assert.equal(sameTab.rel, undefined);
});

test('copy cards use injected clipboard and timers, report success and failure, and destroy cleanly', async () => {
  const container = makeContainer();
  const writes = [];
  const scheduled = [];
  const cleared = [];
  const clipboard = { writeText: async (value) => writes.push(value) };
  const setTimeout = (callback, delay) => {
    const timer = { callback, delay };
    scheduled.push(timer);
    return timer;
  };
  const clearTimeout = (timer) => cleared.push(timer);
  const controller = renderPlatformCards(container, [{
    id: 'copy', title: '复制平台', description: '描述', icon: './icon.svg', iconSide: 'left',
    action: { type: 'copy', value: 'secret' }
  }], { clipboard, setTimeout, clearTimeout });
  const button = container.children[0];
  assert.equal(button.tagName, 'BUTTON');
  assert.match(button.attributes['aria-label'], /复制平台/);
  assert.match(button.attributes['aria-label'], /复制/);
  await button.dispatch('click');
  const status = button.children[0].children[1].children[2];
  assert.deepEqual(writes, ['secret']);
  assert.equal(status.textContent, '已复制');
  assert.equal(scheduled[0].delay, 1600);

  clipboard.writeText = async () => { throw new Error('denied'); };
  await button.dispatch('click');
  assert.equal(status.textContent, '复制失败');
  assert.equal(scheduled.length, 2);

  controller.destroy();
  assert.deepEqual(cleared, scheduled);
  assert.equal(container.children.length, 0);
  assert.equal(button.listeners.size, 0);
});

test('replacement cleanup removes old listeners without clearing newly rendered cards', () => {
  const container = makeContainer();
  const oldView = renderPlatformCards(container, [{
    id: 'old', title: '旧平台', description: '旧描述', icon: './old.svg', iconSide: 'left',
    action: { type: 'copy', value: 'old' },
  }]);
  const oldButton = container.children[0];

  renderPlatformCards(container, [{
    id: 'new', title: '新平台', description: '新描述', icon: './new.svg', iconSide: 'left',
    action: { type: 'link', value: '/new', newTab: false },
  }]);
  oldView.destroy({ clear: false });

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].href, '/new');
  assert.equal(oldButton.listeners.size, 0);
});
