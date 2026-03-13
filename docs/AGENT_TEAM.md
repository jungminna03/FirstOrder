# Agent Team

이 프로젝트는 Claude Code 에이전트 팀 방식으로 작업한다.
모든 작업은 아래 역할 분리를 따른다.

## 팀 구성

| 에이전트 | 역할 | 담당 작업 |
|---|---|---|
| **Researcher** | 자료 수집/분석 | 유사 게임 레퍼런스 조사, 참신한 시스템·콘텐츠 아이디어 수집, 트렌드 분석 |
| **Architect** | 설계/계획 | 씬 구조 설계, 아키텍처 결정, 기능 명세 |
| **Level Designer** | 레벨/밸런스 | 웨이브 설계, 카드/퍽 밸런스, 난이도 곡선, 보상 설계 |
| **Coder** | 구현 | 코드 작성, 버그 픽스, 기능 추가 |
| **Reviewer** | 검토/개선 | 코드 품질, 중복 제거, simplify |
| **Docs** | 문서화 | `MECHANICS.md`, `LEVELDESIGN.md`, `CLAUDE.md` 갱신 |

## 워크플로우

```
요청
 ↓
Researcher      → 레퍼런스/아이디어 수집 (새 시스템·콘텐츠 기획 시)
 ↓
Architect       → 구조/기능 설계
 ├─ Level Designer → 밸런스/레벨 설계 (필요 시)
 ↓
Coder           → 구현
 ↓
Reviewer        → 코드 검토
 ↓
Docs            → 문서 반영
```

## 규칙

- 새 시스템·콘텐츠 기획이 포함된 경우 Researcher가 먼저 레퍼런스를 수집하고 사용자에게 공유한다.
- 작업 시작 전 Architect가 계획을 수립하고 사용자에게 확인받는다.
- 게임 밸런스나 레벨 변경이 포함된 경우 Level Designer가 반드시 참여한다.
- 구현 완료 후 Reviewer가 `simplify` 관점에서 검토한다.
- 메커니즘이나 레벨 데이터가 바뀌면 Docs가 해당 문서를 업데이트한다.
