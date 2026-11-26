import { extOf } from '../lib/files.mjs';

const ALLOWED = ['.json', '.yaml', '.yml', '.md'];

export default {
  id: 'G01',
  name: 'metadata-only-config',
  baseline: 'none',
  forbids: '`metadata/` 아래에 설정 파일이 아닌 것(코드·스크립트·스타일 등)을 두는 것. 허용 확장자는 .json .yaml .yml .md 와 `.gitkeep` 뿐이다. .json 은 JSON 으로 읽혀야 한다.',
  why: 'AI는 급하면 설정 구역에 코드를 끼워 넣는다. 설정과 코드가 섞이면 "설정만 바꿔서 화면을 만든다"는 전제가 깨진다.',
  fix: '코드는 `packages/engine`(공통) 또는 `extensions/<이름>`(회사별)으로 옮기고, `metadata/` 에는 값만 남긴다.',
  scope: '`metadata/` 아래 모든 파일(하위 폴더 포함, 추적 전 파일 포함).',
  exclusions: [],
  limits: ['YAML 은 문법 검사를 하지 않는다(의존성 0 원칙). 확장자만 본다.', '허용 확장자 안에 문자열로 숨긴 코드는 잡지 못한다.'],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!file.startsWith('metadata/')) continue;
      const base = file.slice(file.lastIndexOf('/') + 1);
      if (base === '.gitkeep') continue;
      const ext = extOf(file);
      if (!ALLOWED.includes(ext)) {
        findings.push({ file, line: 0, message: `허용되지 않는 파일 형식 "${ext || base}" (허용: ${ALLOWED.join(' ')})` });
      } else if (ext === '.json') {
        try { JSON.parse(ctx.read(file)); } catch (error) { findings.push({ file, line: 0, message: `JSON 으로 읽히지 않음: ${error.message.slice(0, 60)}` }); }
      }
    }
    return findings;
  },
};
