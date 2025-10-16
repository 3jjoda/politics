// C:\dev\politics\utils\webScraper.js (The True Final - Manual Cookie Handling)

import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as toughCookie from 'tough-cookie';
import logger from './logger.js';
import qs from 'qs';
import axiosRetry from 'axios-retry';

class WebScraper {
    constructor() {
        this.cookieJar = new toughCookie.CookieJar();
        this.axiosInstance = axios.create({ timeout: 60000 });
        axiosRetry(this.axiosInstance, {
            retries: 3,
            retryDelay: (retryCount, error) => {
                logger.warn(`Request failed (attempt #${retryCount}). Retrying... Error: ${error.message}`);
                return retryCount * 1000;
            },
            retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500
        });
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
    }
    async _applyCookies(url, headers) { const cookieString = await this.cookieJar.getCookieString(url); if (cookieString) { headers['Cookie'] = cookieString; } }
    async _storeCookies(url, responseHeaders) { const setCookie = responseHeaders['set-cookie']; if (setCookie) { await Promise.all(setCookie.map(cookie => this.cookieJar.setCookie(cookie, url))); } }

    async initialize(initialUrl) {
        logger.info(`Initializing scraper for ${initialUrl.split('monaCd=')[1].split('&')[0]}...`);
        try {
            const requestHeaders = { 'User-Agent': this.headers['User-Agent'] };
            const response = await this.axiosInstance.get(initialUrl, { headers: requestHeaders });
            await this._storeCookies(initialUrl, response.headers);
            const dom = new JSDOM(response.data);
            const csrfInput = dom.window.document.querySelector('input[name="_csrf"]');
            if (csrfInput?.value) { this.csrfToken = csrfInput.value; }
            return true;
        } catch (error) { throw new Error(`Scraper initialization failed: ${error.message}`); }
    }

    async postData(endpoint, params, refererUrl) {
        const url = `https://www.assembly.go.kr/portal/assm/assmPrpl/${endpoint}`;
        const data = qs.stringify(params);
        const currentHeaders = { ...this.headers, 'Referer': refererUrl };
        if (this.csrfToken) { currentHeaders['X-CSRF-TOKEN'] = this.csrfToken; }
        try {
            await this._applyCookies(url, currentHeaders);
            const response = await this.axiosInstance.post(url, data, { headers: currentHeaders });
            await this._storeCookies(url, response.headers);
            const responseData = response.data;
            if (responseData?.pageNav) {
                const dom = new JSDOM(responseData.pageNav);
                const newCsrfInput = dom.window.document.querySelector('input[name="_csrf"]');
                if (newCsrfInput?.value && newCsrfInput.value !== this.csrfToken) {
                    this.csrfToken = newCsrfInput.value;
                    logger.debug(`New CSRF token from pageNav updated.`);
                }
            }
            return responseData;
        } catch (error) {
            logger.error(`API Error calling ${url}`, error.message);
            throw error;
        }
    }
}
export default WebScraper;