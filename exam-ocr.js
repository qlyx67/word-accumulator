/* Local photo OCR for study packs. A recognized line is not necessarily a vocabulary entry. */
const StudyPackPhoto = (() => {
  'use strict';
  const version = 2;
  const columnBreak = '\n\f';
  const termShape = /^[A-Za-z]+(?:['’-][A-Za-z]+)*(?: [A-Za-z]+(?:['’-][A-Za-z]+)*){0,6}$/;
  const heading = /^(?:reading\s*\d|new words|proper names|phrases and expressions|vocabulary|unit\s*\d|page\s*\d)/i;
  const stripMarker = line => line.trim().replace(/^[*+•●·♦©]+\s*/, '').replace(/^\d+[.)、]\s*/, '');

  const pos = 'n|v|vi|vt|a|ad|adj|adv|prep|pron|conj|interj|abbr';
  const bookHead = new RegExp(
    "^([A-Za-z]+(?:[-’'][A-Za-z]+)*(?: [A-Za-z]+){0,3})\\s*(?:[/\\\\\\[][^/\\\\\\]]{1,52}[/\\\\\\]]|[/\\\\][^/\\\\]{1,44}?)\\s*[. ]*(" + pos + ")\\.(?:\\s|[[(]|$)", 'i'
  );
  const exampleMarker = /^(?:[eE€¢©][., ]*\s*[gq9]|[rR][eE]g|[eE][ .]+\d)[.,: ]+\s*/;
  const containsTerm = (text, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + escaped + '\\b', 'i').test(text);
  };

  function chineseGloss(text) {
    const compact = text.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
    return [...compact.matchAll(/[\u3400-\u9fff]+(?:\s*[（）()；;，、…·-]+\s*[\u3400-\u9fff]+)*/g)]
      .map(match => match[0].replace(/\s+/g, ''))
      .filter(part => (part.match(/[\u3400-\u9fff]/g) || []).length >= 2)
      .join('；');
  }

  function extract(text, sourceId) {
    const rows = [];
    let firstLine = 0;
    for (const column of text.split(columnBreak)) {
      const lines = column.split(/\r?\n/);
      const heads = lines.map((raw, index) => {
        const line = stripMarker(raw);
        return { line, index, match: line.match(bookHead) };
      });
      const textbook = heads.some(({ match, line }) => match || /^phrases and expressions\b/i.test(line));
      const phrasesFromBook = textbook ? new Set(textbookRows(column).map(item => item.term.toLowerCase())) : new Set();
      let collectingNames = false;
      let phrases = false;
      let current;

      function finish() {
        if (!current) return;
        const meaning = chineseGloss(current.definition);
        const example = current.examples.find(sentence => /[.!?][”"']?$/.test(sentence) &&
          containsTerm(sentence, current.term)) || '';
        rows.push({
          id: StudyPackCore.uid(),
          kind: 'word',
          term: current.term,
          pos: current.pos,
          meaning: meaning.slice(0, 1500),
          example: example.slice(0, 1500),
          exampleZh: '',
          alternatives: [],
          enabled: Boolean(meaning),
          origin: 'photo',
          bookEntry: textbook,
          examplesForCheck: current.examples.join(' ').slice(0, 2000),
          sources: [{ sourceId, line: firstLine + current.index + 1, excerpt: lines[current.index].slice(0, 2000) }],
        });
        current = undefined;
      }

      for (const { line, index, match } of heads) {
        if (!line) continue;
        if (heading.test(line)) {
          finish();
          if (/^proper names\b/i.test(line)) collectingNames = true;
          if (/^(?:reading\s*\d|new words)\b/i.test(line)) {
            collectingNames = false;
            phrases = false;
          }
          if (/^phrases and expressions\b/i.test(line)) phrases = true;
          continue;
        }
        if (collectingNames) continue;
        const phraseHead = phrases && termShape.test(line) && line.includes(' ') && phrasesFromBook.has(line.toLowerCase());
        let simple;
        if (!textbook) {
          simple = line.match(new RegExp("^([A-Za-z][A-Za-z'’ -]{0,72}?)(?:\\s*[|\\t—–:：]\\s*|\\s+)(?:(" + pos + ")\\.\\s*)?([\\u3400-\\u9fff][^|\\t]*)"));
          if (!simple && /[|\t]/.test(line)) {
            const explicit = StudyPackCore.parse(line, sourceId).rows[0];
            if (explicit?.kind === 'sentence' && /^[A-Za-z][A-Za-z',.;!? -]+[.!?]$/.test(explicit.term) &&
                /[\u3400-\u9fff]/.test(explicit.meaning)) {
              finish();
              explicit.origin = 'photo';
              explicit.examplesForCheck = '';
              explicit.sources[0].line = firstLine + index + 1;
              explicit.sources[0].excerpt = lines[index].slice(0, 2000);
              rows.push(explicit);
              continue;
            }
          }
          if (simple && !termShape.test(simple[1].trim())) simple = null;
        }
        if (match || phraseHead || simple) {
          finish();
          current = {
            term: (match?.[1] || simple?.[1] || line).trim(),
            pos: match ? match[2].toLowerCase() + '.' : simple?.[2] ? simple[2] + '.' : phraseHead ? 'phr.' : '',
            index,
            definition: match ? line.slice(match[0].length) : simple?.[3] || '',
            examples: [],
            readingExample: false,
          };
          continue;
        }
        if (!current || !textbook) continue;
        if (exampleMarker.test(line)) {
          current.examples.push(line.replace(exampleMarker, ''));
          current.readingExample = true;
        } else if (/^\d+[.)]/.test(lines[index].trim())) {
          current.readingExample = false;
          current.definition += '；' + line;
        } else if (current.readingExample) {
          const last = current.examples.length - 1;
          if (!/[.!?]$/.test(current.examples[last])) current.examples[last] += ' ' + line;
        } else {
          current.definition += ' ' + line;
        }
      }
      finish();
      firstLine += lines.length;
    }
    return StudyPackCore.dedupe(rows).slice(0, 300);
  }

  function oneLetterOff(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    if (a.length < b.length) [a, b] = [b, a];
    let offset = 0, edits = 0;
    for (let i = 0; i < b.length; i++) {
      if (a[i + offset] === b[i]) continue;
      if (++edits > 1) return false;
      if (a.length > b.length) { offset = 1; i--; }
    }
    return edits === 1 || a.length !== b.length;
  }

  async function verify(item, lookup) {
    const { examplesForCheck, bookEntry, ...row } = item;
    if (row.kind === 'sentence') return row;
    const term = row.term.toLowerCase();
    const words = [...new Set((examplesForCheck.toLowerCase().match(/[a-z]{4,}/g) || []))];
    const entry = await lookup(term);
    if (!entry.meaning && /^[a-z]{5,}$/.test(term) && !containsTerm(examplesForCheck, term)) {
      const matches = await Promise.all(words.filter(word => oneLetterOff(term, word)).slice(0, 8).map(lookup));
      const known = matches.filter(candidate => candidate.meaning);
      if (known.length === 1) {
        row.term = known[0].term;
        row.meaning = known[0].meaning.slice(0, 1500);
        row.pos ||= known[0].pos;
        row.enabled = false;
        row.origin = 'photo-corrected';
        return row;
      }
    }
    if (bookEntry && row.meaning && entry.meaning) {
      const dictionaryHan = entry.meaning.match(/[\u3400-\u9fff]{2,}/g) || [];
      const senses = row.meaning.split(/[;；、，]/).filter(sense => {
        const han = sense.replace(/[^\u3400-\u9fff]/g, '');
        return han.length >= 2 && dictionaryHan.some(gloss => gloss.includes(han));
      });
      row.meaning = senses.join('；');
    }
    if (!row.meaning && entry.meaning) {
      row.meaning = entry.meaning.slice(0, 1500);
      row.pos ||= entry.pos;
      row.origin = 'dictionary';
      row.enabled = false;
    }
    if (!row.meaning) return null;
    // A word read from the image may be valid but missing from the small bundled dictionary.
    if (!entry.meaning) row.enabled = false;
    return row;
  }

  function sampledPage(image) {
    const scale = Math.max(1, image.naturalWidth / 720, image.naturalHeight / 1600);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth / scale);
    canvas.height = Math.round(image.naturalHeight / scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { scale, width: canvas.width, height: canvas.height, page: findBookColumns(context, canvas.width, canvas.height) };
  }

  function straighten(canvas) {
    // Estimate the tilt from how strongly dark pixels line up in rows.
    const sample = document.createElement('canvas');
    const scale = Math.min(1, 220 / canvas.width);
    sample.width = Math.round(canvas.width * scale);
    sample.height = Math.round(canvas.height * scale);
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const { width, height } = sample;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const dark = [];
    for (let y = Math.round(height * .13); y < height * .85; y += 2) {
      for (let x = Math.round(width * .12); x < width * .88; x += 2) {
        if (pixels[(y * width + x) * 4] < 105) dark.push([x - width / 2, y]);
      }
    }
    let best = 0, bestScore = 0;
    const bins = new Uint32Array(height + width);
    for (let angle = -13; angle <= 13; angle++) {
      const slope = Math.tan(angle * Math.PI / 180);
      bins.fill(0);
      for (const [x, y] of dark) bins[Math.round(y - x * slope) + Math.ceil(width / 2)]++;
      const score = bins.reduce((sum, count) => sum + count * count, 0);
      if (score > bestScore) { best = angle; bestScore = score; }
    }
    if (Math.abs(best) < 2 || dark.length < 200) return canvas;
    const output = document.createElement('canvas');
    const radians = -best * Math.PI / 180;
    output.width = Math.ceil(canvas.width * Math.cos(radians) + canvas.height * Math.abs(Math.sin(radians)));
    output.height = Math.ceil(canvas.height * Math.cos(radians) + canvas.width * Math.abs(Math.sin(radians)));
    const outputCtx = output.getContext('2d');
    outputCtx.fillStyle = '#fff';
    outputCtx.fillRect(0, 0, output.width, output.height);
    outputCtx.translate(output.width / 2, output.height / 2);
    outputCtx.rotate(radians);
    outputCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return output;
  }

  async function read(worker, source, setStatus, recognize) {
    const image = new Image();
    image.src = source.image;
    await image.decode();
    const { scale, width, height, page } = sampledPage(image);
    if (page) {
      const top = Math.max(page.top, Math.round(height * .08));
      const overlap = Math.round(width * .015);
      const rightStart = page.split - overlap;
      const leftEnd = page.split + overlap;
      const areas = [[0, top, leftEnd, page.bottom - top], [rightStart, top, width - rightStart, page.bottom - top]];
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const columns = [];
      for (const [index, area] of areas.entries()) {
        setStatus(index ? '正在识别课本右栏' : '正在识别课本左栏');
        columns.push((await recognize(straighten(preparePhotoRegion(image, area, scale)))).text.trim());
      }
      const text = columns.join(columnBreak);
      if (extract(text, source.id).length) return text;
    }
    setStatus('正在识别词表');
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    return (await recognize(preparePhotoRegion(image, [0, 0, width, height], scale))).text.trim();
  }

  return { version, extract, verify, read };
})();
