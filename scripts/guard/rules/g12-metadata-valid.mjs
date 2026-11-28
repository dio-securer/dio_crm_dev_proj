import g01 from './g01-metadata-only-config.mjs';
import { METADATA_DIR, VALIDATOR_DIR, isMetadataContent, issueText, loadMetamodel } from '../lib/metamodel.mjs';

/** The metadata file an issue points at, or the folder itself for issues about the bundle as a whole. */
// Owned by other rules, so not reported twice: the file size (G03 has the same limits).
const OWNED_ELSEWHERE = ['F04_TOO_LARGE'];

const fileOf = item => (item.path.startsWith(METADATA_DIR) ? item.path.split('#')[0] : METADATA_DIR);

export default {
  id: 'G12',
  name: 'metadata-valid',
  baseline: 'none',
  forbids: '`metadata/` 의 설정이 메타모델 검사(`bundleFromFiles` + `validateBundle`)를 통과하지 못하는 것. 자리가 틀린 파일, 형식이 틀린 값, 없는 개체·필드·코드·번역을 가리키는 참조가 모두 해당된다.',
  why: 'AI는 없는 필드나 번역 키를 그럴듯하게 지어낸다. 설정은 코드처럼 컴파일되지 않으므로 저장하는 순간 기계가 막아야 한다.',
  fix: '메시지의 검사 코드(F01, M01, R02 …)를 `docs/framework/metamodel.md` 에서 찾아 설정을 고친다. 필드를 지우려면 먼저 폐기 예정(`deprecated`)으로 둔다.',
  scope: `\`metadata/\` 아래 README.md 와 .gitkeep 을 뺀 모든 파일(추적 전 파일 포함). 검사기는 이 저장소의 \`${VALIDATOR_DIR}\` 를 그대로 쓴다.`,
  exclusions: [
    'G01 이 이미 보고한 파일(코드 파일, JSON 으로 읽히지 않는 파일)은 검사기에 넣지 않고 다시 보고하지 않는다.',
    '파일 크기(F04)는 G03 이 같은 한도로 보므로 다시 보고하지 않는다.','severity 가 warning 인 결과(예: 폐기 예정 필드를 새 자리에 씀)는 실패로 세지 않는다.'],
  limits: [
    '검사기 자체가 약해지면 이 규칙도 약해진다. 검사기 폴더는 보호 경로라 바꾸면 사람 확인(P4)에 나온다.',
    '기준 브랜치와의 하위 호환(필드 삭제·이름 변경·형식 변경)은 이 규칙이 아니라 보호 검사 P6 이 본다.',
    'metadata/ 에 설정 파일이 하나도 없으면 검사기를 읽지 않고 통과한다.',
  ],
  check(ctx) {
    const notConfig = new Set(g01.check(ctx).map(finding => finding.file));
    const files = ctx.files.filter(file => isMetadataContent(file) && !notConfig.has(file));
    if (files.length === 0) return [];
    const api = loadMetamodel(ctx.root);
    const input = files.map(file => ({ path: file, content: ctx.read(file) }));
    const result = api.bundleFromFiles(input);
    const issues = result.bundle ? [...result.issues, ...api.validateBundle(result.bundle)] : result.issues;
    const errors = issues.filter(item => item.severity === 'error' && !OWNED_ELSEWHERE.includes(item.code));
    return errors.map(item => ({ file: fileOf(item), line: 0, message: issueText(item) }));
  },
};
