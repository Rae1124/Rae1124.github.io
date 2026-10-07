const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function loadClient(dom, entryPath) {
  const modules = new Map();
  const context = dom.getInternalVMContext();
  function getModule(filename) {
    const absolutePath = path.resolve(filename);
    if (!modules.has(absolutePath)) {
      modules.set(
        absolutePath,
        new vm.SourceTextModule(fs.readFileSync(absolutePath, 'utf8'), {
          context,
          identifier: absolutePath,
        }),
      );
    }
    return modules.get(absolutePath);
  }
  async function importModule(filename) {
    const module = getModule(filename);
    if (module.status === 'unlinked') {
      await module.link((specifier, parent) =>
        getModule(path.resolve(path.dirname(parent.identifier), specifier)),
      );
    }
    if (module.status === 'linked') await module.evaluate();
    return module.namespace;
  }
  if (entryPath.endsWith('.html')) {
    const html = fs.readFileSync(entryPath, 'utf8');
    const script = html.match(/<script type="module" src="([^"]+)"/);
    if (!script) throw Error('Module entry missing from ' + entryPath);
    entryPath = path.resolve(path.dirname(entryPath), script[1]);
  }
  await importModule(entryPath);
  return { importModule };
}

module.exports = { loadClient };
