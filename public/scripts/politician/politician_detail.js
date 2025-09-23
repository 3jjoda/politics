document.addEventListener('DOMContentLoaded', () => {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // 링크의 기본 동작(페이지 이동) 방지

            const targetTab = link.dataset.tab; // 클릭된 탭의 data-tab 값 (예: 'tab-main')

            // 모든 탭 링크와 콘텐츠에서 'active' 클래스 제거
            tabLinks.forEach(item => item.classList.remove('active'));
            tabContents.forEach(item => item.classList.remove('active'));

            // 클릭된 탭과 그에 맞는 콘텐츠에 'active' 클래스 추가
            link.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
});