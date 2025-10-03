// public/scripts/main.js

// 공통으로 사용될 컴포넌트들을 이곳에서 import 합니다.
// 이렇게 import된 모듈들은 자동으로 실행됩니다 (예: custom_alert.js의 DOMContentLoaded 리스너가 등록됨).
import { ShowAlert } from './components/custom_alert.js'; // custom_alert 모듈 로드

// 다른 공통 컴포넌트/유틸리티 모듈들도 이곳에 추가 (현재는 ShowAlert만)
// import { someOtherUtility } from './utils/some-utility.js';
// import { anotherComponent } from './components/another-component.js';

console.log('Main application script loaded. Common modules initialized.');