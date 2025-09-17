import InquiryDao from '../dao/InquiryDao.js';
import crypto from 'crypto'; // 또는 별도 암호화 유틸

export default (db) => {
    const inquiryDao = InquiryDao(db);

    const encryptPhone = (phone) => {
        // 예시: SHA256 해시
        return crypto.createHash('sha256').update(phone).digest('hex');
    };
    
    return {
        /* 견적 조회 */
        getList: (callback) => {
            inquiryDao.getList(callback);
        },

        /* 견적 상세 조회 */
        getDetail: (id, callback) => {
            inquiryDao.getDetail(id, callback);
        },

        /* 견적 저장 */
        insert: (data, callback) => {
            /* 비즈니스 로직 예 - 암호화 */
            const encryptedPhone = encryptPhone(data.phone);
            const newData = { ...data, phone: encryptedPhone };

            inquiryDao.insert(data, callback);
        }
    };
};