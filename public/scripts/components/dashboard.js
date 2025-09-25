/**
 * 대시보드 (가로 막대 그래프)
 */
export function createDashboardBox(data, groupByKey, title) {
    if (!data || data.length === 0) return '';
    const total = data.length;

    const countMap = data.reduce((acc, item) => {
        const key = item[groupByKey] || '기타';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const sortedData = Object.entries(countMap).sort((a, b) => b[1] - a[1]);

    const itemsHTML = sortedData.map(([label, count]) => {
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
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

    // 박스 전체 HTML을 완성하여 반환
    return `<div class="stat-box"><h3>${title}</h3>${itemsHTML}</div>`;
}
