// public/scripts/politician.js

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.politician-grid');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');

    let allPoliticians = [];
    let displayedPoliticians = [];

    /**
     * [신규] 재선 정보(REELE_GBN_NM)에 따라 적절한 CSS 클래스를 반환하는 함수
     */
    function getReeleClass(reeleString) {
        if (reeleString === '초선') return 'reele--first';
        if (reeleString === '재선') return 'reele--second';
        // 3선, 4선 등 그 외는 모두 '다선'으로 처리
        return 'reele--multi';
    }

    /**
     * 의원 카드 HTML을 생성하는 함수
     */
    function createPoliticianCard(politician) {
        const photoUrl = politician.PHOTO_URL || 'https://via.placeholder.com/220/cccccc?text=No+Image';
        const partyName = politician.PARTY_NAME || '무소속';
        const birthDate = politician.BIRTHDAY ? new Date(politician.BIRTHDAY).toLocaleDateString('ko-KR') : '정보 없음';
        
        // [수정됨] getReeleClass 함수를 호출하여 동적 클래스 생성
        const reeleClass = getReeleClass(politician.REELE_GBN_NM);

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
                        <p class="card-dob">${birthDate}</p>
                    </div>
                </a>
            </article>
        `;
    }

    /**
     * 주어진 의원 데이터 배열을 화면에 렌더링하는 함수
     */
    function renderPoliticians(politicians) { // [수정됨] 변수명을 복수형으로 명확화
        if (!grid) return;
        if (politicians.length === 0) {
            grid.innerHTML = '<p class="no-results">검색 결과가 없습니다.</p>';
            return;
        }
        grid.innerHTML = politicians.map(createPoliticianCard).join('');
    }

    /**
     * 정렬 기능 처리
     */
    function sortPoliticians(sortKey) {
        let sorted = [...displayedPoliticians]; 
        if (sortKey === 'name') sorted.sort((a, b) => a.NAME.localeCompare(b.NAME, 'ko-KR'));
        else if (sortKey === 'party') sorted.sort((a, b) => (a.PARTY_NAME || '').localeCompare(b.PARTY_NAME || '', 'ko-KR'));
        else if (sortKey === 'age') sorted.sort((a, b) => new Date(a.BIRTHDAY) - new Date(b.BIRTHDAY));
        renderPoliticians(sorted);
    }
    
    /**
     * 검색 기능 처리
     */
    function filterPoliticians() {
        const searchTerm = searchInput.value.toLowerCase();
        displayedPoliticians = allPoliticians.filter(p => p.NAME.toLowerCase().includes(searchTerm));
        const activeSortBtn = document.querySelector('.sort-btn.active');
        sortPoliticians(activeSortBtn.dataset.sort);
    }

    // === 이벤트 리스너 설정 ===
    searchInput.addEventListener('input', filterPoliticians);

    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            sortButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            sortPoliticians(button.dataset.sort);
        });
    });

    /**
     * 페이지 로드 시 실행될 메인 비동기 함수
     */
    async function initialize() {
        try {
            // [수정됨] RESTful API 규칙에 따라 복수형으로 변경
            const response = await fetch('/politician'); 
            if (!response.ok) throw new Error(`데이터 로딩 실패: ${response.statusText}`);
            
            allPoliticians = await response.json();
            displayedPoliticians = [...allPoliticians];
            
            // 초기 로드는 기본 정렬(가나다순) 적용
            sortPoliticians('name');
        } catch (error) {
            console.error(error);
            grid.innerHTML = '<p class="no-results">데이터를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    // initialize();
});