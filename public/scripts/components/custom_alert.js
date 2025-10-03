// public/scripts/components/custom_alert.js (수정)

let overlay;
let messageElement;
let isInitialized = false; // 초기화 여부 플래그 추가
let pendingAlerts = []; // 대기 중인 알림을 저장할 배열

document.addEventListener('DOMContentLoaded', () => {
    overlay = document.getElementById('custom_alert-overlay'); // custom_alert-overlay로 통일했다고 가정
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom_alert-overlay';
        overlay.className = 'custom_alert-overlay hidden';
        const alertBox = document.createElement('div');
        alertBox.className = 'custom_alert-box';
        messageElement = document.createElement('p');
        messageElement.className = 'custom_alert-message';
        const okButton = document.createElement('button');
        okButton.className = 'custom_alert-ok-btn';
        okButton.textContent = '확인';
        alertBox.appendChild(messageElement);
        alertBox.appendChild(okButton);
        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);

        okButton.addEventListener('click', () => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
            processNextAlert(); // 다음 대기 중인 알림 처리
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
                processNextAlert(); // 다음 대기 중인 알림 처리
            }
        });
    } else {
        messageElement = overlay.querySelector('.custom_alert-message');
        const okButton = overlay.querySelector('.custom_alert-ok-btn');
        okButton.addEventListener('click', () => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
            processNextAlert();
        });
    }
    isInitialized = true; // 초기화 완료
    processNextAlert(); // 대기 중인 알림 처리 시작
});

// 대기 중인 알림을 하나씩 처리
function processNextAlert() {
    if (pendingAlerts.length > 0 && (overlay && overlay.classList.contains('hidden'))) {
        const message = pendingAlerts.shift(); // 첫 번째 알림 가져오기
        _displayAlert(message);
    }
}

// 실제 알림을 표시하는 내부 함수
function _displayAlert(message) {
    if (!overlay || !messageElement) {
        // 이 지점에서는 초기화가 되어 있어야 하지만, 만약을 대비
        console.error("Custom alert elements are unexpectedly null during display.");
        alert(message);
        return;
    }
    messageElement.textContent = message;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export const ShowAlert = (message) => {
    if (isInitialized && (overlay && overlay.classList.contains('hidden'))) {
        // 이미 초기화되었고 팝업이 숨겨진 상태 (다른 알림 없음)
        _displayAlert(message);
    } else {
        // 아직 초기화되지 않았거나 다른 팝업이 표시 중인 경우, 대기열에 추가
        pendingAlerts.push(message);
        // DOMContentLoaded가 아직 발생하지 않았다면, 발생 시 처리될 것임
        // 이미 발생했고 다른 팝업이 표시 중이라면, 현재 팝업이 닫힐 때 처리될 것임
    }
};