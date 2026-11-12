/* Atomic IndexedDB saves with revision checks; no network or account implied. */
const StudyPackStore = (() => {
  let connection;
  function db() {
    return connection ||= new Promise((resolve, reject) => {
      const req = indexedDB.open('word-accumulator-packs', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('packs', { keyPath: 'id' }); req.result.createObjectStore('meta'); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); connection = null; }; resolve(req.result); };
      req.onerror = () => { connection = null; reject(Error('无法打开本地存储，请检查浏览器权限。')); };
    });
  }
  async function all() {
    const d = await db();
    return new Promise((resolve, reject) => { const r = d.transaction('packs').objectStore('packs').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  }
  async function save(pack) {
    const clean = StudyPackCore.validatePack(pack), d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('packs', 'readwrite'), store = tx.objectStore('packs');
      let saved, message;
      const request = store.get(clean.id);
      request.onsuccess = () => {
        if (request.result && request.result.revision !== clean.revision) { message = '另一个页面已更新这个学习包。请刷新页面后继续，避免覆盖新进度。'; tx.abort(); return; }
        saved = { ...clean, revision: (clean.revision || 0) + 1, updatedAt: Date.now() };
        store.put(saved);
      };
      tx.oncomplete = () => { window.dispatchEvent(new Event('packs-saved')); resolve(saved); };
      tx.onabort = tx.onerror = () => reject(Error(message || '保存失败，可能存储空间不足。请先导出备份。'));
    });
  }
  async function meta(key, value) {
    const d = await db(), write = arguments.length > 1;
    return new Promise((resolve, reject) => {
      const tx = d.transaction('meta', write ? 'readwrite' : 'readonly');
      const r = write ? tx.objectStore('meta').put(value, key) : tx.objectStore('meta').get(key);
      let result; r.onsuccess = () => { result = r.result; };
      tx.oncomplete = () => resolve(result); tx.onabort = tx.onerror = () => reject(Error('草稿保存失败，请先复制文字留存。'));
    });
  }
  return { all, save, meta };
})();
