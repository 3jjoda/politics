// watchdog.js — 배치가 멈췄을 때 프로세스를 강제 종료시키는 안전장치
//
// 왜 필요한가:
//   Railway 크론은 컨테이너가 종료돼야 다음 실행을 잡는다. 그런데 멈춘 배포를
//   자동으로 죽이지 않기 때문에, 배치가 소켓 대기 등으로 매달리면
//     · 이후 모든 크론 실행이 조용히 스킵되고
//     · 그 컨테이너가 24시간 계속 과금된다 (실행 중일 때만 과금 = 안 끝나면 계속 과금)
//   측정된 실행 시간이 배치당 30~90초이므로 기본 15분이면 10배 이상 여유다.
//
// 타이머는 unref() 한다 — 정상 완료 시 이 타이머가 프로세스 종료를 막으면 안 되고,
// 반대로 다른 무언가가 이벤트 루프를 붙잡고 있으면(=멈춤) 정상적으로 발화한다.

import logger from './logger.js';

export const startWatchdog = (label, minutes = 15) => {
    const timer = setTimeout(() => {
        logger.error(`[watchdog] ${label} 이(가) ${minutes}분을 초과했습니다. 프로세스를 강제 종료합니다.`);
        logger.error('[watchdog] batch_runs 에 status=running 으로 남습니다 — 멈춤 감지 신호로 쓰세요.');
        process.exit(1);
    }, minutes * 60 * 1000);

    timer.unref();
    return () => clearTimeout(timer);
};
