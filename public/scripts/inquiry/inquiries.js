document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('inquiriesTableBody');

    try {
        const response = await fetch('/api/inquiries');
        const inquiries = await response.json();

        inquiries.forEach(inquiry => {
            const row = document.createElement('tr');
            row.classList.add('clickable-row');

            const date = new Date(inquiry.CREATED_AT).toLocaleDateString('ko-KR');

            row.innerHTML = `
                <td>${inquiry.ID}</td>
                <td>${inquiry.NAME}</td>
                <td>${inquiry.EMAIL}</td>
                <td>${inquiry.PHONE}</td>
                <td>${date}</td>
            `;

            row.addEventListener('click', () => {
                window.location.href = `inquiry_detail.html?id=${inquiry.ID}`;
            });

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching inquiries:', error);
        tableBody.innerHTML = '<tr><td colspan="5">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
});