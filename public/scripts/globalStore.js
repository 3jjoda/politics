// public/scripts/globalStore.js
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobilePanel = document.getElementById('nav-mobile-panel');
    const closeBtn = document.getElementById('nav-close-btn');

    if (hamburgerBtn && mobilePanel && closeBtn) {
        // 햄버거 버튼 클릭 시: 메뉴 보이기
        hamburgerBtn.addEventListener('click', () => {
            mobilePanel.style.display = 'block';
        });

        // 닫기 버튼 클릭 시: 메뉴 숨기기
        closeBtn.addEventListener('click', () => {
            mobilePanel.style.display = 'none';
        });
    }
});