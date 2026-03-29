// Shared Chrome API mock for extension tests.
// Sets up globalThis.chrome with in-memory storage, message passing, and tab queries.

export function createChromeMock(options = {}) {
  const store = {};
  const messages = [];
  const tabUrl = options.tabUrl || 'https://example.com/article';
  const tabTitle = options.tabTitle || 'Example Article';

  const chrome = {
    storage: {
      sync: {
        get(keys) {
          return new Promise((resolve) => {
            if (typeof keys === 'string') {
              resolve({ [keys]: store[keys] });
            } else if (Array.isArray(keys)) {
              const result = {};
              for (const k of keys) result[k] = store[k];
              resolve(result);
            } else {
              resolve({ ...store });
            }
          });
        },
        set(items) {
          return new Promise((resolve) => {
            Object.assign(store, items);
            resolve();
          });
        },
        remove(keys) {
          return new Promise((resolve) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) delete store[k];
            resolve();
          });
        },
      },
    },
    runtime: {
      sendMessage(msg) {
        messages.push(msg);
        return Promise.resolve();
      },
      onMessage: {
        addListener() {},
      },
    },
    tabs: {
      query() {
        return Promise.resolve([{ url: tabUrl, title: tabTitle }]);
      },
    },
  };

  return { chrome, store, messages };
}

export function installChromeMock(options) {
  const mock = createChromeMock(options);
  globalThis.chrome = mock.chrome;
  return mock;
}
