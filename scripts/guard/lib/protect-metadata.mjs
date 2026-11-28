// P6: backward compatibility of metadata/ against the base (ADR 0004). Both sides are read with the HEAD validator.
// Only a row access widening (D05) can be declared, rule by rule, after a person approves it (ADR 0007).
// Everything else cannot: removing or renaming a field takes a deprecation first, and unreadable metadata is never excused.
import { METADATA_DIR, isMetadataContent, issueText, loadMetamodel } from './metamodel.mjs';
import { canonical } from './raises.mjs';

const id = 'P6';
const name = 'metadata-compat';
const baseValue = () => undefined;
const fail = text => ({ id, name, status: 'FAIL', violations: [{ file: METADATA_DIR, text, declare: null }], baseValue });
const WIDENED = /^objects\[([a-z][a-z0-9_]*)\]\/access\/rules\[#(\d+)\]$/;

/** The declaration that excuses one D05 issue: the object's access.json and the widened head rule, exactly. */
function declareOf(item, head) {
  const hit = item.code === 'D05_ACCESS_WIDENED' ? WIDENED.exec(item.path) : null;
  const rule = hit ? head.objects.find(ob => ob.object.key === hit[1])?.access?.rules[Number(hit[2])] : undefined;
  return rule ? { rule: id, file: `${METADATA_DIR}objects/${hit[1]}/access.json`, from: null, to: { ...rule } } : null;
}

/** The declared rule when the base already has it, so an unused P6 declaration is reported as already merged. */
function baseRuleOf(bundle) {
  return entry => {
    const rules = bundle.objects.find(ob => `${METADATA_DIR}objects/${ob.object.key}/access.json` === entry.file)?.access?.rules ?? [];
    return rules.find(rule => canonical(rule) === canonical(entry.to));
  };
}

/** `base` is a baseReader, `ctx` the working-tree context. */
export function p6(root, base, ctx) {
  const baseFiles = base.files.filter(file => file.startsWith(METADATA_DIR));
  if (!baseFiles.some(isMetadataContent)) {
    return { id, name, status: 'PASS', note: '기준 커밋의 metadata/ 에 설정 파일이 없어 비교할 것이 없습니다.', violations: [], baseValue };
  }
  const api = loadMetamodel(root);
  const before = api.bundleFromFiles(baseFiles.map(file => ({ path: file, content: base.read(file) })));
  if (!before.bundle) return fail(`기준 커밋의 metadata/ 를 지금 검사기로 읽을 수 없어 비교하지 못했습니다: ${issueText(before.issues[0])}`);
  const headFiles = ctx.files.filter(file => file.startsWith(METADATA_DIR));
  const after = api.bundleFromFiles(headFiles.map(file => ({ path: file, content: ctx.read(file) })));
  if (!after.bundle) return fail(`지금의 metadata/ 를 읽을 수 없어 비교하지 못했습니다(G12 참고): ${issueText(after.issues[0])}`);
  const violations = api.diffBundles(before.bundle, after.bundle).filter(item => item.severity === 'error')
    .map(item => ({ file: METADATA_DIR, text: `하위 호환이 깨졌습니다. ${issueText(item)}`, declare: declareOf(item, after.bundle) }));
  const note = violations.length ? '' : '기준 커밋과 비교해 하위 호환이 깨진 곳이 없습니다.';
  return { id, name, status: violations.length ? 'FAIL' : 'PASS', note, violations, baseValue: baseRuleOf(before.bundle) };
}
