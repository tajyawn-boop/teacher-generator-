# 교사용 수련회 생성기 — 배포 안내서

이 폴더는 **교사용 생성기 하나만** 담은 독립 사이트입니다.
Google Gemini 무료 API를 사용하며 신용카드가 필요 없습니다.

## 폴더 구조

```
teacher-site/
├─ api/
│  └─ generate.js      ← 백엔드 (API 키를 안전하게 보관)
├─ public/
│  └─ index.html       ← 교사용 생성기 화면
└─ package.json
```

## 배포 순서

### 1단계 — Gemini API 키 발급
1. https://aistudio.google.com 접속 → Google 계정 로그인
2. **Get API key** → **Create API key**
3. 키(`AIza...`)를 복사해 안전한 곳에 메모

### 2단계 — GitHub에 올리기
1. https://github.com 로그인 → `+` → **New repository**
2. 이름: `teacher-generator` → **Create repository**
3. **uploading an existing file** 클릭
4. `teacher-site` 폴더 **안의 내용**(api 폴더, public 폴더, package.json)을
   드래그해서 올립니다
5. **Commit changes**

### 3단계 — Vercel 배포
1. https://vercel.com 로그인 (GitHub 계정으로)
2. **Add New... → Project** → `teacher-generator` 저장소 **Import**
3. **Environment Variables** 펼치기 → 변수 추가:
   - Name: `GEMINI_API_KEY`
   - Value: 1단계의 키 붙여넣기
4. **Deploy** 클릭

1~2분 후 `https://teacher-generator-xxxx.vercel.app` 주소가 나옵니다.
이것이 교사용 사이트 주소입니다.

## 참고
- 학부모용 사이트는 별도 폴더(`parent-site`)로 따로 배포합니다.
- 두 사이트는 같은 Gemini 키를 함께 사용해도 됩니다.
- AI 생성 내용은 참고용입니다. 사용 전 담당 교역자가 검토해 주세요.
