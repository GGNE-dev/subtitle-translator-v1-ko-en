# 🎬 영한 자막 번역기 (ko-en Subtitle Translator)

> 영어로 된 영상과 전문 강의를 보다 효율적으로 시청하고 싶어 만들게 된 크롬 확장 프로그램입니다. 
> YouTube · Udemy 영어 자막을 **영문 + 한국어**로 실시간 오버레이 표시하는 브라우저 확장 프로그램입니다.
> 꾸준하게 직접 테스트하며 사용감 개선, 기능 확장을 계획 중입니다. 오류 제보 환영합니다.

![version](https://img.shields.io/badge/version-1.0-blue)
![browser](https://img.shields.io/badge/browser-Chrome%20%7C%20Brave-orange)
![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ 특징
- 완전 무료 — API 키 불필요 (Google 번역 사용)
- 영문 원문(흰색) + 한국어 번역(노란색) 동시 표시
- 전체화면 지원
- YouTube, Udemy 지원
- `Alt + Shift + O` 단축키로 빠르게 On/Off

---

## 🖥️ 자막 표시 예시

```
This is how value objects are interchangeable.   ← 흰색 (영문 원문)
이것이 바로 값 객체가 교환 가능한 방식입니다.      ← 노란색 (한국어 번역)
```

---

## 🔧 설치 방법

1. 저장소 클론 또는 ZIP 다운로드 후 압축 해제
2. `chrome://extensions/` 또는 `brave://extensions/` 접속
3. 우측 상단 **개발자 모드** ON
4. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
5. `다운로드 받은 플러그인 경로`에 해당하는 폴더 선택

---

## 🎯 사용 방법

**YouTube**
1. 영상 재생 후 자막(CC) 한 번 켜기
2. 자동으로 번역 시작 — 잠시 후 영한 자막 표시
3. 이후 YouTube 자막은 꺼도 됨

**Udemy**
1. 강의 페이지에서 영어 자막 선택
2. 자동으로 번역 시작 — 잠시 후 영한 자막 표시
3. 이후 Udemy 자막은 꺼도 됨

**단축키**
| 키 | 동작 |
|----|------|
| `Alt + Shift + O` | 자막 On/Off 토글 |

---

## ⚠️ 주의사항

- **Brave 브라우저** 사용 시 Udemy 페이지에서 Shields를 꺼야 동작합니다
  - 주소창 사자 아이콘 → Shields OFF → 페이지 새로고침
- 강의 시작 시 자막 전체를 미리 번역하므로 수 초 대기가 있습니다

---

## 🚧 버그 리포트 (추후 개선 필요)

| 항목 | 내용 |
|------|------|
| 화자 구분 불가 | 자막 파일에 화자 정보가 포함되지 않음 |
| YouTube 자막 최초 1회 필요 | CC를 켜는 순간 자막 파일 URL이 발급되기 때문 |
| 자동 생성 자막 품질 | YouTube 자동 자막이 부정확하면 번역도 부정확함 |
| Udemy 미리보기 강의 | 미리보기용 자막 포맷이 달라 표시되지 않을 수 있음 |
| 번역 품질 | Google 번역 기반으로 전문 용어나 구어체가 부정확할 수 있음 |

---

## 📄 라이선스

MIT License
