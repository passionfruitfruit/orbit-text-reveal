function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
      ? escapeHtml(value)
      : null;
  } catch {
    return null;
  }
}

function inline(source: string) {
  const code: string[] = [];
  let output = escapeHtml(source).replace(/`([^`]+)`/g, (_, value) => {
    const token = `\u0000CODE${code.length}\u0000`;
    code.push(`<code>${value}</code>`);
    return token;
  });
  output = output.replace(/\[([^\]]+)]\(([^\s)]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
    const safe = safeHref(href);
    return safe ? `<a href="${safe}" rel="noopener noreferrer">${label}</a>` : label;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return output.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)] ?? '');
}

export function renderSafeMarkdown(source: string) {
  const lines = String(source ?? '').replaceAll('\r\n', '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks.join('\n');
}
