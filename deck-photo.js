'use strict';

function findBookColumns(context, width, height) {
  if (height < width * 1.2) return null;
  const pixels = context.getImageData(0, 0, width, height).data;
  const rows = new Uint16Array(height);
  const left = Math.floor(width * .04);
  const right = Math.floor(width * .96);
  for (let y = 0; y < height; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      const low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (low > 145 && high - low < 54) rows[y]++;
    }
  }
  const paper = (right - left) * .6;
  const top = rows.findIndex((count, y) => y >= height * .08 && y <= height * .44 && count > paper);
  let bottom = Math.round(height * .94);
  while (bottom >= height * .61 && rows[bottom] <= paper) bottom--;
  if (top < 0 || bottom - top < height * .42) return null;

  const ink = new Float64Array(width);
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 165) ink[x]++;
    }
  }
  const density = (from, to) => {
    const values = ink.slice(Math.round(width * from), Math.round(width * to));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  const flank = Math.min(density(.22, .42), density(.58, .80));
  if (flank < (bottom - top) * .025) return null;
  let split = 0;
  let quietest = Infinity;
  for (let x = Math.round(width * .46); x <= width * .55; x++) {
    const score = density((x - 4) / width, (x + 5) / width);
    if (score < quietest) {
      quietest = score;
      split = x;
    }
  }
  if (quietest > flank * .67) return null;
  return { top, bottom: bottom + 1, split };
}

function prepareBookColumn(image, area, scale) {
  const [x, y, width, height] = area.map(value => value * scale);
  const factor = Math.min(2.5, 2300 / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * factor);
  canvas.height = Math.round(height * factor);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.data.length; i += 4) {
    const gray = Math.round(data.data[i] * .299 + data.data[i + 1] * .587 + data.data[i + 2] * .114);
    data.data[i] = gray;
    histogram[gray]++;
  }
  const cutoff = canvas.width * canvas.height * .01;
  let low = 0;
  let high = 255;
  let sum = histogram[low];
  while (sum < cutoff) sum += histogram[++low];
  sum = histogram[high];
  while (sum < cutoff) sum += histogram[--high];
  const spread = Math.max(50, high - low);
  for (let i = 0; i < data.data.length; i += 4) {
    const gray = (data.data[i] - low) * 255 / spread;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
  }
  context.putImageData(data, 0, 0);
  return canvas;
}

