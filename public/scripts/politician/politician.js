// public/scripts/politician.js

document.addEventListener('DOMContentLoaded', () => {
    // 페이지의 모든 요소를 변수에 할당
    const grid = document.querySelector('.politician-grid');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');

    // 전체 의원 데이터를 저장하고, 현재 화면에 표시될 데이터를 따로 관리
    let allPoliticians = [];
    let displayedPoliticians = [];

    // public/scripts/politicians.js

    /**
     * 의원 카드 HTML을 생성하는 함수
     */
    function createPoliticianCard(politician) {
        const photoUrl = politician.PHOTO_URL || 'https://via.placeholder.com/120/cccccc?text=No+Image';
        const partyName = politician.PARTY_NAME || '무소속';
        const birthDate = politician.BIRTHDAY ? new Date(politician.BIRTHDAY).toLocaleDateString('ko-KR') : '정보 없음';

        // [수정됨] 세로 디자인에 맞춘 HTML 구조
        return `
            <article class="politician-card-large">
                <img src="${photoUrl}" alt="${politician.NAME} 의원 사진" onerror="this.onerror=null;this.src='https://via.placeholder.com/120/cccccc?text=No+Image';">
                <h2 class="card-name">${politician.NAME}</h2>
                <p class="card-party">${partyName}</p>
                <p class="card-dob">${birthDate}</p>
            </article>
        `;
    }

    /**
     * 주어진 의원 데이터 배열을 화면에 렌더링하는 함수
     */
    function renderPoliticians(politician) {
        if (!grid) return;
        if (politician.length === 0) {
            grid.innerHTML = '<p class="no-results">검색 결과가 없습니다.</p>';
            return;
        }
        grid.innerHTML = politician.map(createPoliticianCard).join('');
    }

    /**
     * 정렬 기능 처리
     */
    function sortPoliticians(sortKey) {
        // Array.sort()는 원본 배열을 변경하므로, 복사본을 만들어 정렬
        let sorted = [...displayedPoliticians]; 

        if (sortKey === 'name') {
            sorted.sort((a, b) => a.NAME.localeCompare(b.NAME, 'ko-KR'));
        } else if (sortKey === 'party') {
            sorted.sort((a, b) => (a.PARTY_NAME || '').localeCompare(b.PARTY_NAME || '', 'ko-KR'));
        } else if (sortKey === 'age') {
            sorted.sort((a, b) => new Date(a.BIRTHDAY) - new Date(b.BIRTHDAY));
        }
        renderPoliticians(sorted);
    }
    
    /**
     * 검색 기능 처리
     */
    function filterPoliticians() {
        const searchTerm = searchInput.value.toLowerCase();
        displayedPoliticians = allPoliticians.filter(p => p.NAME.toLowerCase().includes(searchTerm));
        
        // 현재 활성화된 정렬 기준을 다시 적용하여 렌더링
        const activeSortBtn = document.querySelector('.sort-btn.active');
        sortPoliticians(activeSortBtn.dataset.sort);
    }


    // === 이벤트 리스너 설정 ===

    // 검색창에 입력할 때마다 필터링 실행
    searchInput.addEventListener('input', filterPoliticians);

    // 정렬 버튼 클릭 이벤트
    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 모든 버튼에서 active 클래스 제거
            sortButtons.forEach(btn => btn.classList.remove('active'));
            // 클릭된 버튼에 active 클래스 추가
            button.classList.add('active');
            
            // 정렬 실행
            sortPoliticians(button.dataset.sort);
        });
    });


    /**
     * 페이지 로드 시 실행될 메인 비동기 함수
     */
    async function initialize() {
        try {
            const response = await fetch('/api/politician');
            if (!response.ok) throw new Error('데이터 로딩 실패');
            
            allPoliticians = await response.json();
            displayedPoliticians = [...allPoliticians]; // 초기에는 모든 의원을 표시
            
            renderPoliticians(displayedPoliticians);
        } catch (error) {
            console.error(error);
            grid.innerHTML = '<p class="no-results">데이터를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    // 페이지 로드 완료 시 초기화 함수 실행
    initialize();
});