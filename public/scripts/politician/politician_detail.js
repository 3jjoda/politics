document.addEventListener('DOMContentLoaded', () => {
    /**
     * 상세 정보 펼쳐보기/접기 기능
     */
    const toggleBtn = document.getElementById('toggle-details-btn');
    const hiddenDetails = document.getElementById('hidden-details');

    if (toggleBtn && hiddenDetails) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = hiddenDetails.classList.toggle('visible');
            if (isVisible) {
                toggleBtn.textContent = '상세 프로필 접기 ▲';
            } else {
                toggleBtn.textContent = '상세 프로필 펼쳐보기 ▼';
            }
        });
    }

    /**
     * 방사형 차트(Radar Chart) 예시 데이터 및 생성
     */
    const ctx = document.getElementById('politicianRadarChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['본회의 출석률', '법안 통과율', '대표발의', '상임위 출석률', '재산 증가율'],
                datasets: [{
                    label: '데이터 분석',
                    data: [95, 75, 82, 92, 60],
                    fill: true,
                    backgroundColor: 'rgba(0, 86, 179, 0.2)',
                    borderColor: 'rgb(0, 86, 179)',
                    pointBackgroundColor: 'rgb(0, 86, 179)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(0, 86, 179)'
                }]
            },
            options: {
                elements: { line: { borderWidth: 3 } },
                scales: { r: { angleLines: { display: false }, suggestedMin: 0, suggestedMax: 100 } }
            }
        });
    }
});
