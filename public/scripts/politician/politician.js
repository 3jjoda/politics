document.addEventListener('DOMContentLoaded', () => {
    // === DOM 요소 선택 ===
    const grid = document.querySelector('.politician-grid');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');

    // === 상태 관리 변수 ===
    let allPoliticians = []; // 원본 데이터
    let displayedPoliticians = []; // 검색 결과가 반영된 데이터

    // 현재 정렬 상태 (기본: 이름, 오름차순)
    let currentSort = {
        key: 'name',
        order: 'asc'
    };

    // === 함수 정의 ===

    /**
     * 생년월일 기준으로 만나이를 계산하는 함수
     */
    function calculateAge(birthdayString) {
        if (!birthdayString) return null;
        const birthday = new Date(birthdayString);
        const today = new Date();
        let age = today.getFullYear() - birthday.getFullYear();
        const m = today.getMonth() - birthday.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
            age--;
        }
        return age;
    }

    /**
     * 재선 정보에 따라 CSS 클래스 반환
     */
    function getReeleClass(reeleString) {
        if (reeleString === '초선') return 'reele--first';
        if (reeleString === '재선') return 'reele--second';
        return 'reele--multi';
    }

    /**
     * 의원 카드 HTML 생성
     */
    function createPoliticianCard(politician) {
        const photoUrl = politician.PHOTO_URL || `https://via.placeholder.com/220/cccccc?text=No+Image`;
        const partyName = politician.PARTY_NAME || '무소속';
        const birthDate = politician.BIRTHDAY ? new Date(politician.BIRTHDAY).toLocaleDateString('ko-KR') : '정보 없음';
        const reeleClass = getReeleClass(politician.REELE_GBN_NM);
        
        // 만나이 텍스트 생성 (나이 정보가 있을 경우에만 표시)
        const ageText = politician.age ? ` (만 ${politician.age}세)` : '';

        return `
            <article class="politician-card-large">
                <a href="/politician/${politician.MONA_CD}">
                    <img src="${photoUrl}" alt="${politician.NAME} 의원 사진" onerror="this.onerror=null;this.src='https://via.placeholder.com/220/cccccc?text=No+Image';">
                    <div class="card-content">
                        <h2 class="card-name">${politician.NAME}</h2>
                        <p class="card-party">${partyName}</p>
                        <div class="card-meta">
                            <span class="card-district">${politician.ELECTORAL_DISTRICT}</span>
                            <span class="card-reele ${reeleClass}">${politician.REELE_GBN_NM}</span>
                        </div>
                        <p class="card-dob">${birthDate}${ageText}</p>
                    </div>
                </a>
            </article>
        `;
    }

    /**
     * 화면에 의원 목록 렌더링
     */
    function renderPoliticians(politicians) {
        if (!grid) return;
        grid.innerHTML = politicians.length > 0
            ? politicians.map(createPoliticianCard).join('')
            : '<p class="no-results">검색 결과가 없습니다.</p>';
    }

    /**
     * 정렬 버튼 UI (아이콘, 활성 상태) 업데이트
     */
    function updateSortIndicators() {
        sortButtons.forEach(button => {
            const indicator = button.querySelector('.sort-indicator');
            if (button.dataset.sort === currentSort.key) {
                button.classList.add('active');
                indicator.textContent = currentSort.order === 'asc' ? '▲' : '▼';
            } else {
                button.classList.remove('active');
                indicator.textContent = '';
            }
        });
    }

    /**
     * 정렬 기능 처리
     */
    function sortPoliticians() {
        const { key, order } = currentSort;
        const sorted = [...displayedPoliticians];
        const sortOrder = order === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            switch (key) {
                case 'name':
                    return a.NAME.localeCompare(b.NAME, 'ko-KR') * sortOrder;
                case 'party':
                    return (a.PARTY_NAME || '').localeCompare(b.PARTY_NAME || '', 'ko-KR') * sortOrder;
                case 'age':
                    // 오름차순 : 어린사람 부터
                    return (a.age - b.age) * sortOrder;
                case 'reele':
                    const getReeleValue = (r) => {
                        if (r === '초선') return 1;
                        if (r === '재선') return 2;
                        const val = parseInt(r);
                        return isNaN(val) ? 0 : val;
                    };
                    return (getReeleValue(a.REELE_GBN_NM) - getReeleValue(b.REELE_GBN_NM)) * sortOrder;
                default:
                    return 0;
            }
        });
        
        renderPoliticians(sorted);
        updateSortIndicators();
    }

    /**
     * 검색 기능 처리
     */
    function filterPoliticians() {
        const searchTerm = searchInput.value.toLowerCase();
        displayedPoliticians = allPoliticians.filter(p => p.NAME.toLowerCase().includes(searchTerm));
        sortPoliticians();
    }

    // === 이벤트 리스너 설정 ===

    searchInput.addEventListener('input', filterPoliticians);

    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            const newSortKey = button.dataset.sort;
            if (currentSort.key === newSortKey) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = newSortKey;
                // '재선'은 기본값을 내림차순(다선 -> 초선), 나머지는 오름차순으로 설정
                currentSort.order = newSortKey === 'reele' ? 'desc' : 'asc';
            }
            sortPoliticians();
        });
    });

    /**
     * 페이지 로드 시 실행될 메인 비동기 함수
     */
    async function initialize() {
        try {
            const response = await fetch('/api/politician');
            if (!response.ok) throw new Error(`데이터 로딩 실패: ${response.statusText}`);
            
            let rawPoliticians = await response.json();
            
            // 모든 의원 데이터에 대해 'age' 프로퍼티를 미리 계산하여 추가
            allPoliticians = rawPoliticians.map(p => {
                return {
                    ...p,
                    age: calculateAge(p.BIRTHDAY)
                };
            });
            
            displayedPoliticians = [...allPoliticians];
            
            sortPoliticians();
        } catch (error) {
            console.error(error);
            if (grid) grid.innerHTML = '<p class="no-results">데이터를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    // === 초기화 함수 실행 ===
    initialize();
});