/* On-site English–Chinese definitions, with optional online examples. */
const WordDictionary = (() => {
  const shards = new Map();
  const cache = new Map();
  const chinese = /\p{Script=Han}/u;
  const normalize = term => term.normalize('NFKC').trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase();
  const examples = {
    accumulate: ['Dust can accumulate on the shelves.', '灰尘会在架子上积聚。'],
    apple: ['She put an apple in her bag.', '她把一个苹果放进包里。'],
    capture: ['I wanted to capture the light just before sunset.', '我想拍下日落前的光线。'],
    counterintuitive: ['The result may seem counterintuitive at first.', '这个结果起初可能看起来有悖直觉。'],
    hello: ['She smiled and said hello.', '她笑了笑，打了声招呼。'],
    hesitate: ['Don’t hesitate to ask if you need help.', '如果需要帮助，别犹豫，尽管开口。'],
    interstellar: ['The probe sent back data from interstellar space.', '探测器从星际空间发回了数据。'],
    photosynthesis: ['Plants use sunlight during photosynthesis.', '植物在光合作用过程中利用阳光。'],
    plot: ['The plot of the film takes an unexpected turn.', '这部电影的情节出现了意想不到的转折。'],
    resilience: ['Her resilience helped her get through a difficult year.', '她凭借自己的韧性度过了艰难的一年。'],
    run: ['I run along the river every morning.', '我每天早上沿着河边跑步。'],
    serendipity: ['We met again by pure serendipity.', '我们再次相遇，纯属机缘巧合。'],
    sustainable: ['The city is investing in sustainable transport.', '这座城市正在投资可持续交通。']
  };
  const supplemental = {
    capture: ['ˈkæptʃə', [['n.', ['捕获；被捕获之物']], ['vt.', ['捕获；拍摄，记录；吸引（注意）']]]],
    photosynthesis: ['ˌfəʊtəʊˈsɪnθəsɪs', [['n.', ['光合作用']]]],
    interstellar: ['ˌɪntəˈstelə', [['adj.', ['星际的；恒星之间的']]]],
    resilience: ['rɪˈzɪliəns', [['n.', ['韧性；恢复能力；弹性']]]],
    serendipity: ['ˌserənˈdɪpəti', [['n.', ['机缘巧合；意外发现美好事物的运气']]]],
    counterintuitive: ['ˌkaʊntərɪnˈtjuːɪtɪv', [['adj.', ['反直觉的；与直觉相悖的']]]]
  };

  async function request(url, signal, timeout = 2200) {
    if (signal?.aborted) return null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, referrerPolicy: 'no-referrer' });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function getLocal(term) {
    const first = term[0];
    const shard = first <= 'f' ? 'a-f' : first <= 'l' ? 'g-l' : first <= 'r' ? 'm-r' : 's-z';
    if (!shards.has(shard)) {
      shards.set(shard, request('dictionary/' + shard + '.json?v=1', undefined, 4500).then(data => {
        if (!data) shards.delete(shard);
        return data;
      }));
    }
    const data = await shards.get(shard);
    const original = originalWords.get(term);
    const [phonetic, definitions] = (Object.hasOwn(supplemental, term) && supplemental[term]) ||
      (data && Object.hasOwn(data, term) && data[term]) || [];
    const hasChinese = chinese.test(original?.meaning || '');
    const localExample = Object.hasOwn(examples, term) && examples[term];
    const example = localExample ? {
      example: localExample[0], exampleZh: localExample[1]
    } : {
      example: original?.example || extraExamples[original?.term] || '',
      exampleId: original?.exampleId, exampleAuthor: original?.exampleAuthor
    };
    const pos = definitions?.filter(([label]) => label.endsWith('.')).map(([label]) => label).join(' / ');
    return {
      term, phonetic, definitions,
      pos: pos || original?.pos || '',
      meaning: definitions?.filter(([label]) => !label.startsWith('[')).map(([, senses]) => senses.join('；')).join('；') ||
        definitions?.flatMap(([, senses]) => senses).join('；') || (hasChinese ? original.meaning : ''),
      englishMeaning: hasChinese ? '' : original?.meaning,
      ...example
    };
  }

  async function englishEntry(term, signal) {
    const data = await request('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(term), signal);
    if (!Array.isArray(data)) return {};
    const meanings = data.flatMap(entry => entry.meanings || []);
    const first = meanings[0];
    const definition = first?.definitions?.[0]?.definition;
    const phonetics = data.flatMap(entry => entry.phonetics || []);
    const sound = accent => phonetics.find(item => item.audio?.split(/[?#]/)[0].endsWith('-' + accent + '.mp3'));
    const us = sound('us');
    const uk = sound('uk');
    return {
      definition, partOfSpeech: first?.partOfSpeech,
      example: meanings.flatMap(item => item.definitions || []).find(item => item.example)?.example,
      phonetic: data.find(entry => entry.phonetic)?.phonetic || phonetics.find(item => item.text)?.text,
      phoneticUs: us?.text, phoneticUk: uk?.text
    };
  }

  async function bilingualExample(term, signal) {
    const params = new URLSearchParams({
      lang: 'eng', q: '"' + term + '"', sort: 'relevance', word_count: '4-16', limit: '8',
      'trans:lang': 'cmn', 'trans:is_direct': 'yes', 'trans:is_unapproved': 'no',
      'showtrans:lang': 'cmn', 'showtrans:is_direct': 'yes', is_unapproved: 'no'
    });
    const response = await request('https://api.tatoeba.org/v1/sentences?' + params, signal);
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
    const exact = new RegExp('\\b' + escaped + '\\b', 'i');
    const sentences = Array.isArray(response?.data) ? response.data : [];
    for (const item of sentences) {
      const translation = item.translations?.find(entry => entry.lang === 'cmn' &&
        entry.owner && !entry.is_unapproved && chinese.test(entry.text || ''));
      if (item.owner && item.id && exact.test(item.text || '') && translation?.id) {
        return {
          example: item.text, exampleId: item.id, exampleAuthor: item.owner,
          exampleZh: translation.text, exampleZhId: translation.id, exampleZhAuthor: translation.owner
        };
      }
    }
    return {};
  }

  async function translateToChinese(text, signal) {
    const q = Array.from(text).slice(0, 150).join('');
    const params = new URLSearchParams({ q, langpair: 'en|zh-CN' });
    const data = await request('https://api.mymemory.translated.net/get?' + params, signal);
    const translation = data?.responseStatus === 200 && data.responseData?.translatedText;
    return typeof translation === 'string' && chinese.test(translation) ? translation : '';
  }

  async function lookup(term, signal, onUpdate = () => {}) {
    const key = normalize(term);
    if (!termPattern.test(key) || key.length > 90 || signal?.aborted) return null;
    if (cache.has(key)) return cache.get(key);
    const entry = await getLocal(key);
    if (signal?.aborted) return null;
    onUpdate(entry);
    const englishTask = (!entry.meaning || !entry.example) && englishEntry(key, signal).then(english => {
      if (signal?.aborted || !english.definition) return;
      entry.phonetic ||= english.phonetic;
      entry.phoneticUs = english.phoneticUs;
      entry.phoneticUk = english.phoneticUk;
      entry.pos ||= english.partOfSpeech || '';
      entry.englishMeaning = english.definition;
      entry.example ||= english.example || '';
      onUpdate(entry);
    });
    const exampleTask = !entry.exampleZh && bilingualExample(key, signal).then(example => {
      if (signal?.aborted || !example.exampleZh) return;
      Object.assign(entry, example);
      onUpdate(entry);
    });
    await Promise.all([englishTask, exampleTask]);
    if (signal?.aborted) return null;
    const [translatedMeaning, translatedExample] = await Promise.all([
      !entry.meaning && (entry.englishMeaning || entry.exampleZh) ? translateToChinese(entry.englishMeaning || key, signal) : '',
      !entry.exampleZh && entry.example ? translateToChinese(entry.example, signal) : ''
    ]);
    if (signal?.aborted) return null;
    if (translatedMeaning) {
      entry.meaning = translatedMeaning;
      entry.translated = true;
    }
    if (translatedExample) {
      entry.exampleZh = translatedExample;
      entry.exampleMachineTranslated = true;
    }
    if (entry.meaning && entry.exampleZh) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
    }
    return entry;
  }

  function fill(row, entry) {
    if (!entry) return;
    for (const key of ['pos', 'meaning', 'phonetic', 'phoneticUs', 'phoneticUk']) {
      if (!row[key] && entry[key]) row[key] = entry[key];
    }
    if (!row.example && entry.example) {
      for (const key of ['example', 'exampleZh', 'exampleId', 'exampleAuthor', 'exampleZhId', 'exampleZhAuthor', 'exampleMachineTranslated']) {
        if (entry[key]) row[key] = entry[key];
      }
    }
  }

  return { lookup, local: term => getLocal(normalize(term)), normalize, fill };
})();
