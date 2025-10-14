// C:\dev\politics\utils\webScraper.js
import axios from 'axios';
import { JSDOM } from 'jsdom'; // HTML 파싱을 위해 'jsdom' 라이브러리 설치 필요
import * as toughCookie from 'tough-cookie'; // <-- 이렇게 수정합니다.
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import logger from './logger.js'; // 로거 경로 조정
import qs from 'qs'; // <-- 이 라인을 추가합니다.

// 쿠키 저장소 설정
const cookieJar = new toughCookie.CookieJar();
axiosCookieJarSupport(axios); // axios에 쿠키 jar 지원 추가

class WebScraper {
    constructor() {
        this.csrfToken = null;
        this.headers = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://www.assembly.go.kr',
            // Referer는 요청마다 다를 수 있으므로 동적으로 설정할 것
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'requestAJAX': 'true',
            'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };
        // axios 인스턴스에 쿠키 jar 연결
        this.axiosInstance = axios.create({
            jar: cookieJar,
            withCredentials: true, // 쿠키가 요청에 자동으로 포함되도록 설정
            timeout: 30000 // 타임아웃 30초
        });
    }

    async initialize(initialUrl) {
        logger.info('Initializing scraper: Fetching initial page to get CSRF token and cookies...');
        try {
            const response = await this.axiosInstance.get(initialUrl, { headers: {
                'User-Agent': this.headers['User-Agent'],
                'Accept-Language': this.headers['Accept-Language'],
                'Connection': this.headers['Connection']
                // GET 요청은 POST 요청보다 헤더가 덜 필요할 수 있음
            }});

            const dom = new JSDOM(response.data);
            
            // CSRF 토큰 추출 (HTML에서 <input type="hidden" name="_csrf" value="토큰"> 형태를 가정)
            const csrfInput = dom.window.document.querySelector('input[name="_csrf"]');
            if (csrfInput && csrfInput.value) {
                this.csrfToken = csrfInput.value;
                this.headers['X-CSRF-TOKEN'] = this.csrfToken; // 헤더에 CSRF 토큰 추가
                logger.info(`CSRF token extracted: ${this.csrfToken.substring(0, 10)}...`);
            } else {
                logger.warn('CSRF token not found on the initial page. Proceeding without it.');
            }

            // 쿠키는 axios-cookiejar-support가 자동으로 처리합니다.
            logger.info('Cookies should be handled automatically by axios-cookiejar-support.');

            return true;
        } catch (error) {
            logger.error(`Failed to initialize scraper from ${initialUrl}:`, error.message);
            if (error.response) {
                logger.error('  Status:', error.response.status);
                logger.error('  Data:', error.response.data);
            }
            return false;
        }
    }

    async postData(endpoint, params, refererUrl) {
        const url = `https://www.assembly.go.kr/portal/assm/assmPrpl/${endpoint}`;
        const data = qs.stringify(params);

        const currentHeaders = { ...this.headers }; // 기본 헤더 복사
        if (refererUrl) {
            currentHeaders['Referer'] = refererUrl; // Referer 동적 설정
        }
        if (this.csrfToken) {
            currentHeaders['X-CSRF-TOKEN'] = this.csrfToken; // CSRF 토큰 추가
        }
        currentHeaders['Content-Length'] = Buffer.byteLength(data).toString(); // 정확한 Content-Length 계산

        logger.debug(`Calling POST API: ${url} with params: ${JSON.stringify(params)}`);

        try {
            const response = await this.axiosInstance.post(url, data, { headers: currentHeaders });
            logger.debug(`API Success for ${endpoint}. Status: ${response.status}`);
            return response.data;
        } catch (error) {
            logger.error(`API Error calling ${url} with params ${JSON.stringify(params)}:`);
            logger.error('  Error Message:', error.message);
            logger.error('  Error Code (if any):', error.code);
            if (error.response) {
                logger.error('  API Response Status:', error.response.status);
                logger.error('  API Response Data:', JSON.stringify(error.response.data, null, 2));
                logger.error('  API Response Headers:', JSON.stringify(error.response.headers, null, 2));
            } else if (error.request) {
                logger.error('  No response received from API server (request was made).');
                logger.error('  Request config:', JSON.stringify(error.config, null, 2));
            } else {
                logger.error('  Error setting up request:', error.message);
            }
            return null;
        }
    }
}

export default WebScraper;