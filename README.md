# Nihongo Live — 모바일 실시간 일본어 번역 웹앱

## 현재 버전 기능
- 일본어 음성 인식(Web Speech API)
- 일본어 → 한국어 번역(MyMemory 공개 번역 API)
- 중간 인식 결과 번역 및 확정 문장 기록
- 한국어 음성 읽기(Web Speech Synthesis)
- 번역 기록을 브라우저 localStorage에 저장
- PWA 설치 지원 및 기본 파일 오프라인 캐시

## 실행 방법
마이크와 음성 인식은 보안 연결(HTTPS)에서 사용해야 합니다. 파일을 휴대폰에서 직접 열지 말고 HTTPS로 배포하세요.

### 가장 간단한 배포
1. GitHub 저장소를 만듭니다.
2. 이 폴더의 파일을 저장소 루트에 업로드합니다.
3. 저장소 Settings → Pages → Deploy from a branch → `main` / `/ (root)`를 선택합니다.
4. 생성된 `https://...github.io/...` 주소를 iPhone Safari 또는 Android Chrome에서 엽니다.
5. 마이크 권한을 허용하고 `번역 시작`을 한 번 누릅니다.

### 로컬 테스트
컴퓨터에 Python 3가 있다면 프로젝트 폴더에서 실행:
```bash
python -m http.server 8000
```
PC 브라우저에서 `http://localhost:8000` 접속. 휴대폰에서 테스트하려면 HTTPS 배포가 권장됩니다.

## 사용 방법
1. 최신 Chrome(Android) 또는 Safari(iPhone)에서 HTTPS 주소를 엽니다.
2. `번역 시작`을 누르고 마이크 권한을 허용합니다.
3. 일본어로 말하면 인식 결과와 번역이 화면에 나타납니다.
4. `일시정지`로 인식을 멈추고, `기록 지우기`로 저장된 기록을 삭제합니다.
5. Android Chrome 등 설치 지원 브라우저에서는 `설치` 메뉴로 홈 화면에 추가할 수 있습니다. iPhone은 Safari 공유 메뉴 → 홈 화면에 추가를 이용합니다.

## 중요 제한 및 개인정보
- 웹앱은 브라우저의 음성 인식 기능을 사용합니다. 브라우저/운영체제/지역에 따라 음성 인식 지원 여부와 정확도가 다릅니다. 특히 iPhone Safari에서는 기기와 iOS 버전에 따라 동작을 반드시 확인해야 합니다.
- 최초 시작은 마이크 권한과 사용자 동작이 필요하므로 완전 무클릭 자동 시작은 불가능합니다. 시작 후에는 음성 인식을 자동 재시작하도록 구성했습니다.
- 브라우저의 음성 인식 서비스가 오디오를 처리할 수 있으며, 인식된 일본어 텍스트는 MyMemory 번역 서버로 전송됩니다. 민감한 대화에는 사용하지 마세요.
- MyMemory 무료 익명 사용량은 하루 5,000자 제한입니다. 실제 사용량 및 서비스 정책은 바뀔 수 있습니다.
- 브라우저를 백그라운드로 보내거나 화면을 잠그면 iOS/Android가 마이크와 음성 인식을 중단할 수 있습니다. 현재 버전은 화면이 켜진 상태의 포그라운드 사용을 전제로 합니다.
- 이 MVP는 전문 통역 수준이나 모든 상황의 연속 인식을 보장하지 않습니다. 안정적인 상시 사용을 위해서는 서버 측 STT/번역 백엔드와 네이티브 앱 구현이 다음 단계로 필요합니다.

## 기술 구성
- Frontend: HTML, CSS, JavaScript
- Speech-to-text: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Translation: MyMemory public API (`ja|ko`)
- Text-to-speech: Web Speech Synthesis (`ko-KR`)
- PWA: Web App Manifest + Service Worker
