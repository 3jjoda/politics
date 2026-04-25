// balanceGameMockQuestions.js — Phase 1 MVP 문항 20개 mock
//
// BALANCEGAME.md §9 의 초안 그대로. DB 시드 전 화면 골격 검증용.
// 문항·매핑이 확정되면 balance_game_questions 테이블로 이전.

export const MAPPING_VERSION = 'v1';

export const AXES = {
    economy:     { label: '경제',       left: '시장 자율',     right: '정부 개입' },
    social:      { label: '사회·문화',   left: '전통·질서',     right: '자율·다양성' },
    security:    { label: '안보·외교',   left: '동맹·대북강경', right: '자주·대북대화' },
    institution: { label: '정치제도',     left: '안정·기존질서', right: '개혁·재편' }
};

// 각 항목:
//   id, axis, prompt (양측 맥락), options: [{id:'A', text, score}, {id:'B', text, score}, {id:'C', text:'잘 모르겠다', score: 0}]
//   score 의 부호는 BALANCEGAME §5 매핑 기준 — 축의 우측(개입/자율/자주/개혁) 이 +1, 좌측이 -1
export const QUESTIONS = [
    /* 경제 축 (5문항, 반전 2개: q2·q4) */
    {
        id: 'q1', axis: 'economy',
        prompt: '최저임금이 빠르게 오르면 저임금 노동자의 생활은 안정되지만, 자영업자·소상공인의 인건비 부담이 커집니다. 어느 쪽을 더 중요하게 보세요?',
        options: [
            { id: 'A', text: '노동자 생활 안정', score: +1 },
            { id: 'B', text: '자영업자 부담 완화', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q2', axis: 'economy',
        prompt: '다주택자에게 무거운 세금을 매기면 투기는 줄지만, 임대 시장이 위축돼 세입자가 집을 구하기 어려워질 수 있습니다.',
        options: [
            { id: 'A', text: '세 부담 완화로 시장 활성화', score: -1 },
            { id: 'B', text: '다주택 중과로 투기 억제', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q3', axis: 'economy',
        prompt: '대기업 규제를 강화하면 중소기업·소비자 보호는 강해지지만, 대기업의 투자·고용은 위축될 수 있습니다.',
        options: [
            { id: 'A', text: '규제 강화로 공정 시장', score: +1 },
            { id: 'B', text: '규제 완화로 투자 활성화', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q4', axis: 'economy',
        prompt: '주 52시간을 엄격히 적용하면 노동자 건강은 보호되지만, 업종별 특성에 따른 유연한 근무가 어려워집니다.',
        options: [
            { id: 'A', text: '업종별 유연 근무 허용', score: -1 },
            { id: 'B', text: '52시간 엄격 적용', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q5', axis: 'economy',
        prompt: '공공병원·의대 정원을 늘리면 의료 접근성은 개선되지만, 민간 의료의 자율성과 의사 처우 협상력이 약화될 수 있습니다.',
        options: [
            { id: 'A', text: '공공의료 확대', score: +1 },
            { id: 'B', text: '민간 자율 유지', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },

    /* 사회·문화 축 (5문항, 반전 2개: q8·q9) */
    {
        id: 'q6', axis: 'social',
        prompt: '차별금지법이 제정되면 소수자의 권리는 강화되지만, 종교·사상의 자유 표현이 제약될 수 있다는 우려가 있습니다.',
        options: [
            { id: 'A', text: '제정해야 한다', score: +1 },
            { id: 'B', text: '신중해야 한다', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q7', axis: 'social',
        prompt: '동성결혼을 법적으로 인정하면 소수자 권리는 보장되지만, 전통적 가족 제도 변화에 사회적 합의가 필요하다는 의견도 있습니다.',
        options: [
            { id: 'A', text: '법적 인정', score: +1 },
            { id: 'B', text: '사회적 합의가 우선', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q8', axis: 'social',
        prompt: '사형제는 흉악범죄 억제 효과가 있다는 입장과, 인권·오판 가능성 측면에서 폐지해야 한다는 입장이 맞섭니다.',
        options: [
            { id: 'A', text: '유지·집행 재개', score: -1 },
            { id: 'B', text: '폐지', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q9', axis: 'social',
        prompt: '청소년 게임 시간·콘텐츠를 국가가 규제하면 보호 효과는 있지만, 청소년·보호자의 자율 판단을 제약합니다.',
        options: [
            { id: 'A', text: '보호 위해 규제 강화', score: -1 },
            { id: 'B', text: '자율 판단 존중', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q10', axis: 'social',
        prompt: '마약 사용자를 처벌 위주로 다룰지, 의료·재활 모델로 다룰지 의견이 갈립니다.',
        options: [
            { id: 'A', text: '의료·재활 중심', score: +1 },
            { id: 'B', text: '처벌 강화', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },

    /* 안보·외교 축 (5문항, 반전 2개: q12·q15) */
    {
        id: 'q11', axis: 'security',
        prompt: '한미일 군사 협력을 강화하면 대북·대중 억제력은 커지지만, 한국 외교의 자주성과 한일 과거사 문제가 후순위로 밀릴 수 있습니다.',
        options: [
            { id: 'A', text: '협력 강화', score: -1 },
            { id: 'B', text: '신중·자주 외교 우선', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q12', axis: 'security',
        prompt: '북한에 대해 대화·교류를 우선할지, 압박·제재를 우선할지 입장이 갈립니다.',
        options: [
            { id: 'A', text: '대화·교류 우선', score: +1 },
            { id: 'B', text: '압박·제재 우선', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q13', axis: 'security',
        prompt: '강제동원·위안부 등 과거사 해법에 대해 미래지향적 협력을 우선할지, 과거사 정리를 우선할지 입장이 갈립니다.',
        options: [
            { id: 'A', text: '미래지향적 협력', score: -1 },
            { id: 'B', text: '과거사 정리 우선', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q14', axis: 'security',
        prompt: '북핵 위협 대응으로 자체 핵무장을 검토할지, 비핵화 원칙을 유지할지 의견이 갈립니다.',
        options: [
            { id: 'A', text: '검토 가능', score: -1 },
            { id: 'B', text: '비핵화 유지', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q15', axis: 'security',
        prompt: '미중 갈등 속에서 한국이 어느 쪽에 더 무게를 둘지 입장이 갈립니다.',
        options: [
            { id: 'A', text: '균형 외교', score: +1 },
            { id: 'B', text: '미국 동맹 강화', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },

    /* 정치제도 축 (5문항, 반전 2개: q17·q19) */
    {
        id: 'q16', axis: 'institution',
        prompt: '검찰의 수사·기소권 분리 또는 공수처·경찰로의 분산은 권력 견제 효과가 있다는 입장과, 수사 효율성·전문성 약화 우려가 있다는 입장이 맞섭니다.',
        options: [
            { id: 'A', text: '권한 분산·견제 강화', score: +1 },
            { id: 'B', text: '현 체제 유지', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q17', axis: 'institution',
        prompt: '연동형 비례대표제는 소수정당 진입을 돕지만, 위성정당 같은 부작용과 선거제도의 복잡성이 지적됩니다.',
        options: [
            { id: 'A', text: '폐지·단순화', score: -1 },
            { id: 'B', text: '강화·소수정당 진입 보장', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q18', axis: 'institution',
        prompt: '현 5년 단임 대통령제를 4년 중임 또는 의원내각제 등으로 개편하자는 논의가 있습니다.',
        options: [
            { id: 'A', text: '권력 분산형으로 개편', score: +1 },
            { id: 'B', text: '현 체제 안정 유지', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q19', axis: 'institution',
        prompt: '대법원장·헌법재판관 임명 과정에서 정치적 영향력을 줄일지, 민주적 통제를 강화할지 입장이 갈립니다.',
        options: [
            { id: 'A', text: '사법부 독립 강화', score: -1 },
            { id: 'B', text: '민주적 통제 강화', score: +1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    },
    {
        id: 'q20', axis: 'institution',
        prompt: '선거관리위원회 운영을 현 체제로 유지할지, 외부 감사·견제를 강화할지 입장이 갈립니다.',
        options: [
            { id: 'A', text: '외부 감사 강화', score: +1 },
            { id: 'B', text: '현 체제 유지', score: -1 },
            { id: 'C', text: '잘 모르겠다 / 관심 없음', score: 0 }
        ]
    }
];
