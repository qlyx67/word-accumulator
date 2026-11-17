/* Library entries use the same storage as flashcards and sentence translation. */
const VocabularyLibrary = (() => {
  const collectionId = 'personal-words';
  const sentenceKey = 'word-accumulator.translation.v1';
  const sentencesId = 'saved-sentences';
  const C = StudyPackCore;

  function read(key) {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) throw Error('词库记录无法读取，请先备份现有数据。');
    return value;
  }

  function catalog() {
    const available = [{ id: '', name: '内置 · 雅思词汇', words: builtInWords }, ...read(deckListKey)];
    const sentences = read(sentenceKey).filter(item => item?.en?.trim() && item?.zh?.trim());
    if (sentences.length) available.push({ id: sentencesId, name: '已添加的双语句子', sentences });
    return available;
  }

  function groups(library) {
    const byTopic = new Map();
    for (const item of library.sentences || library.words || []) {
      const topic = library.sentences ? '双语句子' : item.topic || library.name;
      if (!byTopic.has(topic)) byTopic.set(topic, []);
      byTopic.get(topic).push(item);
    }
    const result = [];
    for (const [topic, entries] of byTopic) {
      for (let i = 0; i < entries.length; i += groupSize) {
        result.push({
          name: topic + ' · 第 ' + (Math.floor(i / groupSize) + 1) + ' 组',
          entries: entries.slice(i, i + groupSize),
        });
      }
    }
    return result;
  }

  async function buildRows(library, groupList) {
    const kind = library.sentences ? 'sentence' : 'word';
    const entries = groupList.flatMap(group => group.entries);
    const materials = new Map();
    const sources = new Map();
    const referencesFor = async entry => {
      if (!entry.materialId || !entry.sourceRefs?.length) return [];
      if (!materials.has(entry.materialId)) {
        materials.set(entry.materialId, StudyPackStore.meta('material:' + entry.materialId));
      }
      const files = await materials.get(entry.materialId);
      const refs = [];
      for (const ref of entry.sourceRefs) {
        const source = files?.find(item => item.id === ref.sourceId);
        if (!source) continue;
        const key = entry.materialId + ':' + source.id;
        if (!sources.has(key)) {
          if (sources.size >= 30) continue;
          sources.set(key, { ...source, id: C.uid() });
        }
        refs.push({ ...ref, sourceId: sources.get(key).id });
      }
      return refs;
    };
    const rows = await Promise.all(entries.map(async entry => {
      const term = C.tidy(kind === 'sentence' ? entry.en : entry.term).slice(0, 1500);
      const meaning = C.tidy(kind === 'sentence' ? entry.zh : entry.meaning).slice(0, 1500);
      if (!term || !meaning) return null;
      return {
        id: C.uid(), kind, term, meaning,
        pos: C.tidy(entry.pos).slice(0, 1500),
        example: C.tidy(entry.example).slice(0, 1500),
        exampleZh: C.tidy(entry.exampleZh).slice(0, 1500),
        alternatives: [], enabled: true, origin: 'library', sources: await referencesFor(entry),
      };
    }));
    return { rows: C.dedupe(rows.filter(Boolean)), sources: [...sources.values()] };
  }

  function write(entries) {
    const previous = entries.map(([key]) => [key, localStorage.getItem(key)]);
    let saved = 0;
    try {
      for (const [key, value] of entries) {
        localStorage.setItem(key, JSON.stringify(value));
        saved++;
      }
    } catch (error) {
      for (const [key, value] of previous.slice(0, saved)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error;
    }
  }

  async function save(rows, target, newName, sources, materialId, newDeckId) {
    const wordsToAdd = rows.filter(row => row.enabled && row.kind === 'word');
    const sentencesToAdd = rows.filter(row => row.enabled && row.kind === 'sentence');
    if (wordsToAdd.some(row => !termPattern.test(row.term))) throw Error('请核对英文词头，单词和短语可用字母、空格、短横线与撇号。');
    if (sentencesToAdd.some(row => !row.term.trim() || !row.meaning.trim())) throw Error('请先补齐句子的英文和中文。');
    if (sources.length) await StudyPackStore.meta('material:' + materialId, sources);
    const provenance = row => sources.length && row.sources.length ?
      { materialId, sourceRefs: row.sources } : {};
    const changes = [];
    let addedWords = 0, addedSentences = 0;
    let deck;
    if (wordsToAdd.length) {
      const stored = read(deckListKey);
      const deckId = target === 'new' ? newDeckId : target;
      deck = stored.find(item => item.id === deckId);
      if (!deck) {
        if (target !== 'new' && target !== collectionId) throw Error('所选词库已经不存在，请另选一个。');
        const name = target === collectionId ? '收藏单词' : newName.trim();
        if (!name) throw Error('请为新词库填写名称。');
        deck = { id: target === collectionId ? collectionId : newDeckId || C.uid(), name, words: [] };
        stored.push(deck);
      }
      const existing = new Map(deck.words.map(word => [C.normalize(word.term), word]));
      for (const row of wordsToAdd) {
        const key = C.normalize(row.term);
        const word = existing.get(key);
        if (word) {
          // Fill missing details without changing the word's identity or saved progress.
          const senses = (word.meaning || '').split(/[；;]/).map(sense => sense.trim()).filter(Boolean);
          const known = new Set(senses.map(C.normalize));
          for (const meaning of row.meaning.split(/[；;]/)) {
            const key = C.normalize(meaning);
            if (!key || known.has(key)) continue;
            senses.push(meaning.trim());
            known.add(key);
          }
          word.meaning = senses.join('；').slice(0, 1500);
          word.pos ||= row.pos;
          if (!word.example && row.example) {
            word.example = row.example;
            word.exampleZh = row.exampleZh;
          }
          continue;
        }
        const entry = {
          term: row.term, meaning: row.meaning, pos: row.pos, example: row.example,
          exampleZh: row.exampleZh, topic: deck.name, ...provenance(row),
        };
        deck.words.push(entry);
        existing.set(key, entry);
        addedWords++;
      }
      changes.push([deckListKey, stored]);
    }
    if (sentencesToAdd.length) {
      const stored = read(sentenceKey);
      const key = (en, zh) => JSON.stringify([C.normalize(en), C.normalize(zh)]);
      const pairs = new Set(stored.map(item => key(item.en, item.zh)));
      for (const row of sentencesToAdd) {
        const pair = key(row.term, row.meaning);
        if (pairs.has(pair)) continue;
        stored.push({ id: C.uid(), en: row.term, zh: row.meaning, source: 'en', ...provenance(row) });
        pairs.add(pair);
        addedSentences++;
      }
      changes.push([sentenceKey, stored]);
    }
    write(changes);
    if (deck) {
      const option = [...deckSelect.options].find(item => item.value === deck.id) || new Option('', deck.id);
      option.textContent = deck.name + ' · ' + deck.words.length + ' 词';
      if (!option.parentNode) deckSelect.add(option);
    }
    document.dispatchEvent(new Event('vocabulary-library-changed'));
    return { deck, addedWords, addedSentences };
  }

  function openDeck(id) {
    if (id === collectionId) {
      if (activeDeck?.id !== id) {
        document.dispatchEvent(new CustomEvent('studio-navigate', { detail: 'collection' }));
        document.querySelector('[data-collection="word"]').click();
        return;
      }
    }
    localStorage.setItem(deckSelectionKey, id);
    try { sessionStorage.setItem('word-accumulator.next-view', 'browse'); } catch {}
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  return { catalog, groups, buildRows, save, openDeck, sentencesId, collectionId };
})();
