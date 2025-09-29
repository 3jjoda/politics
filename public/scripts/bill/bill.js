// bill_list.js

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('bill-search');
    const statusFilter = document.getElementById('status-filter');
    const committeeFilter = document.getElementById('committee-filter');
    const billGrid = document.querySelector('.bill-grid');
    const noResultsMessage = document.querySelector('.no-results-message');
    const loadingMessage = document.querySelector('.loading-message');

    // API 호출 및 UI 업데이트 함수
    async function fetchAndRenderBills() {
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        if (billGrid) billGrid.innerHTML = ''; // 기존 목록 초기화

        const searchValue = searchInput ? searchInput.value : '';
        const statusValue = statusFilter ? statusFilter.value : '';
        const committeeValue = committeeFilter ? committeeFilter.value : '';

        // 실제 API 엔드포인트와 파라미터에 맞게 수정 필요
        const apiUrl = `/api/bills?search=${searchValue}&status=${statusValue}&committee=${committeeValue}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json(); // 백엔드에서 받은 bills 데이터 (배열 형태)

            if (loadingMessage) loadingMessage.style.display = 'none';

            if (data && data.bills && data.bills.length > 0) {
                // EJS 템플릿의 bill-card 구조를 JS에서 동적으로 생성
                data.bills.forEach(bill => {
                    const billCard = document.createElement('article');
                    billCard.className = 'bill-card';
                    billCard.innerHTML = `
                        <a href="/bill/${bill.id}">
                            <div class="card-header">
                                <span class="bill-status status-${bill.statusClass}">${bill.statusText}</span>
                            </div>
                            <div class="card-body">
                                <h3 class="bill-title">${bill.name}</h3>
                                <p class="proposer"><strong>대표발의:</strong> <a href="/politician/${bill.proposerMonCode}">${bill.proposerName} 의원</a></p>
                                <p class="committee"><strong>소관위:</strong> ${bill.committeeName}</p>
                            </div>
                            <div class="card-footer">
                                <span class="date">${bill.processDate} 처리</span>
                            </div>
                        </a>
                    `;
                    billGrid.appendChild(billCard);
                });
            } else {
                if (noResultsMessage) noResultsMessage.style.display = 'block';
            }

        } catch (error) {
            console.error('법안 데이터를 가져오는 중 오류 발생:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (billGrid) billGrid.innerHTML = '<p class="no-results-message">데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</p>';
        }
    }

    // 검색 및 필터 변경 시 데이터 다시 로드
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(fetchAndRenderBills, 500)); // 0.5초 디바운스
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', fetchAndRenderBills);
    }
    if (committeeFilter) {
        committeeFilter.addEventListener('change', fetchAndRenderBills);
    }

    // 초기 로드 시 법안 데이터 가져오기 (EJS에서 이미 서버 렌더링을 했다면 필요 없을 수 있음)
    // fetchAndRenderBills();

    // 디바운스 유틸리티 함수 (검색 시 불필요한 API 호출 방지)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
});