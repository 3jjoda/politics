// public/scripts/pages/politician.js

import { CreateDashboardBox } from "../components/dashboard.js"; // 🚨 함수명 소문자로 변경 (convention)
import { Pagination } from "../components/pagination.js"; // 🚨 경로 수정: ../components -> ../utils

document.addEventListener('DOMContentLoaded', () => {
    // === DOM 요소 선택 ===
    const summarySection = document.getElementById('politician-summary');
    const grid = document.querySelector('.politician-grid');
    const countDisplay = document.getElementById('politician-count');
    const searchInput = document.getElementById('name-search');
    const sortButtons = document.querySelectorAll('.sort-btn');
    const typeFilter = document.getElementById('type-filter');

    // === 상태 관리 변수 ===
    let allPoliticians = []; // API로 받은 전체 원본 데이터
    let displayedPoliticians = []; // 현재 화면에 표시될 데이터
    let currentSort = { key: 'name', order: 'asc' };

    // Pagination 인스턴스 생성
    const pagination = new Pagination(
        'pagination-container', // 페이징 컨트롤이 들어갈 컨테이너 ID
        (paginatedData) => { // renderCallback 함수: 페이징된 데이터를 받아 그리드를 렌더링
            if (!grid) return;
            grid.innerHTML = paginatedData.length > 0
                ? paginatedData.map(createPoliticianCard).join('')
                : '<p class="no-results">검색 결과가 없습니다.</p>';
        },
        20, // 한 페이지당 항목 수 (itemsPerPage)
        5,  // 표시할 페이지 버튼 수 (maxPageButtons)
        'politician-grid', // 스크롤을 이동할 대상 요소의 ID
        true, // showFirstLastButtons (맨 앞/맨 뒤 버튼 표시 여부)
        true  // showGoToPageInput (페이지 입력 필드 표시 여부)
    );

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

        const partyDashboard = CreateDashboardBox(politicians, 'party_name', '정당별 현황'); // 🚨 함수명 수정
        const reeleDashboard = CreateDashboardBox(politicians, 'reele_gbn_nm', '재선별 현황'); // 🚨 함수명 수정

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
        // 🚨 via.placeholder.com -> placehold.co 변경
        const photoUrl = politician.photo_url;
        const partyName = politician.party_name || '무소속';
        const birthDate = politician.birthday ? new Date(politician.birthday).toLocaleDateString('ko-KR') : '정보 없음';
        const reeleClass = getReeleClass(politician.reele_gbn_nm);
        const ageText = politician.age ? ` (만 ${politician.age}세)` : '';
        const typeName = politician.politician_type_name || ''; // 🚨 null/undefined 처리
        const typeClass = getPoliticianTypeClass(politician.politician_type);

        // 🚨 politician.mona_cd가 null 또는 undefined일 경우 '#'으로 대체하여 /null 요청 방지
        const politicianId = politician.mona_cd || '#'; 
        const linkHref = politicianId === '#' ? '#' : `/politician/${politicianId}`;

        // mona_cd가 없는 경우 링크 기능을 비활성화
        const linkTagStart = politicianId === '#' ? `<div class="politician-card-no-link">` : `<a href="${linkHref}">`;
        const linkTagEnd = politicianId === '#' ? `</div>` : `</a>`;

        return `
            <article class="politician-card-large">
                ${linkTagStart}
                    <span class="card-name-overlay ${typeClass}">${typeName}</span>
                    <img src="${photoUrl}">
                    <div class="card-content">
                        <span class="card-type">${typeName}</span>
                        <h2 class="card-name">${politician.name}</h2>
                        <p class="card-party">${partyName}</p>
                        <div class="card-meta">
                            <span class="card-district">${politician.electoral_district || '정보 없음'}</span>
                            <span class="card-reele ${reeleClass}">${politician.reele_gbn_nm || '정보 없음'}</span>
                        </div>
                        <p class="card-dob">${birthDate}${ageText}</p>
                    </div>
                ${linkTagEnd}
            </article>
        `;
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
                    return (a.name || '').localeCompare(b.name || '', 'ko-KR') * sortOrder;
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
        
        // 🚨 renderPoliticians 대신 pagination.update를 직접 호출하여 데이터 갱신
        // renderPoliticians(sorted); // 제거
        pagination.update(sorted); // pagination이 데이터를 가지고 자체적으로 렌더링하도록 함
        updateSortIndicators();
        
        // 총 카운트 업데이트
        if (countDisplay) {
            countDisplay.textContent = `총 ${sorted.length}명`;
        }
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
            filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(searchTerm)); // 🚨 name 필드도 null/undefined 처리
        }
        
        if (summarySection) {
            const hasFilter = searchTerm || (selectedTypeId && selectedTypeId !== 'all');
            summarySection.style.display = hasFilter ? 'none' : 'grid';
        }

        displayedPoliticians = filtered;
        sortPoliticians(); // 필터링된 데이터를 정렬하고 pagination을 업데이트
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
                currentSort.order = newSortKey === 'reele' ? 'desc' : 'asc'; // 재선 정렬 기본 내림차순 (고선이 위로 오도록)
            }
            sortPoliticians();
        });
    });

    /**
     * 페이지 로드 시 실행될 메인 비동기 함수
     */
    async function initialize() {
        try {
            // 🚨 이제 pagination이 자체적으로 로딩 메시지를 처리하거나, 
            // initial renderCallback 호출에서 처리되므로 여기서 불필요
            // if (grid) grid.innerHTML = '<p class="loading-message">의원 목록을 불러오는 중입니다...</p>';

            // 공통 코드 콤보에 담기
            const initialData = JSON.parse(sessionStorage.getItem('initialData'));
            if (initialData && initialData.CODES && initialData.CODES.POLITICIAN_TYPE) {
                renderTypeFilter(initialData.CODES.POLITICIAN_TYPE);
            }
            
            // 변수에 담아둔 페이지 데이터 가져와서 처리
            // window.politicianData가 전역에 있을 때
            if (window.politicianData) {
                allPoliticians = window.politicianData.map(p => ({ 
                    ...p, 
                    age: calculateAge(p.birthday),
                    name: p.name || '이름 없음', // 이름이 없는 경우도 대비
                    politician_type_name: p.politician_type_name || '', // null인 경우 빈 문자열
                    electoral_district: p.electoral_district || '정보 없음', // null인 경우 대체
                    reele_gbn_nm: p.reele_gbn_nm || '정보 없음', // null인 경우 대체
                }));
            } else {
                console.warn("window.politicianData를 찾을 수 없습니다.");
                if (grid) grid.innerHTML = '<p class="no-results">의원 데이터를 불러오지 못했습니다.</p>';
                return; // 데이터 없으면 더 이상 진행하지 않음
            }

            renderStatistics(allPoliticians);
            applyFiltersAndSort(); // 필터, 정렬 적용 후 pagination이 첫 페이지 렌더링
            updateSortIndicators(); // 초기 정렬 버튼 UI 업데이트
            
        } catch (error) {
            console.error("초기화 오류:", error);
            if (grid) grid.innerHTML = '<p class="no-results">페이지를 초기화하는 중 오류가 발생했습니다.</p>';
        }
    }

    // === 초기화 함수 실행 ===
    initialize();
});