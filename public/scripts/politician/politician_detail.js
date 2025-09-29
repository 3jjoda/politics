// politician_detail.js

document.addEventListener('DOMContentLoaded', function() {
    const radarChartCanvas = document.getElementById('politicianRadarChart');
    if (radarChartCanvas) {
        // EJS에서 data-analysis 속성으로 JSON 데이터를 전달받아 파싱
        const analysisData = JSON.parse(radarChartCanvas.dataset.analysis || '{}');

        // 더미 데이터 (실제 데이터가 없는 경우를 대비)
        const defaultLabels = ['출석률', '대표발의', '공동발의', '위원회활동', '표결참여', '정책일치'];
        const defaultValues = [80, 70, 60, 85, 90, 75];

        const labels = analysisData.labels || defaultLabels;
        const values = analysisData.values || defaultValues;

        const ctx = radarChartCanvas.getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: '의정활동 지표',
                    data: values,
                    backgroundColor: 'rgba(0, 86, 179, 0.4)', // --primary-color의 rgba 버전
                    borderColor: 'rgba(0, 86, 179, 1)',
                    borderWidth: 1,
                    pointBackgroundColor: 'rgba(0, 86, 179, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(0, 86, 179, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // 컨테이너에 맞춰 크기 조절
                scales: {
                    r: {
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        pointLabels: {
                            font: {
                                size: 12
                            }
                        },
                        min: 0,
                        max: 100 // 지표의 최대값
                    }
                },
                plugins: {
                    legend: {
                        display: false // 범례 숨김
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw + '%';
                            }
                        }
                    }
                }
            }
        });
    }
});