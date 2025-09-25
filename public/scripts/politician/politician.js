import { createDashboardBox } from "../components/dashboard.js";

document.addEventListener('DOMContentLoaded', () => {
    // === DOM 요소 선택 ===
    const summarySection = document.getElementById('politician-summary');
    const categoryFilters = document.getElementById('category-filters');
    const grid = document.querySelector('.politician-grid');
    const countDisplay = document.getElementById('politician-count');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');
    const typeFilter = document.getElementById('type-filter');

    // === 상태 관리 변수 ===
    let allPoliticians = []; // API로 받은 전체 원본 데이터
    let displayedPoliticians = []; // 현재 화면에 표시될 데이터
    let currentSort = { key: 'name', order: 'asc' };

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
     * 집계 데이터를 계산하고 화면에 렌더링하는 함수
     */
    function renderStatistics(politicians) {
        if (!summarySection) return;
        const total = politicians.length;

        const partyDashboard = createDashboardBox(politicians, 'party_name', '정당별 현황');
        const reeleDashboard = createDashboardBox(politicians, 'reele_gbn_nm', '재선별 현황');

        // 나이대별은 공통함수 활용 안되서 커스터마이징
        const ageGroupCount = { '20대': 0, '30대': 0, '40대': 0, '50대': 0, '60대': 0, '70대 이상': 0 };
        politicians.forEach(p => {
            if (!p.age) return;
            if (p.age >= 70) ageGroupCount['70대 이상']++;
            else if (p.age >= 60) ageGroupCount['60대']++;
            else if (p.age >= 50) ageGroupCount['50대']++;
            else if (p.age >= 40) ageGroupCount['40대']++;
            else if (p.age >= 30) ageGroupCount['30대']++;
            else if (p.age >= 20) ageGroupCount['20대']++;
        });

        const createAgeStatHTML = (title, data) => {
            const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
            let itemsHTML = sortedData.map(([label, count]) => {
                const percentage = ((count / total) * 100).toFixed(1);
                return `
                    <div class="stat-item">
                        <span class="stat-label">${label}</span>
                        <span class="stat-count">${count}명</span>
                        <div class="stat-bar-wrapper">
                            <div class="stat-bar" style="width: ${percentage}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
            return `<div class="stat-box"><h3>${title}</h3>${itemsHTML}</div>`;
        };
        const ageDashboard = createAgeStatHTML('나이대별 현황', ageGroupCount);

        summarySection.innerHTML = partyDashboard + reeleDashboard + ageDashboard;
    }

    /**
     * 의원 카드 HTML을 생성하는 함수
     */
    function createPoliticianCard(politician) {
        const photoUrl = politician.photo_url || `https://via.placeholder.com/220/cccccc?text=No+Image`;
        const partyName = politician.party_name || '무소속';
        const birthDate = politician.birthday ? new Date(politician.birthday).toLocaleDateString('ko-KR') : '정보 없음';
        const reeleClass = getReeleClass(politician.reele_gbn_nm);
        const ageText = politician.age ? ` (만 ${politician.age}세)` : '';
        const typeName = politician.politician_type_name || '';
        const typeClass = getPoliticianTypeClass(politician.politician_type);

        return `
            <article class="politician-card-large">
                <a href="/politician/${politician.mona_cd}">
                    <span class="card-name-overlay ${typeClass}">${politician.politician_type_name}</span>
                    <img src="${photoUrl}" alt="${politician.name} 의원 사진" onerror="this.onerror=null;this.src='https://via.placeholder.com/220/cccccc?text=No+Image';">
                    <div class="card-content">
                        <span class="card-type">${typeName}</span>
                        <h2 class="card-name">${politician.name}</h2>
                        <p class="card-party">${partyName}</p>
                        <div class="card-meta">
                            <span class="card-district">${politician.electoral_district}</span>
                            <span class="card-reele ${reeleClass}">${politician.reele_gbn_nm}</span>
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
        if (countDisplay) {
            countDisplay.textContent = `총 ${politicians.length}명`;
        }
        if (!grid) return;
        grid.innerHTML = politicians.length > 0
            ? politicians.map(createPoliticianCard).join('')
            : '<p class="no-results">검색 결과가 없습니다.</p>';
    }

    /**
     * 정렬 버튼 UI 업데이트
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
                    return a.name.localeCompare(b.name, 'ko-KR') * sortOrder;
                case 'party':
                    return (a.party_name || '').localeCompare(b.party_name || '', 'ko-KR') * sortOrder;
                case 'age':
                    return (a.age - b.age) * sortOrder;
                case 'reele':
                    const getReeleValue = (r) => {
                        if (r === '초선') return 1;
                        if (r === '재선') return 2;
                        const val = parseInt(r);
                        return isNaN(val) ? 0 : val;
                    };
                    return (getReeleValue(a.reele_gbn_nm) - getReeleValue(b.reele_gbn_nm)) * sortOrder;
                default:
                    return 0;
            }
        });
        
        renderPoliticians(sorted);
        updateSortIndicators();
    }

    /**
     * [신규] 카테고리(유형) 필터와 검색을 모두 적용하고 정렬을 실행하는 통합 함수
     */
    function applyFiltersAndSort() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedTypeId = typeFilter.value;

        let filtered = [...allPoliticians];

        if (selectedTypeId && selectedTypeId !== 'all') {
            filtered = filtered.filter(p => p.politician_type_id == selectedTypeId);
        }

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
        }
        
        if (summarySection) {
            const hasFilter = searchTerm || (selectedTypeId && selectedTypeId !== 'all');
            summarySection.style.display = hasFilter ? 'none' : 'grid';
        }

        displayedPoliticians = filtered;
        sortPoliticians();
    }
    
    /**
     * 필터 드롭다운 옵션을 생성하는 함수
     */
    function renderTypeFilter(categories) {
        if (!typeFilter) return;
        let optionsHTML = '<option value="all">전체</option>';
        optionsHTML += categories.map(cat => 
            `<option value="${cat.code_id}">${cat.code_name}</option>`
        ).join('');
        typeFilter.innerHTML = optionsHTML;
    }
    
    // === 이벤트 리스너 설정 ===
    searchInput.addEventListener('input', applyFiltersAndSort);
    typeFilter.addEventListener('change', applyFiltersAndSort);

    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            const newSortKey = button.dataset.sort;
            if (currentSort.key === newSortKey) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = newSortKey;
                currentSort.order = newSortKey === 'reele' ? 'desc' : 'asc';
            }
            sortPoliticians();
        });
    });

    /* 정치인 유형별 클래스 동적 적용 */
    function getPoliticianTypeClass(typeId) {
        switch (typeId) {
            // 국가 단위
            case 101: return 'type--president';
            case 102: return 'type--mp';
            // 광역 단위
            case 201: return 'type--governor';
            case 202: return 'type--superintendent';
            case 203: return 'type--metro-council';
            // 기초 단위
            case 301: return 'type--mayor';
            case 302: return 'type--local-council';
            // 기본값
            default: return '';
        }
    }

    /**
     * [수정됨] 페이지 로드 시 실행될 메인 비동기 함수 (레이스 컨디션 해결)
     */
    async function initialize() {
        try {
            grid.innerHTML = '<p class="loading-message">의원 목록을 불러오는 중입니다...</p>';

            // 공통 코드 콤보에 담기
            const politicianTypes = JSON.parse(sessionStorage.getItem('initialData')).CODES.POLITICIAN_TYPE;
            if (politicianTypes) {
                renderTypeFilter(politicianTypes);
            }

            // 전체 정치인 데이터를 한번만 불러옵니다.
            const response = await fetch('/api/politician');
            if (!response.ok) throw new Error(`데이터 로딩 실패`);
            
            allPoliticians = (await response.json()).map(p => ({ ...p, age: calculateAge(p.birthday) }));
            
            renderStatistics(allPoliticians);
            applyFiltersAndSort();

        } catch (error) {
            console.error("초기화 오류:", error);
            if (grid) grid.innerHTML = '<p class="no-results">페이지를 초기화하는 중 오류가 발생했습니다.</p>';
        }
    }

    // === 초기화 함수 실행 ===
    initialize();
});
