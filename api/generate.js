// api/generate.js
// Vercel 서버리스 함수 — Google Gemini API에 안전하게 요청을 전달합니다.
// API 키는 이 파일 안에서만 쓰이고 Vercel 서버에서만 실행되므로,
// 사용자 브라우저에는 절대 노출되지 않습니다.

export default async function handler(req, res) {
  // 같은 사이트의 페이지가 호출하도록 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt가 필요합니다." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "서버에 API 키가 설정되지 않았습니다. (GEMINI_API_KEY)"
      });
    }

    // 모델 이름은 환경 변수로 둬서, 모델이 바뀌어도 코드 수정 없이 대응 가능
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + apiKey;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      let detail = "";
      try {
        const e = await geminiRes.json();
        detail = e.error && e.error.message ? e.error.message : "";
      } catch (_) {}
      if (geminiRes.status === 429) {
        return res.status(429).json({
          error: "오늘 무료 사용량을 모두 사용했습니다. 내일 다시 시도해 주세요."
        });
      }
      return res.status(geminiRes.status).json({
        error: "생성 요청에 실패했습니다. " + detail
      });
    }

    const data = await geminiRes.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      return res.status(502).json({
        error: "응답을 받지 못했습니다. 다시 시도해 주세요."
      });
    }

    // 생성된 JSON 텍스트를 그대로 전달 (프론트엔드에서 파싱)
    return res.status(200).json({ result: text });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
}
