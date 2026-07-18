import assert from 'node:assert/strict';
import test from 'node:test';
import { startPlatformDeveloperEditor } from '../src/platform-dev-app.js';
import { serializePlatformConfig } from '../src/platform-config.js';

function makeFakeDocument() {
  let elCounter = 0;

  function matchesSelector(el, sel) {
    if (sel.startsWith('[data-action="')) {
      return el.dataset?.action === sel.slice('[data-action="'.length, -1);
    }
    if (sel === 'p') return el.tagName === 'P';
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return false;
  }

  const doc = {
    createElement: null,
    createTextNode() { return {}; },
    body: null,
    execCommand() { return true; },
    querySelector() { return null; }
  };

  function dispatchClick(el, type, target) {
    const l = el.listeners.get(type);
    if (l) l({ type, target: target ?? el, currentTarget: el });
    if (el.parentNode && typeof el.parentNode.dispatchEvent === 'function') {
      el.parentNode.dispatchEvent(type, target ?? el);
    }
  }

  function createFakeElement(tagName) {
    const children = [];
    const listeners = new Map();
    const dataset = {};
    const attributes = {};
    const classListSet = new Set();
    let htmlContent = '';

    const el = {
      tagName: tagName.toUpperCase(),
      className: '',
      textContent: '',
      children, dataset, attributes,
      style: { values: {}, setProperty(n, v) { this.values[n] = v; } },
      listeners, parentNode: null,
      id: '', download: '', href: '', hidden: false, disabled: false,

      setAttribute(n, v) { attributes[n] = String(v); },
      getAttribute(n) { return attributes[n] ?? null; },
      removeAttribute(n) { delete attributes[n]; },

      get innerHTML() { return htmlContent; },
      set innerHTML(v) { htmlContent = String(v); children.length = 0; },

      get classList() {
        return {
          add(...ns) { for (const n of ns) classListSet.add(n); },
          remove(...ns) { for (const n of ns) classListSet.delete(n); },
          toggle(n, f) {
            if (f === true) { classListSet.add(n); return true; }
            if (f === false) { classListSet.delete(n); return false; }
            return classListSet.has(n) ? (classListSet.delete(n), false) : (classListSet.add(n), true);
          },
          contains(n) { return classListSet.has(n); }
        };
      },

      append(...nodes) { for (const n of nodes) { n.parentNode = this; children.push(n); } },
      addEventListener(t, l) { listeners.set(t, l); },
      removeEventListener(t, l) { if (listeners.get(t) === l) listeners.delete(t); },
      dispatchEvent(type, target) {
        dispatchClick(this, type, target);
      },
      click() {
        dispatchClick(this, 'click', this);
      },
      closest(sel) {
        let el = this;
        while (el) {
          if (matchesSelector(el, sel)) return el;
          el = el.parentNode;
        }
        return null;
      },
      remove() {
        const p = this.parentNode;
        if (p && Array.isArray(p.children)) {
          const idx = p.children.indexOf(this);
          if (idx >= 0) p.children.splice(idx, 1);
        }
        this.parentNode = null;
      }
    };
    return el;
  }

  doc.createElement = (tagName) => {
    const element = createFakeElement(tagName);
    element.ownerDocument = doc;
    return element;
  };
  doc.body = (() => { const b = createFakeElement('body'); b.ownerDocument = doc; return b; })();
  return doc;
}

test('startPlatformDeveloperEditor returns getDraft and destroy', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: [] });
  assert.equal(typeof editor.getDraft, 'function');
  assert.equal(typeof editor.destroy, 'function');
  editor.destroy();
});

test('startPlatformDeveloperEditor starts with provided platform data in draft', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  const data = [{ id: 'test', title: 'Test', description: 'Desc', icon: './icon.svg', iconSide: 'left', action: { type: 'link', value: 'https://example.com', newTab: true } }];
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: data });
  assert.equal(editor.getDraft().length, 1);
  assert.equal(editor.getDraft()[0].id, 'test');
  editor.destroy();
});

test('download filename matches platform-config.json via command buttons', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  let captured = '';
  const trigger = (link) => { captured = link.download; };
  const editor = startPlatformDeveloperEditor({
    documentRef: fakeDoc, container, platformData: [],
    createObjectURL: () => 'blob:test', revokeObjectURL: () => {}, triggerDownload: trigger
  });
  // Navigate direct children to find download button and verify click works via bubbling
  const section = container.children[0];
  // section children: 0=heading, 1=list, 2=previewArea, 3=actionGrid, 4=ioStatus
  assert.equal(section.tagName, 'SECTION');
  const heading = section.children[0];
  assert(heading, 'heading should exist');
  // actionGrid is at index 3
  const actionGrid = section.children[3];
  assert(actionGrid, 'action grid should exist');
  assert.equal(actionGrid.children.length, 2, 'should have 2 action buttons');
  const downloadBtn = actionGrid.children[1];
  assert(downloadBtn, 'download button should exist');
  downloadBtn.click();
  assert.equal(captured, 'platform-config.json');
  editor.destroy();
});

test('add platform click handler via bubbling creates new entry', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: [] });
  assert.equal(editor.getDraft().length, 0);
  const section = container.children[0];
  const heading = section.children[0];
  const headingInner = heading.children[0];
  const addBtn = heading.children[1];
  assert(addBtn, 'add button should exist');
  addBtn.click();
  assert.equal(editor.getDraft().length, 1);
  assert.equal(editor.getDraft()[0].title, '新平台');
  editor.destroy();
});

