// public/scripts/utils/pagination.js

import { ShowAlert } from './custom_alert.js'; 

/**
 * Pagination 클래스: 웹 페이지의 데이터를 분할하여 표시하고 페이지 이동 기능을 제공
 */
export class Pagination {
    /**
     * Pagination 인스턴스를 초기화
     * @param {string} containerId - 페이징 컨트롤이 렌더링될 DOM 컨테이너의 ID.
     * @param {function} renderCallback - 페이징된 데이터를 받아 실제 화면에 렌더링하는 콜백 함수.
     * @param {number} [itemsPerPage=10] - 한 페이지당 표시할 항목 수.
     * @param {number} [maxPageButtons=5] - 페이징 컨트롤에 표시할 최대 페이지 버튼 수.
     * @param {string|null} [scrollToElementId=null] - 페이지 이동 시 스크롤할 대상 요소의 ID.
     * @param {boolean} [showFirstLastButtons=true] - '맨 처음'/'맨 끝' 버튼 표시 여부.
     * @param {boolean} [showGoToPageInput=true] - 페이지 번호 직접 입력 필드 표시 여부.
     */
    constructor(
        containerId,
        renderCallback,
        itemsPerPage = 10,
        maxPageButtons = 5,
        scrollToElementId = null,
        showFirstLastButtons = true,
        showGoToPageInput = true
    ) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Pagination container with ID "${containerId}" not found.`);
            return;
        }
        this.container.classList.add('pagination-wrapper'); // 전체 컨테이너에 wrapper 클래스 추가

        this.renderCallback = renderCallback;
        this.itemsPerPage = itemsPerPage;
        this.maxPageButtons = maxPageButtons;
        this.scrollToElementId = scrollToElementId;
        this.showFirstLastButtons = showFirstLastButtons;
        this.showGoToPageInput = showGoToPageInput;

        this.totalItems = 0;
        this.currentPage = 1;
        this.data = [];

        this.pageButtonsContainer = document.createElement('div');
        this.pageButtonsContainer.classList.add('pagination-buttons');
        this.container.appendChild(this.pageButtonsContainer);

        if (this.showGoToPageInput) {
            this.goToPageContainer = document.createElement('div');
            this.goToPageContainer.classList.add('pagination-goto');
            this.container.appendChild(this.goToPageContainer);
        }

        this._setupEventListeners();
    }

    /**
     * 이벤트 리스너를 설정
     * 주로 페이지 이동 입력 필드에 대한 키보드 이벤트를 처리
     */
    _setupEventListeners() {
        if (this.showGoToPageInput && this.goToPageContainer) {
            // goToPageContainer가 생성된 후에만 이벤트 리스너를 설정
            this.goToPageContainer.addEventListener('keypress', (e) => {
                // Enter 키가 눌렸을 때 _handleGoToPageInput 함수를 호출
                if (e.key === 'Enter') {
                    this._handleGoToPageInput(e);
                }
            });
        }
    }

    /**
     * 페이징 데이터를 업데이트하고 첫 페이지로 리셋하여 다시 렌더링
     * @param {Array} newData - 새로 페이징할 데이터 배열.
     * @param {number} [newItemsPerPage=this.itemsPerPage] - 업데이트된 한 페이지당 항목 수.
     * @param {boolean} [suppressInitialScroll = false] - 스크롤 이동을 억제할지 여부.
     */
    update(newData, newItemsPerPage = this.itemsPerPage, suppressInitialScroll = false) {
        this.data = newData;
        this.totalItems = newData.length;
        this.itemsPerPage = newItemsPerPage;
        this.currentPage = 1; // 데이터가 업데이트되면 첫 페이지로 리셋
        this._render(suppressInitialScroll); // suppressInitialScroll 값을 _render로 전달
    }

    /**
     * 지정된 페이지 번호로 이동하고 UI를 업데이트
     * @param {number} pageNumber - 이동할 페이지 번호.
     * @param {boolean} [suppressScroll=false] - 스크롤 이동을 억제할지 여부.
     */
    goToPage(pageNumber, suppressScroll = false) {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        if (pageNumber < 1) pageNumber = 1;
        if (pageNumber > totalPages) pageNumber = totalPages;

        // 현재 페이지와 요청 페이지가 같고 데이터가 있을 경우, 중복 렌더링 방지 (스크롤만 억제)
        if (this.currentPage === pageNumber && this.totalItems > 0 && totalPages > 0) {
            // 하지만 페이지 전환 없이 데이터만 업데이트되는 경우를 대비해 렌더링은 유지
             const startIndex = (this.currentPage - 1) * this.itemsPerPage;
             const endIndex = startIndex + this.itemsPerPage;
             const paginatedData = this.data.slice(startIndex, endIndex);
             this.renderCallback(paginatedData);
             this._renderButtons(); // 버튼 상태는 갱신
             return;
        }
        
        // 데이터가 없어서 총 페이지 수가 0일 경우, 어떤 페이지로도 이동할 수 없음
        if (totalPages === 0 && this.totalItems === 0) {
            this.currentPage = 1; // 기본값 1 유지
            this._render(suppressScroll); // 데이터 없는 상태 렌더링
            return;
        }

        this.currentPage = pageNumber;
        this._render(suppressScroll);
    }

    /**
     * 현재 페이지의 데이터를 가져와 renderCallback을 호출하고 페이지 UI를 업데이트
     * @param {boolean} [suppressScroll=false] - 스크롤 이동을 억제할지 여부.
     */
    _render(suppressScroll = false) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedData = this.data.slice(startIndex, endIndex);

        this.renderCallback(paginatedData); // 페이징된 데이터를 콜백으로 전달하여 실제 DOM 렌더링

        this._renderButtons(); // 페이지 버튼 UI 업데이트

        // 스크롤 이동이 억제되지 않았다면 페이지의 맨 위로 스크롤
        if (!suppressScroll) {
            // window.scrollTo({
            //     top: 0,
            //     behavior: 'smooth' // 부드럽게 스크롤
            // });
            // 특정 요소까지 스크롤
            const element = document.getElementById(this.scrollToElementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /**
     * 페이지 버튼을 생성하고 컨테이너에 추가
     * @param {string} text - 버튼에 표시될 텍스트 (예: '1', '>>').
     * @param {number} pageNumber - 이 버튼이 연결될 페이지 번호.
     * @param {boolean} isActive - 현재 활성화된 페이지 버튼인지 여부.
     * @param {boolean} [isDisabled=false] - 버튼을 비활성화할지 여부.
     */
    _appendPageButton(text, pageNumber, isActive, isDisabled = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.classList.add('pagination-btn');
        if (isActive) button.classList.add('active');
        if (isDisabled) button.disabled = true;

        if (!isDisabled) {
            button.addEventListener('click', () => {
                this.goToPage(pageNumber);
            });
        }
        this.pageButtonsContainer.appendChild(button);
    }

    /**
     * 페이지 버튼 사이에 생략 부호 '...'를 추가
     */
    _appendEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.classList.add('pagination-ellipsis');
        ellipsis.textContent = '...';
        this.pageButtonsContainer.appendChild(ellipsis);
    }

    /**
     * 페이지 번호 버튼 UI를 렌더링
     * 첫 페이지와 마지막 페이지를 항상 표시하며, 중간 페이지는 생략 부호로 처리
     */
    _renderButtons() {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.pageButtonsContainer.innerHTML = ''; // 기존 버튼 초기화

        // 총 페이지가 1이하이거나, 데이터가 없으면 페이징 컨트롤을 숨김
        if (totalPages <= 1 && !this.showGoToPageInput && this.totalItems === 0) {
            this.container.classList.add('hidden');
            return;
        } else {
            this.container.classList.remove('hidden');
        }

        // --- 맨 처음/이전 페이지 버튼 ---
        if (this.showFirstLastButtons) {
            this._appendPageButton('<<', 1, false, this.currentPage === 1);
        }
        this._appendPageButton('<', Math.max(1, this.currentPage - 1), false, this.currentPage === 1);

        // --- 페이지 번호 버튼 로직 (첫 페이지와 마지막 페이지 포함) ---
        let startPage = Math.max(1, this.currentPage - Math.floor(this.maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + this.maxPageButtons - 1);

        // 끝 페이지가 충분히 나오지 않을 경우, 시작 페이지를 조정하여 `maxPageButtons` 개수 유지
        if (endPage - startPage + 1 < this.maxPageButtons) {
            startPage = Math.max(1, endPage - this.maxPageButtons + 1);
        }

        // 첫 페이지 (1) 버튼 (startPage가 1보다 클 경우에만 표시)
        if (startPage > 1) {
            this._appendPageButton('1', 1, this.currentPage === 1);
            if (startPage > 2) { // 1 다음에 바로 startPage가 아니면 ... 표시
                this._appendEllipsis();
            }
        }

        // 중간 페이지 버튼들
        for (let i = startPage; i <= endPage; i++) {
            this._appendPageButton(i.toString(), i, i === this.currentPage);
        }

        // 마지막 페이지 (totalPages) 버튼 (endPage가 totalPages보다 작을 경우에만 표시)
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) { // endPage가 마지막 페이지 바로 앞이 아니면 ... 표시
                this._appendEllipsis();
            }
            this._appendPageButton(totalPages.toString(), totalPages, this.currentPage === totalPages);
        }

        // --- 다음 페이지/맨 끝 버튼 ---
        this._appendPageButton('>', Math.min(totalPages, this.currentPage + 1), false, this.currentPage === totalPages);
        if (this.showFirstLastButtons) {
            this._appendPageButton('>>', totalPages, false, this.currentPage === totalPages);
        }

        this._renderGoToPageInput(totalPages); // 페이지 입력 필드 렌더링
    }

    /**
     * 페이지 번호 직접 입력 필드를 렌더링
     * @param {number} totalPages - 총 페이지 수.
     */
    _renderGoToPageInput(totalPages) {
        if (!this.showGoToPageInput || !this.goToPageContainer) return;

        this.goToPageContainer.innerHTML = ''; // 기존 입력 필드 초기화

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = totalPages.toString();
        input.value = this.currentPage.toString();
        input.classList.add('pagination-goto-input');
        input.placeholder = `${totalPages} 페이지`;
        input.title = `총 ${totalPages} 페이지`; // 툴팁으로 총 페이지 수 표시

        const label = document.createElement('label');
        label.classList.add('pagination-goto-label');
        label.textContent = `페이지 이동 (1 - ${totalPages})`;

        const button = document.createElement('button'); // 이동 버튼 추가
        button.classList.add('pagination-goto-btn');
        button.textContent = '이동';
        button.addEventListener('click', (e) => this._handleGoToPageInput({target: input})); // input 필드 참조

        this.goToPageContainer.appendChild(label);
        this.goToPageContainer.appendChild(input);
        this.goToPageContainer.appendChild(button);
    }

    /**
     * 페이지 이동 입력 필드의 입력값을 처리
     * @param {Event} e - 키보드 또는 클릭 이벤트 객체.
     */
    _handleGoToPageInput(e) {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        const inputElement = e.target;
        let page = parseInt(inputElement.value, 10);

        if (isNaN(page) || page < 1 || page > totalPages) {
            ShowAlert(`1에서 ${totalPages} 사이의 유효한 페이지 번호를 입력하세요.`);
            inputElement.value = this.currentPage.toString(); // 잘못된 입력시 현재 페이지로 복구
            return;
        }
        this.goToPage(page);
    }
}