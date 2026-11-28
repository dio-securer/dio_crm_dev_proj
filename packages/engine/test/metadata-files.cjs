// Reads the repository's metadata/ folder as { path, content } pairs (the engine itself does no IO).
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../../..');
function readMetadata() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else out.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') });
    }
  };
  walk('metadata');
  return out;
}
/** The metadata files with the JSON file at `file` changed by `edit`. */
function editJson(files, file, edit) {
  return files.map(f => {
    if (f.path !== file) return f;
    const doc = JSON.parse(f.content);
    edit(doc);
    return { ...f, content: JSON.stringify(doc) };
  });
}
module.exports = { readMetadata, editJson };
