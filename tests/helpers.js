// Small browser fixtures; API calls are always stubbed by each test.
export function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}
export function tokenFor(sub = "fixture") {
  return `e30.${Buffer.from(JSON.stringify({sub, exp: Math.floor(Date.now() / 1000) + 3600})).toString("base64url")}.sig`;
}
export function fakeDocument(ids) {
  const elements = new Map(ids.map((id) => [id, {
    value: "", textContent: "", innerHTML: "", disabled: false, hidden: false,
    style: {}, classList: { remove() {}, add() {} },
    focus() { document.activeElement = this; }, querySelector() { return null; }
  }]));
  globalThis.document = {
    body: { classList: { remove() {}, add() {} } },
    getElementById: (id) => elements.get(id) ?? null,
    querySelectorAll: () => []
  };
  return (id) => elements.get(id);
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
