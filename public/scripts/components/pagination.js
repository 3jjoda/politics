// public/scripts/utils/pagination.js

import { ShowAlert } from '../components/custom_alert.js'; 

class Pagination {
    /**
     * 페이징 컨트롤을 생성하고 관리하는 클래스
     * @param {string} containerId - 페이징 컨트롤이 삽입될 HTML 요소의 ID.
     * @param {function(Array<any>): void} renderCallback - 현재 페이지에 해당하는 데이터를 받아 DOM에 렌더링하는 콜백 함수.
     * @param {number} [itemsPerPage=20] - 한 페이지에 표시할 항목의 수.
     * @param {number} [maxPageButtons=5] - 페이지 번호 버튼 중 최대로 표시할 개수. (예: 1 ... 4 5 6 ... 10)
     * @param {string|null} [scrollToTopElementId=null] - 페이지 이동 시 스크롤을 이동할 대상 요소의 ID. null이면 window 상단으로 스크롤.
     * @param {boolean} [showFirstLastButtons=true] - '처음으로'/'마지막으로' 페이지 이동 버튼 표시 여부.
     * @param {boolean} [showGoToPageInput=true] - 특정 페이지 번호 입력 필드 및 이동 버튼 표시 여부.
     */
    constructor(
        containerId,
        renderCallback,
        itemsPerPage = 20,
        maxPageButtons = 5,
        scrollToTopElementId = null,
        showFirstLastButtons = true,
        showGoToPageInput = true
    ) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Pagination container with ID '${containerId}' not found.`);
            // 컨테이너가 없으면 더 이상 진행하지 않음
            return;
        }

        this.renderCallback = renderCallback;
        this.itemsPerPage = itemsPerPage;
        this.maxPageButtons = maxPageButtons;
        this.scrollToTopElement = scrollToTopElementId ? document.getElementById(scrollToTopElementId) : null;
        this.showFirstLastButtons = showFirstLastButtons;
        this.showGoToPageInput = showGoToPageInput;

        this.currentPage = 1;
        this.totalItems = 0;
        this.data = []; // 페이징할 전체 데이터 (필터링/정렬 완료된 상태)

        // 모든 컨트롤 요소를 생성하고 컨테이너에 추가
        this._createControls();
    }

    /**
     * 페이징 컨트롤의 DOM 요소를 생성하고 컨테이너에 추가
     * 이 함수는 constructor에서 한 번만 호출
     */
    _createControls() {
        this.container.innerHTML = ''; // 기존 내용 초기화

        // --- 맨 앞 페이지 버튼 ---
        if (this.showFirstLastButtons) {
            this.firstPageBtn = document.createElement('button');
            this.firstPageBtn.textContent = '<< 첫 페이지'; // Font Awesome 아이콘도 좋음: '<i class="fas fa-angle-double-left"></i>'
            this.firstPageBtn.className = 'pagination-btn first-last-btn';
            this.firstPageBtn.addEventListener('click', () => this.goToPage(1));
            this.container.appendChild(this.firstPageBtn);
        }

        // --- 이전 페이지 버튼 ---
        this.prevPageBtn = document.createElement('button');
        this.prevPageBtn.id = 'prev-page-btn';
        this.prevPageBtn.className = 'pagination-btn';
        this.prevPageBtn.textContent = '이전'; // Font Awesome 아이콘도 좋음: '<i class="fas fa-angle-left"></i>'
        this.prevPageBtn.addEventListener('click', () => this.goToPage('prev'));
        this.container.appendChild(this.prevPageBtn);

        // --- 페이지 번호 컨테이너 ---
        this.pageNumbersContainer = document.createElement('div');
        this.pageNumbersContainer.id = 'page-numbers';
        this.pageNumbersContainer.className = 'page-numbers';
        this.container.appendChild(this.pageNumbersContainer);

        // --- 다음 페이지 버튼 ---
        this.nextPageBtn = document.createElement('button');
        this.nextPageBtn.id = 'next-page-btn';
        this.nextPageBtn.className = 'pagination-btn';
        this.nextPageBtn.textContent = '다음'; // Font Awesome 아이콘도 좋음: '<i class="fas fa-angle-right"></i>'
        this.nextPageBtn.addEventListener('click', () => this.goToPage('next'));
        this.container.appendChild(this.nextPageBtn);
        
        // --- 맨 뒤 페이지 버튼 ---
        if (this.showFirstLastButtons) {
            this.lastPageBtn = document.createElement('button');
            this.lastPageBtn.textContent = '마지막 페이지 >>'; // Font Awesome 아이콘도 좋음: '<i class="fas fa-angle-double-right"></i>'
            this.lastPageBtn.className = 'pagination-btn first-last-btn';
            this.lastPageBtn.addEventListener('click', () => this.goToPage(Math.ceil(this.totalItems / this.itemsPerPage)));
            this.container.appendChild(this.lastPageBtn);
        }

        // --- 특정 페이지 입력 필드 ---
        if (this.showGoToPageInput) {
            this.goToPageInputContainer = document.createElement('div');
            this.goToPageInputContainer.className = 'go-to-page-input-container';

            this.pageInput = document.createElement('input');
            this.pageInput.type = 'number';
            this.pageInput.min = '1';
            this.pageInput.className = 'page-input';
            this.pageInput.placeholder = '페이지';
            this.pageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 폼 제출 방지
                    this._handleGoToPageInput();
                }
            });

            this.goToPageButton = document.createElement('button');
            this.goToPageButton.textContent = '이동';
            this.goToPageButton.className = 'go-to-page-btn';
            this.goToPageButton.addEventListener('click', () => this._handleGoToPageInput());

            this.goToPageInputContainer.appendChild(this.pageInput);
            this.goToPageInputContainer.appendChild(this.goToPageButton);
            this.container.appendChild(this.goToPageInputContainer);
        }
    }


    /**
     * 페이징할 전체 데이터를 업데이트하고 첫 페이지로 초기화
     * 필터링이나 정렬 결과가 변경될 때 호출
     * @param {Array<any>} data - 페이징할 전체 데이터 배열.
     */
    update(data) {
        this.data = data;
        this.totalItems = data.length;
        this.currentPage = 1; // 새 데이터가 주어지면 항상 첫 페이지로 초기화
        this.render();
    }

    /**
     * 현재 페이지에 표시될 데이터 항목 배열을 반환
     * @returns {Array<any>} 현재 페이지의 데이터 항목 배열.
     */
    getCurrentPageData() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.data.slice(startIndex, endIndex);
    }

    /**
     * 현재 페이지의 데이터를 렌더링하고 페이징 컨트롤 UI를 업데이트
     * 페이지가 변경될 때마다 호출
     */
    render() {
        // 렌더링 콜백 함수를 호출하여 현재 페이지 데이터로 그리드를 업데이트
        this.renderCallback(this.getCurrentPageData());
        this._updatePaginationControls(); // 이전/다음/페이지 번호 버튼 업데이트
        this._updateFirstLastButtons();   // 맨 앞/맨 뒤 버튼 업데이트
        this._updateGoToPageInput();      // 페이지 입력 필드 업데이트

        // 스크롤을 지정된 요소 또는 창의 상단으로 이동
        if (this.scrollToTopElement) {
            this.scrollToTopElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * '이전'/'다음' 버튼 및 페이지 번호 버튼의 상태를 업데이트 (내부용)
     */
    _updatePaginationControls() {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);

        this.prevPageBtn.disabled = this.currentPage === 1;
        this.nextPageBtn.disabled = this.currentPage === totalPages || totalPages === 0;

        this.pageNumbersContainer.innerHTML = ''; // 기존 페이지 번호 버튼 제거
        
        // 표시할 페이지 번호 버튼의 범위 계산
        let startPage = Math.max(1, this.currentPage - Math.floor(this.maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + this.maxPageButtons - 1);

        // 만약 끝 페이지가 충분히 크지 않다면 시작 페이지를 조정하여 버튼 개수 유지
        if (endPage - startPage + 1 < this.maxPageButtons && totalPages > this.maxPageButtons) {
            startPage = Math.max(1, endPage - this.maxPageButtons + 1);
        }

        // 페이지 번호 버튼 생성
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.add('page-number-btn');
            if (i === this.currentPage) {
                pageBtn.classList.add('active'); // 현재 페이지 버튼 활성화
            }
            pageBtn.addEventListener('click', () => {
                this.goToPage(i); // 클릭 시 해당 페이지로 이동
            });
            this.pageNumbersContainer.appendChild(pageBtn);
        }
    }

    /**
     * '첫 페이지'/'마지막 페이지' 버튼의 활성화/비활성화 상태를 업데이트 (내부용)
     */
    _updateFirstLastButtons() {
        if (this.showFirstLastButtons) {
            const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
            this.firstPageBtn.disabled = this.currentPage === 1 || totalPages === 0;
            this.lastPageBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }
    }

    /**
     * 특정 페이지 입력 필드의 상태를 업데이트 (내부용)
     */
    _updateGoToPageInput() {
        if (this.showGoToPageInput) {
            const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
            this.pageInput.value = this.currentPage; // 현재 페이지 번호로 자동 설정
            this.pageInput.max = totalPages; // 입력 가능한 최대 페이지 설정
            this.pageInput.disabled = totalPages === 0; // 페이지가 없으면 비활성화
            this.goToPageButton.disabled = totalPages === 0; // 버튼도 비활성화
        }
    }

    /**
     * 특정 페이지 번호 입력 필드의 값으로 페이지를 이동하는 핸들러 (내부용)
     */
    _handleGoToPageInput() {
        const pageNum = parseInt(this.pageInput.value, 10);
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);

        // 유효성 검사
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages || totalPages === 0) {
            ShowAlert(`1에서 ${totalPages || 1} 사이의 유효한 페이지 번호를 입력하세요.`);
            this.pageInput.value = this.currentPage; // 유효하지 않으면 현재 페이지로 되돌림
            return;
        }
        this.goToPage(pageNum); // 유효하면 해당 페이지로 이동
    }

    /**
     * 지정된 방향(이전/다음) 또는 특정 페이지 번호로 이동
     * @param {string|number} targetPage - 'prev', 'next' 문자열이거나 이동할 페이지 번호(숫자).
     */
    goToPage(targetPage) {
        let newPage = this.currentPage;
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);

        if (typeof targetPage === 'string') {
            if (targetPage === 'prev' && this.currentPage > 1) {
                newPage = this.currentPage - 1;
            } else if (targetPage === 'next' && this.currentPage < totalPages) {
                newPage = this.currentPage + 1;
            }
        } else if (typeof targetPage === 'number') {
            // 유효한 페이지 범위 내에서만 이동 허용
            if (targetPage >= 1 && targetPage <= totalPages) {
                newPage = targetPage;
            }
        }
        
        // 실제로 페이지가 변경되었을 경우에만 렌더링
        if (newPage !== this.currentPage) {
            this.currentPage = newPage;
            this.render();
        }
    }
}

export { Pagination };