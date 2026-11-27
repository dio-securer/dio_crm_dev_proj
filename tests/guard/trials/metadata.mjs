// Trial fixtures for G12 (metadata/ must load and validate). See index.mjs for the format.
// All failing files are written at once, so these are the load-time defects (F01, F02, M01) that are reported per file.
// Cross-reference defects (R01-R10) need a bundle that loads; they are tried one by one in metadata.test.mjs.
export const g12 = {
  id: 'G12',
  fail: {
    // G01 accepts all of these (allowed extension, readable JSON); they are still not files of the metadata layout.
    'metadata/objects/g01-lead.json': '{ "name": "lead" }\n',
    'metadata/g01-a.yaml': 'a: 1\n',
    'metadata/g01-b.yml': 'b: 1\n',
    'metadata/G01-UPPER.JSON': '[1]\n',
    'metadata/a/b/c/d/e/f/g01-deep.yml': 'a: 1\n',
    'metadata/g01-number.json': '1\n',
    'metadata/codes/g12_named.json': '{ "key": "another_name", "values": [] }\n',
    'metadata/objects/g12_thing/object.json': '{ "key": "g12_thing" }\n',
    'metadata/terms/xx-XX/g12.json': '{ "g12.a": "a" }\n',
    'metadata/menu.json': '{ "nodes": "not a list" }\n',
  },
  pass: {
    'metadata/codes/g12_code.json': '{ "key": "g12_code", "values": [] }\n',
    'metadata/terms/ko-KR/g12.json': '{ "g12.unused": "x" }\n',
    'metadata/terms/en-US/g12.json': '{ "g12.unused": "x" }\n',
    'metadata/g12/README.md': '# notes\n',
  },
};