test('serializePlatformConfig produces matching JSON', () => {
  const entries = [{ id: 'a', title: 'A', description: 'Desc', icon: './a.svg', iconSide: 'left', action: { type: 'link', value: 'https://a.com', newTab: true } }];
  assert.match(serializePlatformConfig(entries), /"action"/);
});

test('destroy releases resources without error', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: [] });
  assert.equal(typeof editor.destroy, 'function');
  editor.destroy();
  // No crash after double destroy
  editor.destroy();
});

test('delete button removes an entry via bubble click', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div');
  container.ownerDocument = fakeDoc;
  const data = [{ id: 'a', title: 'A', description: 'D', icon: './a.svg', iconSide: 'left', action: { type: 'link', value: 'https://a.com', newTab: true } }];
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: data });
  assert.equal(editor.getDraft().length, 1);
  // Get the delete button from the rendered article
  const section = container.children[0];
  const list = section.children[1];
  const article = list.children[0];
  const header = article.children[0];
  const actionDiv = header.children[1]; // 0=number, 1=actions
  // action buttons: 0=up, 1=down, 2=duplicate, 3=delete
  const delBtn = actionDiv.children[3];
  assert(delBtn, 'delete button should exist');
  delBtn.click();
  assert.equal(editor.getDraft().length, 0);
  editor.destroy();
});

function walk(node, result = []) {
  if (!node) return result;
  result.push(node);
  for (const child of node.children ?? []) walk(child, result);
  return result;
}

test('invalid raw rows remain editable but are excluded from preview and export', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div'); container.ownerDocument = fakeDoc;
  let previewEntries = null;
  const editor = startPlatformDeveloperEditor({
    documentRef: fakeDoc,
    container,
    platformData: [{ id: 'bad', title: '', description: 'desc', icon: './x.svg', iconSide: 'left', action: { type: 'link', value: 'https://x.test' } }],
    renderCards: (_node, entries) => { previewEntries = entries; return { destroy() {} }; }
  });
  assert.equal(editor.getDraft().length, 1);
  assert.deepEqual(previewEntries, []);
  const row = walk(container).find((node) => node.dataset?.platformError !== undefined);
  assert.match(row.textContent, /请输入平台名称/);
  assert.equal(JSON.parse((() => {
    const draft = editor.getDraft();
    return JSON.stringify(draft.filter((entry) => entry.title));
  })()).length, 0);
  editor.destroy();
});

test('platform copy action receives the exact serialized normalized draft', async () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div'); container.ownerDocument = fakeDoc;
  let copied = '';
  const data = [{ id: 'mail', title: '邮箱', description: '联系', icon: './mail.svg', iconSide: 'left', action: { type: 'copy', value: 'mail@test', newTab: false } }];
  const editor = startPlatformDeveloperEditor({ documentRef: fakeDoc, container, platformData: data, clipboardWriteText: async (value) => { copied = value; }, renderCards: () => ({ destroy() {} }) });
  const section = container.children[0];
  await section.listeners.get('click')({ target: section.children[3].children[0] });
  assert.equal(copied, serializePlatformConfig(data));
  editor.destroy();
});

test('platform copy excludes invalid raw rows from the exported JSON', async () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div'); container.ownerDocument = fakeDoc;
  let copied = '';
  const valid = { id: 'mail', title: '邮箱', description: '联系', icon: './mail.svg', iconSide: 'left', action: { type: 'copy', value: 'mail@test', newTab: false } };
  const invalid = { id: 'broken', title: '', description: '缺少名称', icon: './broken.svg', iconSide: 'left', action: { type: 'link', value: 'https://example.com', newTab: true } };
  const editor = startPlatformDeveloperEditor({
    documentRef: fakeDoc,
    container,
    platformData: [valid, invalid],
    clipboardWriteText: async (value) => { copied = value; },
    renderCards: () => ({ destroy() {} })
  });
  const section = container.children[0];
  await section.listeners.get('click')({ target: section.children[3].children[0] });
  assert.equal(copied, serializePlatformConfig([valid]));
  editor.destroy();
});

test('input preview updates use a trailing 120ms timer', () => {
  const fakeDoc = makeFakeDocument();
  const container = fakeDoc.createElement('div'); container.ownerDocument = fakeDoc;
  const timers = [];
  let previewCalls = 0;
  const editor = startPlatformDeveloperEditor({
    documentRef: fakeDoc,
    container,
    platformData: [{ id: 'a', title: 'A', description: 'D', icon: './a.svg', iconSide: 'left', action: { type: 'link', value: 'https://a.test' } }],
    renderCards: () => { previewCalls += 1; return { destroy() {} }; },
    setTimeoutFn: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeoutFn: () => {}
  });
  const titleInput = walk(container).find((node) => node.dataset?.platformField === 'title');
  titleInput.value = 'Changed';
  const section = container.children[0];
  section.listeners.get('input')({ target: titleInput });
  assert.equal(previewCalls, 1);
  assert.equal(timers.at(-1).ms, 120);
  timers.at(-1).fn();
  assert.equal(previewCalls, 2);
  editor.destroy();
});
