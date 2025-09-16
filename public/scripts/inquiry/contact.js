const form = document.getElementById('contactForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        message: document.getElementById('message').value
    };

    try {
        const response = await fetch('/api/inquiry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            alert('문의가 성공적으로 접수되었습니다. 감사합니다!');
            form.reset();
        } else {
            alert('문의 접수에 실패했습니다. 다시 시도해 주세요.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    }
});