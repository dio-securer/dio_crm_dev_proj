// Trial fixtures for the text rules G04 (Hangul in code) and G05 (raw colours). See index.mjs for the format.
// A value written as [text, n] also states how many findings the file must have.
const WORD = String.fromCharCode(0xC800, 0xC7A5); // two Hangul syllables
const JAMO = String.fromCharCode(0x314B); // a single Hangul letter, outside the syllable block
const CJK = String.fromCharCode(0x4FDD, 0x5B58); // not Hangul
const BACKSLASH = String.fromCharCode(92);

export const g04 = {
  id: 'G04',
  fail: {
    // Part 1, the existing check: every line of a frontend .tsx with Hangul, comments included.
    'frontend/src/feature/Screen.tsx': [
      `export const A = () => <p>${WORD}</p>;\n// ${WORD}\nexport const b = '${WORD}' + "${WORD}";\nexport const c = 1;\n`, 3],
    'frontend/src/deep/er/folder/Nested.tsx': `export const N = () => <b title="${WORD}" />;\n`,
    // Part 2, the new zones, read from the syntax tree.
    'extensions/acme/label.ts': `export const label = '${WORD}';\n`,
    'packages/engine/src/template.ts': `export const count = (n: number) => \`\${n} ${WORD}\`;\n`,
    'packages/engine-ui/src/View.tsx': `export const V = () => <b>${WORD}</b>;\n`,
    'extensions/acme/escaped.ts': `export const s = '${BACKSLASH}uD55C';\n`,
    'extensions/acme/entity.tsx': 'export const E = () => <i>&#xD55C;</i>;\n',
    'extensions/acme/decimal.tsx': 'export const E = () => <i>&#54620;</i>;\n',
    'extensions/acme/name.ts': `export const ${WORD} = 1;\n`,
    'extensions/acme/pattern.ts': `export const re = /${WORD}/;\n`,
    'extensions/acme/letter.mjs': `export const s = "${JAMO}";\n`,
    'extensions/acme/second-line.ts': [`export const s = \`a\n${WORD}\n${WORD}\`;\n`, 2],
    'extensions/acme/label.test.ts': `export const label = '${WORD}';\n`,
  },
  pass: {
    'extensions/acme/g04-comment.ts': `// ${WORD}\nexport const a = 1; /* ${WORD} */\n`,
    'extensions/acme/g04-other.ts': `export const a = 'Save'; export const b = '${CJK}';\n`,
    'extensions/acme/g04-notes.md': `${WORD}\n`,
    'frontend/src/feature/g04-labels.ts': `export const label = '${WORD}';\n`,
    'frontend/src/feature/g04-Plain.tsx': 'export const P = () => <p>Save</p>;\n',
    'backend/src/svc/g04-message.ts': `export const message = '${WORD}';\n`,
  },
};

const HEX = '#';
const css = value => `a { color: ${value}; }\n`;
const fn = name => `${name}(0 0 0)`;
export const g05 = {
  id: 'G05',
  fail: {
    'ui/three.css': css(`${HEX}fff`),
    'ui/four.tsx': `export const c = '${HEX}abcd';\n`,
    'ui/six.scss': css(`${HEX}FFFFFF`),
    'ui/eight.ts': `export const c = "${HEX}ffffff80";\n`,
    'ui/rgb.js': `export const c = '${fn('rgb')}';\n`,
    'ui/rgba.jsx': `export const c = '${'rgba'} (0, 0, 0, .5)';\n`,
    'ui/hsl.css': css(fn('hsl')),
    'ui/hsla.css': css(fn('hsla')),
    'ui/hwb.css': css(fn('hwb')),
    'ui/oklab.css': css(fn('oklab')),
    'ui/oklch.css': css(fn('oklch')),
    'ui/upper.css': css(fn('RGB')),
    'ui/twice.css': [`a { color: ${HEX}fff; background: ${fn('rgb')}; }\n`, 2],
    'tests/ui/colour.test.ts': `export const c = '${HEX}fff';\n`,
    // Only frontend/src/styles/tokens.css may define colours; a file of the same name elsewhere may not.
    'frontend/src/theme/tokens.css': css(`${HEX}0af`),
  },
  pass: {
    'ui/g05-token.css': css('var(--brand)'),
    'ui/g05-entity.tsx': 'export const E = () => <i>&#123;</i>;\n',
    'ui/g05-anchor.ts': `export const a = 'page${HEX}add'; export const b = '${HEX}12';\n`,
    'ui/g05-length.ts': `export const c = '${HEX}fffff'; export const d = '${HEX}fff-x';\n`,
    'ui/g05-names.css': 'a { color: argb(1); background: rgbx(1); }\n',
    'ui/g05-notes.md': `${HEX}fff ${fn('rgb')}\n`,
  },
};
