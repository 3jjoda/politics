// updateBillTopics.js (키워드 파일 직관적 수정 및 로딩 기능 반영 버전)

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import vm from 'vm'; // 안전한 코드 실행을 위해 vm 모듈 사용

const CONCURRENT_UPDATE_LIMIT = 50;
// 키워드와 미분류 목록을 모두 포함하는 파일
const TOPIC_REVIEW_FILE = path.join(process.cwd(), 'data', 'topic_keywords_and_review.txt');
const RECLASSIFY_CODE = 998;

// --- [정의] Topic 키워드 (코드 내 원본) ---
// Note: 이 데이터는 초기 파일 생성 및 파일 파싱 오류 시 대체용으로 사용됩니다.
// 실제 분류 시에는 파일에서 로드된 내용이 사용됩니다.
// TOPIC_KEYWORDS_RAW 업데이트
const TOPIC_KEYWORDS_RAW = {
    '보건/복지/의료': [
        '국민건강보험', '의료', '치매', '환자', '간호', '장애인복지', '노인복지', '영유아보육', '국민연금', '기초연금', '정신건강', '응급의료', '후천성면역결핍', '희귀질환', '돌봄', '보건', '요양', '간호법', '소아청소년', '산모', '자살예방', '의료급여', '치매관리', '장기요양', '복지', '약사법', '건강', '구강보건', '노인복지법', '동물보호', '은둔형 외톨이', '장애인권리보장', '아토피질환', '장애인권리보장법', '장애인활동지원', '차별조항 정비', '위기임산부', '양육비', '암관리법', '생활동반자', '혈액관리', '장애인연금', '인체조직', '한의약', '효행', '한센인', '고독사', '위생용품', '장사', '시체해부', '국민기초생활', '기초생활보장', '장애인노인임산부', '장기이식', '결핵예방', '국민영양관리', '생명윤리', '제대혈', '아동수당', '결핵', '편의증진', '임산부등의편의증진', '감염병예방', '기초생활', '한부모가족', '아동청소년성보호', '성매매방지', '성매매알선', '여성폭력', '장기등이식', '국민기초', '실종아동', '실종자보호', '미성년자보호', '감염병의예방및관리에관한법률', '국민기초생활보장법', '공중위생', '한부모가족지원', '저출산고령사회', '의사상자', '공중화장실', '사회보장급여', '기초노령연금', '노후준비', '사회보장기본법', '장애인차별금지', '권리구제', '사회서비스', '이용권관리', '중증장애인', '장애인생산품', '사회서비스이용', '검역', '실험동물', '심뇌혈관질환', '전염병예방', '아동빈곤', '생명연구자원', '보조기기', '취약계층청년'
    ],
    '교육/인재/학술': [
        '교육', '학교', '학생', '대학', '사립학교', '학술', '직업교육', '평생교육', '영재교육', '교원', '학점인정', '과학관', '사관학교', '인재', '교과용', '변호사시험', '만 나이', '청소년활동', '한국교육학술정보원', '한국대학교육협의회', '기초학력', '과학기술인', '연구개발', '이공계', '지방교육자치', '이공계지원', '교원의 지위', '유아교육', '군인사관학교', '대학도서관', '교육시설', '교육환경', '학교급식', '학원', '특수교육', '학교폭력', '자퇴', '학력', '독학', '만 나이로의 통일', '한국장학재단', '장학재단', '한국교직원공제회', '학자금상환', '폐교재산', '한국사학진흥재단', '자격기본법', '국어기본법', '국가연구데이터', '한국연구재단', '뇌연구', '국가초고성능컴퓨터'
    ],
    '노동/고용/자영업': [
        '근로', '노동조합', '임금', '고용', '소상공인', '자영업', '직능인', '필수노동자', '기간제', '파견근로', '산재', '경력단절', '일자리', '노동', '최저임금', '근로자직업능력', '남녀고용평등', '채용', '근로자의 날', '퇴직급여', '임금채권', '실업자', '노동소송', '외국인근로자', '플랫폼종사자', '돌봄노동자', '직업능력개발', '직업안정', '청년기본', '고용보험', '청년일자리', '근로자퇴직급여', '사회적기업', '직업안정법', '노사관계발전', '구직자취업촉진', '국민평생직업능력', '청년실업해소', '사회적기업육성', '공무직', '일하는사람', '퇴직연금공단'
    ],
    '국토/도시/주택': [
        '주택', '건축', '도시', '재개발', '도로', '철도', '교통', '부동산', '택지', '주차장', '공동주택', '개발제한구역', '도시재생', '항공', '공항', '물류', '철도안전', '항만', '도선', '유료도로', '토지', '지적', '공간정보', '대심도', '도시철도', '건설기계', '주거약자', '유통시설', '민간임대주택', '스마트워크', '도심', '택시', '승강기', '측량', '공인중개사', '건축물', '노후계획도시', '신항만', '전세사기', '수원군공항', '달빛고속철도', '주택임대차', '임대보증금', '궤도운송', '자동차', '운수사업', '선박입항', '집합건물', '보행안전', '하수도', '친수구역', '국토의계획', '개인형이동수단', '먼섬', '새만금사업', '주거기본', '수도권정비', '용산공원', '역세권개발', '고도보존', '송변전설비', '국토계획', '개발이익환수', '사회기반시설', '공유재산', '주거급여', '해운법', '공유수면', '수도권정비계획법', '자전거이용', '공유재산관리', '선박직원', '옥외광고물', '선박입출항', '국토기본법', '해수욕장', '연안관리', '선박소유자책임제한', '폐광지역', '경관법', '선박출항', '인구감소지역', '동서남해안', '섬발전', '수자원조사', '해외건설', '항로표지', '온천법', '지역개발', '내륙권발전', '선박법', '해운조합', '건설안전', '지방소멸', '수로업무', '도로법', '간선급행버스체계', '기계설비'
    ],
    '환경/기후/에너지': [
        '환경', '기후', '탄소', '에너지', '원자력', '폐기물', '자원순환', '소음', '대기', '물관리', '석면', '재활용', '오존층', '토양환경', '하천', '해양환경', '수소', '방사선', '녹색성장', '자연환경', '친환경', '유해화학물질', '수도권 대기', '댐건설', '광업', '배터리', '수질', '산지관리', '바이오가스', '녹색건축', '지하수', '해양폐기물', '유류오염', '미세플라스틱', '태양광', '해상풍력', '액화천연가스', '이산화탄소 포집', '잔류성유기오염물질', '광산', '골재채취', '실내공기질', '발전소주변', '온실가스배출권', '국립공원공단', '전원개발', '습지보전', '악취방지', '물재이용', '소나무재선충병', '백두대간', '빛공해', '미세먼지저감', '자연공원', '석유사업', '수도법', '야생생물보호', '석유대체연료', '자연공원법', '물의재이용', '생물다양성', '수도권매립지', '인공조명빛공해', '녹색제품', '생물다양성보전', '국립생태원', '생물자원관', '수자원', '석탄화력', '낙동강취수원', '녹색융합클러스터', '공공폐자원관리시설', '생활화학용품', '탈석탄', '국립낙동강생물자원관', '유전자변형생물체'
    ],
    '농림축산/수산/해양': [
        '농지', '농산물', '어촌', '수산', '축산', '산림', '농림어업', '양곡', '낙농', '김산업', '종자산업', '양봉', '임업', '가축', '어선', '해양', '수산식품', '수산자원', '농어촌', '농업재해', '농어업회의소', '수산업협동조합', '한우', '목재', '간척지', '농약', '양식', '갯벌', '농업인', '토종닭', '식물방역', '소금산업', '광업', '한약이력추적', '수산직접지불제', '반려동물사료', '엽연초', '낚시', '선원', '어장', '연안사고', '무인도서', '연근해어업', '농업협동조합', '초지', '농업소득', '사료관리', '여성농어업인', '선박평형수', '해저광물자원', '쌀소득', '어업협동조합', '선박안전', '농촌진흥', '농업기계화', '산림경영', '어촌어항', '비료관리', '국유림', '수목원정원', '식물신품종', '사방사업', '농업농촌공익기능', '직접지불', '배타적경제수역', '귀농어귀촌', '후계농어업인', '농산자조금', '농업생명자원', '농어가목돈마련', '염업조합', '스마트농업'
    ],
    '조세/재정/금융': [
        '조세', '세법', '금융', '보험', '국세', '지방세', '국채', '예금자', '자산관리', '신용보증', '증권거래세', '상속세', '법인세', '부가가치세', '주세', '특정 금융거래', '은행법', '지방재정', '복권기금', '한국은행', '신용', '부담금', '개별소비세', '공공자금', '소득세법', '전자금융거래', '화폐', '투자회사', '파산', '채권', '예금자보호', '부정수표', '고향사랑 기부', '디지털자산', '과세자료', '수입인지', '국가회계', '국가재정', '가상자산', '금융기관', '외국환', '국유재산', '공적자금관리', '공공재정', '공적자금상환', '지방회계', '이자제한', '재정민주화', '우편대체', '보조금관리', '국세징수', '지방세징수', '외국환거래', '공적자금', '기부금품', '새마을금고', '국고금관리', '주식사채전자등록', '국가재정법', '외부감사', '주식회사등의외부감사', '수출용원재료', '한국감정원', '자산유동화', '공사채등록', '휴면예금', '기업구조조정', '재정건전화', '주식회사의외부감사', '주식사채등의전자등록', '한국재정정보원', '대외경제협력기금', '보증인보호', '우편환법', '沒收金品等處理', '공공차관', '인터넷전문은행', '지역공공은행', '지역재투자기금', '공정배상기금', '상장회사지배구조', '등기특별회계', '국내재산도피'
    ],
    '산업/기술/R&D': [
        '산업', '기술', '과학', '정보통신', '반도체', 'AI', '인공지능', '벤처기업', '중소기업', '기술혁신', '지식재산', '소재ㆍ부품ㆍ장비', '디지털', '클라우드', '로봇', '데이터베이스', '특허', '디자인', '정부출연', '뿌리산업', '메타버스', '소프트웨어', '광융합', '초전도', '전기사업', '무역', '해외자원', '기술보증', '엔지니어링', '광물자원공사', '공장설립', '빅데이터', '데이터베이스산업', '디지털자산', '실용신안', '통신사업', '벤처투자', '소재부품', '전자서명', '정기간행물', '조달사업', '조달', '공급망', '경제안보', '기업활력', '지능정보화', '발명진흥', '우주개발', '부정경쟁방지', '전기공사업', '제품안전', '드론활용', '수소경제', '개인정보보호', '통신비밀', '우주개발진흥', '전파법', '전기통신사업', '개인정보보호법', '경제자유구역', '위치정보', '외국인투자', '전자문서전자거래', '데이터기반행정', '공공데이터', '국가표준기본', '기술사법', '중견기업', '장애인기업', '해외진출기업', '국내복귀', '1인창조기업', '여성기업', '전기통신기본법', '지능형전력망', '전기공사공제조합', '인터넷주소자원', '정보화촉진', '부품소재전문기업', '책임운영기관', '적합성평가', '전력망', '소형원자로', '사회적경제기업', '전자문서', '전자거래', '해외진출기업국내복귀', '장애인기업활동', '특정연구기관', '생명공학육성', '국가초고성능컴퓨터', '합성생물학'
    ],
    '행정/공공/사법': [
        '공무원', '지방자치', '공공기관', '민원', '행정심판', '행정절차', '사법', '법원', '헌법재판소', '검찰', '감사원', '공직자윤리', '국민권익', '경찰', '징벌적배상', '정부조직', '주민등록', '민방위', '전자정부', '공익신고자', '부패방지', '지방행정동우회', '지방공기업', '국가공무원', '지방공무원', '공익법인', '공정채용', '법률구조', '법무사', '세무사', '통계법', '헌법재판소법', '법무행정관', '경찰제복', '특정중대범죄 피의자 등 신상정보 공개', '행정소송법', '형사소송법', '민사소송법', '법원조직법', '국회에서의 증언', '국가배상법', '공탁법', '검사징계', '법관징계', '성폭력범죄', '공증인', '보호관찰', '공탁', '공공감사', '가정폭력', '가정', '범죄의처벌', '스토킹범죄', '과거사정리', '형사보상', '인신보호', '소년', '사면', '특정범죄가중처벌', '전자장치부착', '형집행', '범죄피해자보호', '민사집행', '특정범죄신고자', '행정조사', '국민의형사재판참여', '피해자보호', '성폭력방지', '가족관계등록', '사형', '국적법', '입양특례', '국적', '형법', '소송촉진', '공직자윤리', '보호 및 지원', '피해자지원', '민사집행법', '국가계약', '부정청탁', '형의집행', '형의실효', '자원봉사', '비영리민간단체', '행정기관위원회', '민사조정', '신탁법', '중재법', '비송사건절차', '국가소송', '민사소송등전자문서', '민사소송등인지', '정부법무공단', '교정공제회', '소액사건심판', '본인서명사실', '후견등기', '국제수형자이송', '집행관', '정부대표특별사절', '보증인보호', '법령정보', '귀속재산처리', '인감증명', '지방행정제재', '부패재산몰수', '폭력행위', '디엔에이신원확인', '헌정질서파괴범죄', '벌금미납자사회봉사', '국가를당사자로하는계약', '가족관계의등록', '상훈', '특정경제범죄', '가사소송', '치료감호', '세종특별자치시', '주민소환', '법령등공포', '대한민국재향경우회', '행정기본법', '지방행정체제개편', '국가장', '군형집행군수용자처우', '행정대집행', '보호시설미성년자후견', '유실물', '국가를당사자로하는소송', '전북특별자치도', '강원특별자치도', '노근리사건', '10·27법난', '청원법', '피한정후견인', '형사소송비용', '공익법무관', '교도작업', '범죄피해자보호기금', '행정기관소속위원회', '대한지방행정공제회', '지능정보화', '영상정보처리기기', '갈등관리', '불법온라인사행행위', '민영교도소', '물품관리', '한국지방행정연구원', '검사보수'
    ],
    '안보/국방/병무': [
        '군인', '군사', '국방', '병역', '군형법', '예비군', '군사시설', '방위사업', '군검찰', '국가안보', '군포로', '국군', '군복', '총포', '비상대비', '통합방위', '주한미군', '병무', '군사기밀', '군용', '군수품', '군사경찰', '전투경찰대', '군인사법', '군사기지', '군복무', '국가유공자', '보훈', '참전유공자', '제2연평해전', '군급식', '특수임G무유공자', '사이버안보', '국가정보원', '도서개발', '영토주권', '독도', '동해', '국립묘지', '특수임무수행자', '대체역', '징병', '계엄법', '병무청', '특수임무', '병역의무', '국립묘지의설치및운영에관한법률', '접경지역', '전쟁기념사업', '방어해면', '영해및접속수역', '테러방지', '서해5도', '국가안전보장회의', '군책임운영기관', '보안관찰법', '유엔참전용사', '서해수호기념관'
    ],
    '문화/체육/예술': [
        '문화재', '문화', '예술', '체육', '영화', '미디어', '방송', '박물관', '만화', '태권도', '이스포츠', '국악', '한복', '스포츠', '콘텐츠', '독서문화', '음악산업', '문화산업진흥', '무형문화재', '도서관', '공연', '애니메이션', '바둑', '게임산업', '문화유산', '체육시설', '문화교류', '신문', '동물원', '식물원', '국제경기대회', '관광진흥', '경륜경정', '전통무예', '국가유산', '저작권', '문학진흥', '대한민국국기', '한국마사회', '전통소싸움', '언론중재', '국어기본', '문화재보호', '저작권법', '관광기본', '뉴스통신', '국민여가', '독립기념관', '향교재산', '전통사찰', '세계유산', '한국고전번역원', '대한민국헌정회', '한국4에이치활동', '평창동계올림픽', '장애인동계올림픽', '여수세계박람회', '2011대구세계육상선수권대회', '2014인천아시아경기대회', '한국학중앙연구원', '점자', '한국수화언어', '사진진흥', '매장유산'
    ],
    '안전/재난/소방': [
        '안전관리', '재난', '소방', '화재', '응급의료', '승강기안전', '방사능', '위험물', '경비업', '지진', '119', '사격장', '급경사지', '수상레저', '재해', '석면피해', '해사안전', '교통안전', '경범죄', '긴급구호', '다중이용업소', '화학물질', '전기통신금융사기', '가습기살균제', '소방장비', '전기안전', '교제폭력범죄', '자율방범대', '시설물안전', '수상수색', '수색구조', '시설물유지관리', '어린이제품안전', '기상관측표준화', '수중레저활동', '해양사고'
    ],
    '통일/외교/남북': [
        '북한', '남북교류', '통일', '재외국민', '외교', '위안부', '강제동원', '북한이탈주민', '판문점', '개성공단', '한미동맹', '일본정부', '남북관계', '북핵', '미얀마', '우크라이나', '쿠르드', '해외이주', '국제연합', '대일항쟁기', '겨레말큰사전', '남북협력기금', '독립유공자', '6·25', '종전선언', '역사왜곡', '한·아랍재단', '북한주민 모자보건', '판문점선언', '민주유공자', '미국산쇠고기', '출입국', '재외동포', '남북경제협력', '국제개발협력', '국제적십자', '통상조약', '재한외국인', '남북이산가족', '국제협력단', '대외원조', '국제질병퇴치', '한-아프리카재단', '여수순천1019', '민주화운동', '부마민주항쟁', '민주화', '518', '세월호', '대한민국과페루공화국간의사회보장에관한협정', '제주43', '통상조약체결', '국제교류재단', '동학농민혁명', '고려인동포', '개성공업지구', '이북5도', '남북이산가족생사확인', '범죄인인도법', '국제형사사법공조', '한국국제협력단', '여권', '대한적십자사', '일제강점하반민족행위', '10·27법난', '대한민국재외공관', '동북아역사재단', '사할린동포', '518민주화운동보상', '여수순천1019', '518민주화운동진상규명', '416세월호참사', '민주화운동관련자', '재외공관용재산', '국제협력요원'
    ],
    '정치/선거/규제': [
        '공직선거', '국회', '국민투표', '정당', '규제', '특별검사', '징계안', '탄핵소추', '윤석열', '김건희', '비상계엄', '헌법', '대통령', '사법농단', '선거관리위원회', '정치자금', '인사청문', '법무부장관', '국회의원(징계)', '대통령직인수', '행정안전부장관', '공직자', '공직선거법', '고위공직자범죄수사처', '개헌절차', '국회운영위원장', '국무총리', '국무위원', '정부위원', '출석요구', '국가법안', '국회상설소위원회', '국민참여', '국민공휴일', '정치', '선거', '사임의 건', '의사일정', '국민소환', '특별감찰관', '전직대통령 예우', '정부업무평가', '입법', '대통령실', '주민투표', '성별영향분석평가', '국정감사', '국정조사', '지속가능발전', '국가인권위원회', '양성평등', '주민소환', '비영리민간단체', '공휴일', '국경일', '집회시위', '정당법', '규제개혁', '국가균형발전', '국가안전보장회의', '지방분권', '정부기관광고', '국가장', '새마을운동조직', '바르게살기운동조직', '한국자유총연맹', '신속처리안건', '국민의형사재판참여', '여성발전기본법', '정부기관및공공법인', '기본소득', '갈등관리'
    ],
    '유통/소비자/공정': [
        '유통', '소비자', '공정거래', '하도급', '방문판매', '담배', '화장품', '대리점거래', '경품', '상품권', '약관', '전자상거래', '독점규제', '집단소송', '대규모유통업', '온라인플랫폼', '할부거래', '수입식품', '마약류', '전자상거래 등에서의 소비자보호', '소비자보호', '담배사업', '상표법', '지적재산', '전통시장', '상점가', '상법', '민법', '식품위생', '표시광고', '상업등기', '가맹사업거래', '상가건물임대차', '제조물책임', '표시광고공정화', '결혼중개업', '가맹사업거래의공정화에관한법률', '식품안전기본', '식품표시광고', '협동조합', '물가안정', '가맹사업진흥', '상공회의소', '식품의약품분야시험검사', '염업조합', '배달플랫폼'
    ],
};

