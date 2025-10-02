// public/scripts/politician/politician.js

import { createDashboardBox } from "../components/dashboard.js";

document.addEventListener('DOMContentLoaded', () => {
    // === DOM 요소 선택 ===
    const summarySection = document.getElementById('politician-summary');
    const grid = document.querySelector('.politician-grid');
    const countDisplay = document.getElementById('politician-count');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');
    const typeFilter = document.getElementById('type-filter');

    // 페이징 관련 DOM 요소 가져오기
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageNumbersContainer = document.getElementById('page-numbers');

    // === 상태 관리 변수 ===
    let allPoliticians = []; // API로 받은 전체 원본 데이터
    let displayedPoliticians = []; // 현재 필터링 및 정렬까지 완료된 전체 데이터 (페이징 전)
    let currentSort = { key: 'name', order: 'asc' };

    // 페이징 관련 변수
    let currentPage = 1;
    const itemsPerPage = 20; // 한 페이지에 표시할 항목 수

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
     * 화면에 의원 목록 렌더링 (페이징 적용)
     */
    function renderPoliticians(politiciansToRender) {
        if (!grid) return;

        // 페이징 적용
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPoliticians = politiciansToRender.slice(startIndex, endIndex);

        if (countDisplay) {
            countDisplay.textContent = `총 ${politiciansToRender.length}명`; // 필터링/정렬된 전체 아이템 수
        }

        grid.innerHTML = paginatedPoliticians.length > 0
            ? paginatedPoliticians.map(createPoliticianCard).join('')
            : '<p class="no-results">검색 결과가 없습니다.</p>';

        // 페이징 컨트롤 업데이트
        updatePaginationControls(politiciansToRender.length);
    }

    /**
     * 페이징 컨트롤 업데이트 함수
     */
    function updatePaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

        pageNumbersContainer.innerHTML = '';
        const maxPageButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

        if (endPage - startPage + 1 < maxPageButtons && totalPages > maxPageButtons) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.add('page-number-btn');
            if (i === currentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderPoliticians(displayedPoliticians); // 현재 필터/정렬 상태 유지
            });
            pageNumbersContainer.appendChild(pageBtn);
        }
    }

    /**
     * 페이지 이동 함수
     */
    function goToPage(direction) {
        if (direction === 'prev' && currentPage > 1) {
            currentPage--;
        } else if (direction === 'next' && currentPage < Math.ceil(displayedPoliticians.length / itemsPerPage)) {
            currentPage++;
        }
        renderPoliticians(displayedPoliticians);
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
        const sorted = [...displayedPoliticians]; // displayedPoliticians를 정렬

        sorted.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            // 데이터의 실제 필드명에 맞게 key 조정
            switch (key) {
                case 'name':
                    valA = a.name;
                    valB = b.name;
                    break;
                case 'party':
                    valA = a.party_name || '';
                    valB = b.party_name || '';
                    break;
                case 'age':
                    valA = a.age;
                    valB = b.age;
                    break;
                case 'reele':
                    valA = a.reele_gbn_nm;
                    valB = b.reele_gbn_nm;
                    break;
                default:
                    // 정의되지 않은 키는 원본 데이터 그대로 유지
                    return 0;
            }

            // 숫자 비교
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * (order === 'asc' ? 1 : -1);
            }
            // 문자열 비교 (한글 포함)
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB, 'ko-KR') * (order === 'asc' ? 1 : -1);
            }
            return 0; // 동일
        });
        
        displayedPoliticians = sorted; // 정렬된 결과를 다시 displayedPoliticians에 저장
        renderPoliticians(displayedPoliticians); // 정렬된 결과를 렌더링 (페이징 포함)
        updateSortIndicators();
    }

    /**
     * 카테고리(유형) 필터와 검색을 모두 적용하고 정렬을 실행하는 통합 함수
     */
    function applyFiltersAndSort() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedTypeId = typeFilter.value;

        let filtered = [...allPoliticians];

        if (selectedTypeId && selectedTypeId !== 'all') {
            filtered = filtered.filter(p => p.politician_type == selectedTypeId);
        }

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
        }

        if (summarySection) {
            const hasFilter = searchTerm || (selectedTypeId && selectedTypeId !== 'all');
            summarySection.style.display = hasFilter ? 'none' : 'grid';
        }
        
        displayedPoliticians = filtered; // 필터링된 전체 데이터 업데이트
        currentPage = 1; // 필터 변경 시 첫 페이지로 이동
        sortPoliticians(); // 필터링 후 정렬 및 렌더링
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
                // '재선순'은 기본적으로 내림차순이 더 자연스러울 수 있음
                currentSort.order = newSortKey === 'reele' ? 'desc' : 'asc';
            }
            applyFiltersAndSort(); // 정렬 변경 시 필터 및 정렬 재적용 (페이징 초기화 포함)
        });
    });

    // 페이징 버튼 이벤트 리스너
    prevPageBtn.addEventListener('click', () => goToPage('prev'));
    nextPageBtn.addEventListener('click', () => goToPage('next'));

    /**
     * 페이지 로드 시 실행될 메인 비동기 함수 (레이스 컨디션 해결)
     */
    async function initialize() {
        try {
            grid.innerHTML = '<p class="loading-message">의원 목록을 불러오는 중입니다...</p>';

            // 공통 코드 콤보에 담기
            const initialData = JSON.parse(sessionStorage.getItem('initialData'));
            if (initialData && initialData.CODES && initialData.CODES.POLITICIAN_TYPE) {
                renderTypeFilter(initialData.CODES.POLITICIAN_TYPE);
            } else {
                console.warn("sessionStorage에서 POLITICIAN_TYPE 데이터를 찾을 수 없습니다.");
            }
            
            // 변수에 담아둔 페이지 데이터 가져와서 처리
            if (!window.politicianData) {
                 console.error("window.politicianData를 찾을 수 없습니다. EJS 템플릿에서 데이터를 올바르게 설정했는지 확인하세요.");
                 grid.innerHTML = '<p class="no-results">데이터를 불러올 수 없습니다.</p>';
                 return;
            }

            allPoliticians = window.politicianData.map(p => ({ ...p, age: calculateAge(p.birthday) }));
            
            renderStatistics(allPoliticians);
            applyFiltersAndSort(); // 초기 로딩 시 필터, 정렬 및 페이징까지 모두 적용

        } catch (error) {
            console.error("초기화 오류:", error);
            if (grid) grid.innerHTML = '<p class="no-results">페이지를 초기화하는 중 오류가 발생했습니다.</p>';
        }
    }

    // === 초기화 함수 실행 ===
    initialize();
});