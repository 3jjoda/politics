// public/scripts/globalStore.js
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobilePanel = document.getElementById('nav-mobile-panel');
    const closeBtn = document.getElementById('nav-close-btn');

    // 페이지 로드 시 메뉴가 열려있으면 닫기 (뒤로가기 복원 시에도 적용)
    if (mobilePanel && mobilePanel.style.display === 'block') {
        mobilePanel.style.display = 'none';
        document.body.classList.remove('menu-open');
    }

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
    const menu = mobilePanel; // Use mobilePanel as the menu

    function openMenu() {
        menu.style.display = 'block'; // Open the menu
        document.body.classList.add('menu-open');
    }

    function closeMenu() {
        menu.style.display = 'none'; // Close the menu
        document.body.classList.remove('menu-open');
    }

    // 햄버거 버튼 클릭 시 메뉴 열기 
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openMenu);
    }

    // 닫기 버튼 클릭 시 메뉴 닫기
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMenu);
    }

    // 메뉴창이 아닌 영역 클릭 시 메뉴 닫기
    document.addEventListener('click', function(e) {
        if (menu && menu.style.display === 'block') {
            // 메뉴, 햄버거 버튼, 닫기 버튼이 아닌 영역 클릭 시 닫기
            if (!menu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                closeMenu();
            }
        }
    });

    // 뒤로가기(popstate) 시 메뉴 닫기
    window.addEventListener('popstate', function() {
        // popstate 발생 시 메뉴가 열려있으면 무조건 닫기 (상태 복원 방지)
        if (menu) {
            closeMenu();
        }
    });
    
        // pageshow(히스토리 복원 포함) 시 메뉴 닫기 (모바일/브라우저 모두 대응)
        window.addEventListener('pageshow', function() {
            if (menu) {
                closeMenu();
            }
        });
});