const SPECIAL_TOPIC_KEYWORDS_RAW = {
    '국회/행정절차': ['출석요구의건', '의사일정변경동의의건', '사임의건', '운영위원장', '법률제명약칭법안', '의안의비용추계', '국회운영', '출석요구', '의사일정', '정부위원', '국무총리', '국무위원', '사임의건', '사퇴촉구', '징계안', '의회지도자', '신속처리안건', '계엄법', '본회의'],
    '정치/외교 이벤트': ['탄핵소추안', '탄핵소추', '특별검사임명', '비상계엄', '사임촉구', '징계안', '결의안', '유네스코세계기록유산', '군함도', '납북', '워싱턴선언', '한미정상', '대통령배우자', '주가조작', '도이치모터스', '광화문한자현판', '유관순열사', '경술국치일', '거창사건', '5.18민주화운동', '천안함', '특검', '순직해병'],
    '일반법/기타': ['일부개정법률안', '전부개정법률안', '법률안', '특별법안', '기본법안', '폐지법률안', '결의안', '징계안', '민법', '형법', '민사소송', '상법', '민사집행법', '민사소송법']
};

// 동적 맵을 저장할 변수
let TOPIC_ID_MAP = {};
let SPECIAL_TOPIC_ID = {};

// --- 유틸리티 함수 (Topic 로직) ---