const bookPart = /^(?:(?:[[(][^\])]{1,24}[\])]|\d+[.)])\s*)*(n|vi|vt|v|adj|adv|a|ad|prep|pron|conj|interj)(?:\.(?=\s|[\[({]|$)|(?=\s*[\[({]|$))\s*/i;
const bookHeader = /^[^A-Za-z0-9]{0,5}([A-Za-z]+(?:[ -][A-Za-z]+){0,3})\s*[/\\]([^/\\]{1,47})[/\\]\s*(.*)$/;
const bookHeaderMissingSlash = /^[^A-Za-z0-9]{0,5}([A-Za-z]+(?:[ -][A-Za-z]+){0,3})\s*[/\\].{1,35}?\s+((?:n|vi|vt|v|adj|adv|a|ad|prep)\.(?:\s.*)?$)/i;
const bookHeaderLostOpening = /^[^A-Za-z0-9]{0,5}([A-Za-z]+(?:[ -][A-Za-z]+){0,3})\s+([^\s/\\]*[’':][^/\\]{1,28})[/\\]\s*(.*)$/;
const bookHeaderLostEnding = /^[^A-Za-z0-9]{0,5}([A-Za-z]+(?:[ -][A-Za-z]+){0,3})\s*[/\\]\s*([^/\\]{1,32})$/;
const bookExample = /^(?:[eE€©2®&][., ]*\s*[gq9]|[».][., ]*\s*g)[.,: ]+\s*/;
const bookEnding = /[.!?][”"’']?$/;
const bookMetadata = /^(?:\[[^\]]+\]|\{[^}\]]+\]|\([^)]+\))$/;
const bookSkip = /^(?:new words|unit\s*\d|mind the gap|vocabulary|词汇表)/i;

function textbookRows(text) {
  const rows = [];
  let entry;
  let example = '';
  let definition = '';
  let phrases = false;
  function saveSense() {
    if (!entry) return;
    if (definition && !bookMetadata.test(definition)) {
      const clean = definition.replace(/^(?:\[[^\]]+\]\s*)+/, '').trim();
      const chineseAt = clean.search(/[\u3400-\u9fff]/);
      const meaning = (chineseAt === -1 ? clean : clean.slice(chineseAt)).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1').trim();
      if (meaning && !entry.meaning.includes(meaning)) entry.meaning.push(meaning);
    }
    if (!entry.example && example.split(/\s+/).length >= 4 && bookEnding.test(example)) {
      const stem = entry.term.replace(/e$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (stem.length >= 2 && new RegExp('\\b' + stem + '[a-z]*\\b', 'i').test(example)) entry.example = example;
    }
    example = '';
    definition = '';
  }
  function finish() {
    saveSense();
    if (entry && (entry.pos || entry.meaning.length || entry.example)) rows.push({
      term: entry.term, pos: entry.pos, meaning: entry.meaning.join('；'), example: entry.example
    });
    entry = undefined;
  }
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^proper names\b/i.test(line)) break;
    if (/^phrases and expressions\b/i.test(line)) {
      finish();
      phrases = true;
      continue;
    }
    if (bookSkip.test(line.replace(/^[*•♦· ]+/, ''))) continue;
    const partial = line.match(bookHeaderLostEnding);
    const full = line.match(bookHeader);
    const header = (full && (!/^[A-Za-z]/.test(full[3]) || bookPart.test(full[3]) || /[’':]/.test(full[2])) ? full : null) || line.match(bookHeaderMissingSlash) ||
      line.match(bookHeaderLostOpening) || (partial && /[’':]/.test(partial[2]) ? [...partial, ''] : null);
    const plainHead = /^[A-Za-z]+(?:[ -][A-Za-z]+){0,5}$/.test(line) &&
      (bookPart.test(lines[i + 1] || '') || (phrases && (!entry || example && /[.!?]$/.test(example)) && /^[a-z(]/.test(lines[i + 1] || '')));
    if (header || plainHead) {
      finish();
      const term = (header?.[1] || line).replace(/^([a-z]) ([a-z]{4,})$/, '$1$2');
      entry = term.length >= 2 ? { term, pos: '', meaning: [], example: '' } : undefined;
      line = header ? header.at(-1).trim() : '';
    }
    if (!entry || !line || bookMetadata.test(line)) continue;
    const pos = line.match(bookPart);
    if (pos) {
      saveSense();
      const category = pos[1].toLowerCase() + '.';
      entry.pos = entry.pos && !entry.pos.split(' / ').includes(category) ? entry.pos + ' / ' + category : entry.pos || category;
      line = line.slice(pos[0].length);
      if (!line) continue;
    }
    if (bookExample.test(line)) {
      saveSense();
      example = line.replace(bookExample, '');
    } else if (/^\d+\)/.test(line)) {
      saveSense();
      definition = line.replace(/^\d+\)\s*/, '');
    } else if (example && !bookEnding.test(example)) {
      example += ' ' + line;
    } else if (!example) {
      definition += (definition ? ' ' : '') + line;
    }
  }
  finish();
  return rows;
}

async function readDeckImage(file, worker, status) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.max(1, image.naturalWidth / 720, image.naturalHeight / 1600);
    const sample = document.createElement('canvas');
    sample.width = Math.round(image.naturalWidth / scale);
    sample.height = Math.round(image.naturalHeight / scale);
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, sample.width, sample.height);
    const page = findBookColumns(context, sample.width, sample.height);
    if (page) {
      const height = page.bottom - page.top;
      const areas = [
        [0, page.top, page.split, height],
        [Math.max(0, page.split - 10), page.top, sample.width - page.split + 10, height]
      ];
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const columns = [];
      for (const [i, area] of areas.entries()) {
        status('正在识别双栏课本 · ' + (i ? '右栏' : '左栏') + '…');
        const column = prepareBookColumn(image, area, scale);
        columns.push((await worker.recognize(column)).data.text);
      }
      const rows = textbookRows(columns.join('\n'));
      if (rows.length >= 3) {
        return ['单词\t词性\t释义\t例句', ...rows.map(row => [
          row.term, row.pos, row.meaning, row.example
        ].join('\t'))].join('\n');
      }
      if (columns.join('\n').split(/\r?\n/).filter(line => line.trim()).length > 28) {
        throw new Error('检测到双栏，但读不出足够的词条。请尝试裁掉背景，或分栏拍摄。');
      }
    }
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    return (await worker.recognize(file)).data.text;
  } finally {
    URL.revokeObjectURL(url);
  }
}