/**
 * [수정됨] 파일에서 JavaScript 객체 리터럴 형태로 키워드 섹션을 파싱하여 로드합니다.
 * eval 대신 vm 모듈을 사용하여 안전성을 확보합니다.
 */
function loadKeywordsFromFile() {
    try {
        if (!fs.existsSync(TOPIC_REVIEW_FILE)) {
            logger.warn(`[키워드] 키워드 파일이 존재하지 않아 코드 내 키워드를 사용합니다.`);
            return {
                main: TOPIC_KEYWORDS_RAW,
                special: SPECIAL_TOPIC_KEYWORDS_RAW
            };
        }

        const content = fs.readFileSync(TOPIC_REVIEW_FILE, 'utf8');
        // TOPIC_KEYWORDS_RAW 정의 추출
        const mainMatch = content.match(/const TOPIC_KEYWORDS_RAW = ([\s\S]*?);/);
        // SPECIAL_TOPIC_KEYWORDS_RAW 정의 추출
        const specialMatch = content.match(/const SPECIAL_TOPIC_KEYWORDS_RAW = ([\s\S]*?);/);

        if (!mainMatch || !specialMatch) {
            logger.warn(`[키워드] 파일에서 키워드 변수 정의를 찾을 수 없습니다. 코드 내 키워드를 사용합니다.`);
            return {
                main: TOPIC_KEYWORDS_RAW,
                special: SPECIAL_TOPIC_KEYWORDS_RAW
            };
        }

        // vm.runInNewContext를 사용하여 안전하게 문자열을 객체로 변환
        const sandbox = {};
        vm.runInNewContext(`
            const TOPIC_KEYWORDS_RAW = ${mainMatch[1].trim()};
            const SPECIAL_TOPIC_KEYWORDS_RAW = ${specialMatch[1].trim()};
            keywords = {
                main: TOPIC_KEYWORDS_RAW,
                special: SPECIAL_TOPIC_KEYWORDS_RAW
            };
        `, sandbox);

        logger.info(`[키워드] 키워드 파일을 성공적으로 로드했습니다.`);
        return sandbox.keywords;

    } catch (error) {
        logger.error(`[키워드] 키워드 파일 로드 또는 파싱 오류. 코드 내 키워드를 사용합니다: ${error.message}`);
        return {
            main: TOPIC_KEYWORDS_RAW,
            special: SPECIAL_TOPIC_KEYWORDS_RAW
        };
    }
}


/**
 * [수정됨] 배치 시작 전, 키워드 정의를 JS 객체 형태로 파일 상단에 기록하고 미분류 목록 이하를 비웁니다.
 */
async function initializeReviewFile(currentKeywords) {
    const dir = path.dirname(TOPIC_REVIEW_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // JSON.stringify를 사용하여 JavaScript 객체 리터럴 형태로 포맷팅 (들여쓰기 4개)
    const formatObject = (obj) => JSON.stringify(obj, null, 4).replace(/"/g, "'");

    const keywordSection = `
# Topic Keyword Configuration (최종 업데이트: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')})
# 이 섹션 (START ~ END)만 수동으로 수정하고, 배치 실행 시 하위 목록은 자동으로 갱신됩니다.

--- 키워드 정의 START ---
const TOPIC_KEYWORDS_RAW = ${formatObject(currentKeywords.main)};

const SPECIAL_TOPIC_KEYWORDS_RAW = ${formatObject(currentKeywords.special)};
--- 키워드 정의 END ---

`;

    const reviewSectionHeader = `\n\n--- 미분류 법안 (998) 빈도수 요약 ---`;

    // 키워드 섹션만 남기고 하위 내용은 비움
    await fs.promises.writeFile(TOPIC_REVIEW_FILE, keywordSection + reviewSectionHeader, 'utf8');
    logger.info(`[파일 관리] 키워드 섹션을 보존하고 미분류 목록을 초기화했습니다.`);
}

/**
 * [기존 로직 유지] 두 키워드 맵을 비교하여 새로 추가된 키워드를 찾습니다.
 */
function getNewKeywords(oldKeywords, newKeywords) {
    const newKeys = {};
    const allTopicNames = new Set([
        ...Object.keys(oldKeywords.main),
        ...Object.keys(oldKeywords.special),
        ...Object.keys(newKeywords.main),
        ...Object.keys(newKeywords.special)
    ]);

    for (const topicName of allTopicNames) {
        newKeys[topicName] = [];

        const oldMainKeys = new Set(oldKeywords.main[topicName] || []);
        const oldSpecialKeys = new Set(oldKeywords.special[topicName] || []);
        const newMainKeys = new Set(newKeywords.main[topicName] || []);
        const newSpecialKeys = new Set(newKeywords.special[topicName] || []);

        const oldAllKeys = new Set([...oldMainKeys, ...oldSpecialKeys].map(k => k.toLowerCase().replace(/\s/g, '')));
        const newAllKeys = new Set([...newMainKeys, ...newSpecialKeys].map(k => k.toLowerCase().replace(/\s/g, '')));

        for (const key of newAllKeys) {
            if (!oldAllKeys.has(key)) {
                // 원본 키워드를 찾기 위해 newAllKeys를 다시 순회
                const originalKey = [...(newKeywords.main[topicName] || []), ...(newKeywords.special[topicName] || [])].find(k => k.toLowerCase().replace(/\s/g, '') === key);
                if (originalKey) {
                    newKeys[topicName].push(originalKey);
                }
            }
        }
    }

    // 빈 항목 제거
    for (const topicName in newKeys) {
        if (newKeys[topicName].length === 0) {
            delete newKeys[topicName];
        }
    }
    return newKeys;
}


function classifyTopic(billName) {
    let processedName = billName.toLowerCase();
    // 1. 꼬리말/일반명칭 제거
    processedName = processedName.replace(/일부개정법률안|전부개정법률안|법률안|특별법안|기본법안|폐지법률안|결의안|징계안|등에관한법률|에관한법률/g, '');

    // 2. 특수 문자, 공백 및 키워드 매칭을 방해하는 문자열을 모두 제거 (한글, 영어, 숫자만 남김)
    // 이 처리를 통해 '장애인·노인·임산부' -> '장애인노인임산부'로 완벽히 표준화됩니다.
    processedName = processedName.replace(/[^가-힣a-zA-Z0-9]/g, '');

    // 1. 정책 주제 (ID 1~15) 분류 시도
    for (const topicName in TOPIC_ID_MAP) {
        const topic = TOPIC_ID_MAP[topicName];
        if (topic.id >= 1 && topic.id <= 15) {
            for (const keyword of topic.keywords) {
                if (processedName.includes(keyword)) {
                    return topic.id;
                }
            }
        }
    }

    // 2. 특수 주제 (ID 991, 992) 분류 시도
    for (const topicName in TOPIC_ID_MAP) {
        const topic = TOPIC_ID_MAP[topicName];
        if (topic.id === (SPECIAL_TOPIC_ID['국회/행정절차'] || 991) || topic.id === (SPECIAL_TOPIC_ID['정치/외교 이벤트'] || 992)) {
            for (const keyword of topic.keywords) {
                if (processedName.includes(keyword)) {
                    return topic.id;
                }
            }
        }
    }

    // 3. 최종적으로 분류 안되면 '재분류 대기' 코드 반환 (998)
    return SPECIAL_TOPIC_ID['재분류 대기'] || RECLASSIFY_CODE;
}


// writeTopicReviewFile 함수 (기존 로직 유지)
async function writeTopicReviewFile(newReviewList) {
    const dir = path.dirname(TOPIC_REVIEW_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // 1. 키워드 섹션 불러오기 (보존)
    const existingContent = fs.readFileSync(TOPIC_REVIEW_FILE, 'utf8');
    const keywordSection = existingContent.split('--- 미분류 법안 (998) 빈도수 요약 ---')[0];

    // 2. 파일 내용 구성
    let content = keywordSection;
    content += `--- 미분류 법안 (998) 빈도수 요약 (총 ${newReviewList.length}건) ---\n`;

    if (newReviewList.length > 0) {
        // 법안명 빈도수 계산
        const nameFrequency = new Map();
        newReviewList.forEach(item => {
            const nameKey = item.name.replace(/\s/g, '');
            nameFrequency.set(nameKey, (nameFrequency.get(nameKey) || 0) + 1);
        });

        // 빈도수 내림차순 정렬 및 포맷팅
        const sortedFrequency = [...nameFrequency.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([nameKey, count]) => {
                const originalName = newReviewList.find(item => item.name.replace(/\s/g, '') === nameKey)?.name || nameKey;
                return `[${count}건] ${originalName}`;
            });

        content += `💡 Gemini에 키워드 보강 요청 시, 이 목록을 우선적으로 검토하세요.\n\n`;
        content += sortedFrequency.join('\n');
        content += `\n\n--- 미분류 법안 상세 목록 (bill_id 기준) ---\n`;

        newReviewList.forEach(item => {
            content += `[${item.id}] ${item.name}\n`;
        });
    } else {
        content += `\n**[검토 완료]** 미분류 법안이 없습니다.\n`;
    }


    // 3. 파일에 한 번에 기록
    try {
        await fs.promises.writeFile(TOPIC_REVIEW_FILE, content, 'utf8');
        logger.warn(`[파일 WRITE] 재분류 대기 목록 파일 저장 완료: ${TOPIC_REVIEW_FILE}`);
    } catch (error) {
        logger.error(`[파일 WRITE 실패] 파일 저장 실패: ${error.message}`);
    }
}


/**
 * 메인 실행 함수
 */
async function runTopicUpdate() {
    logger.info(`[Topic Update Batch START] bills 테이블 bill_topic_cd 컬럼 일괄 업데이트를 시작합니다.`);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();
    let totalUpdated = 0;
    const newReviewList = [];
    let billsProcessed = 0;

    // 키워드 변경 감지를 위한 로드
    const keywordsFromFile = loadKeywordsFromFile();
    const oldKeywords = keywordsFromFile;
    const currentKeywords = { main: TOPIC_KEYWORDS_RAW, special: SPECIAL_TOPIC_KEYWORDS_RAW };

    try {
        // --- 0. 키워드 파일 초기화 및 현재 키워드로 갱신 ---
        await initializeReviewFile(currentKeywords);

        // 1. DB에서 Topic 코드 로드 및 동적 맵 생성
        const { rows: topicCodes } = await pool.query(`SELECT code_id, code_name FROM codes WHERE group_code = 'BILL_TOPIC'`);

        // 실제 분류에 사용될 TOPIC_ID_MAP은 코드 내 키워드(TOPIC_KEYWORDS_RAW)를 기준으로 생성
        TOPIC_ID_MAP = topicCodes.reduce((acc, code) => {
            const topicName = code.code_name;
            const keywordsRaw = currentKeywords.main[topicName] || currentKeywords.special[topicName];

            if (keywordsRaw) {
                // 키워드를 소문자/공백 제거된 형태로 변환하여 저장
                const processedKeywords = keywordsRaw.map(k => k.toLowerCase().replace(/\s/g, ''));
                acc[topicName] = { id: code.code_id, keywords: processedKeywords };
            }
            if (code.code_id >= 991) {
                SPECIAL_TOPIC_ID[topicName] = code.code_id;
            }
            return acc;
        }, {});

        // 2. '미지정' 법안 처리 (기존 로직 유지)
        const { rows: code999 } = await pool.query("SELECT code_id FROM codes WHERE group_code = 'BILL_TOPIC' AND code_name = '미지정'");
        const INFO_REQUIRED_CODE = code999.length > 0 ? code999[0].code_id : 999;

        await pool.query(`
            UPDATE bills
            SET bill_topic_cd = $1
            WHERE bill_name = '정보 수집 필요' AND (bill_topic_cd IS NULL OR bill_topic_cd = ${RECLASSIFY_CODE})
        `, [INFO_REQUIRED_CODE]);


        // 3. Topic 분류 대상 법안 조회 (NULL 또는 998인 행만)
        const { rows: allBills } = await pool.query(`
            SELECT bill_id, bill_name, bill_topic_cd AS old_topic_cd
            FROM bills
            WHERE bill_topic_cd IS NULL OR bill_topic_cd = ${RECLASSIFY_CODE}
        `);

        const totalBillsToProcess = allBills.length;
        if (totalBillsToProcess === 0) {
            logger.info('새로 처리할 법안이 없거나 재분류 대기 중인 법안이 없습니다. 종료합니다.');
            // 새로 분류할 법안이 없어도 파일을 갱신해야 기존 목록이 비워짐
            await writeTopicReviewFile([]);
            return;
        }

        logger.info(`총 ${totalBillsToProcess}개의 법안에 대해 Topic 분류를 시작합니다. (동시 업데이트: ${CONCURRENT_UPDATE_LIMIT})`);


        // --- 4. [검증 로깅] 갱신된 키워드 확인 및 예상 분류 로깅 ---
        const newKeywordsDetected = getNewKeywords(oldKeywords, currentKeywords);
        const newKeywordNames = Object.values(newKeywordsDetected).flat();

        if (newKeywordNames.length > 0) {
            logger.warn(`\n--- [키워드 갱신] 새롭게 추가된 키워드 (${newKeywordNames.length}개) ---`);
            for (const topicName in newKeywordsDetected) {
                if (newKeywordsDetected[topicName].length > 0) {
                    logger.warn(`  - ${topicName}: ${newKeywordsDetected[topicName].join(', ')}`);
                }
            }
            logger.warn(`---------------------------------------------------\n`);

            // 예상 분류 로깅
            let expectedNewClassifiedCount = 0;
            const expectedClassification = new Map(); // Map<topicName, count>

            for (const bill of allBills) {
                const newTopicCode = classifyTopic(bill.bill_name);

                if (newTopicCode !== RECLASSIFY_CODE) {
                    expectedNewClassifiedCount++;
                    const topicName = topicCodes.find(c => c.code_id === newTopicCode)?.code_name || '기타';
                    expectedClassification.set(topicName, (expectedClassification.get(topicName) || 0) + 1);
                }
            }

            logger.warn(`\n--- [예상 분류 결과] (${totalBillsToProcess}건 중) ---`);
            logger.warn(`💡 키워드 갱신으로 예상 추가 분류 건수: ${expectedNewClassifiedCount}건`);

            [...expectedClassification.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
                logger.warn(`  - ${name}: ${count}건 예상`);
            });
            logger.warn(`-------------------------------------------\n`);
        }


        // 5. 실제 DB 업데이트 실행
        const limit = pLimit(CONCURRENT_UPDATE_LIMIT);
        const updatePromises = [];
        const actualClassification = new Map();

        for (const bill of allBills) {
            updatePromises.push(limit(async () => {
                const newTopicCode = classifyTopic(bill.bill_name);
                let finalTopicCode = newTopicCode;

                if (newTopicCode === RECLASSIFY_CODE) {
                    newReviewList.push({ id: bill.bill_id, name: bill.bill_name });
                } else {
                    const topicName = topicCodes.find(c => c.code_id === newTopicCode)?.code_name || '기타';
                    actualClassification.set(topicName, (actualClassification.get(topicName) || 0) + 1);
                }

                const updateResult = await pool.query(`
                    UPDATE bills
                    SET bill_topic_cd = $1
                    WHERE bill_id = $2
                `, [finalTopicCode, bill.bill_id]);

                if (updateResult.rowCount > 0) {
                    totalUpdated++;
                }

                billsProcessed++;
                if (billsProcessed % 1000 === 0 || billsProcessed === totalBillsToProcess) {
                    const remaining = totalBillsToProcess - billsProcessed;
                    logger.info(`[진행률] 처리 완료: ${billsProcessed}건, 잔여: ${remaining}건`);
                }
            }));
        }

        await Promise.all(updatePromises);

        // 6. 배치 완료 후, 재분류 대기 목록 파일 기록
        await writeTopicReviewFile(newReviewList);

        logger.info(`\n[Topic Update Batch SUCCESS] 일괄 업데이트 완료.`);
        logger.info(`- 총 처리 법안 수: ${totalBillsToProcess}건`);
        logger.info(`- Topic 업데이트 성공 수: ${totalUpdated}건`);
        logger.warn(`- 재분류 대기 (998) 잔여 건수: ${newReviewList.length}건`);

        // --- 7. [검증 로깅] 실제 분류 결과 로깅 ---
        logger.warn(`\n--- [실제 분류 결과] (${totalUpdated}건 중) ---`);
        [...actualClassification.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
            logger.warn(`  - ${name}: ${count}건 분류 완료`);
        });
        logger.warn(`-------------------------------------------\n`);

    } catch (error) {
        logger.error(`[Topic Update Batch FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`총 소요 시간: ${duration}초`);
        logger.info(`[Topic Update Batch END]`);
    }
}

runTopicUpdate();