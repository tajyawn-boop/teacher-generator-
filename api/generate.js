// api/generate.js
// Vercel 서버리스 함수 — Google Gemini API에 안전하게 요청을 전달합니다.
// API 키는 이 파일 안에서만 쓰이고 Vercel 서버에서만 실행되므로,
// 사용자 브라우저에는 절대 노출되지 않습니다.

// 시도할 모델 목록 — 앞에서부터 차례로 시도하고, 되는 것을 사용합니다.
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash"
];

async function callModel(model, apiKey, prompt) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model + ":generateContent";

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    })
  });

  let body = null;
  try { body = await r.json(); } catch (_) { body = null; }
  return { status: r.status, ok: r.ok, body: body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST 요청만 허용됩니다." });
    }

    let payload = req.body;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    const prompt = payload && payload.prompt;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt가 필요합니다." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "서버에 API 키가 설정되지 않았습니다. (GEMINI_API_KEY)"
      });
    }

    const models = [];
    if (process.env.GEMINI_MODEL) models.push(process.env.GEMINI_MODEL);
    for (const m of MODEL_CANDIDATES) {
      if (!models.includes(m)) models.push(m);
    }

    let rateLimited = false;
    let lastError = "";

    for (const model of models) {
      let attempt = null;

      // 같은 모델로 최대 3회 재시도 (503 과부하·429·500 같은 일시 오류 대응)
      for (let tryN = 0; tryN < 3; tryN++) {
        try {
          attempt = await callModel(model, apiKey, prompt);
        } catch (e) {
          lastError = "네트워크 오류: " + (e && e.message ? e.message : "");
          attempt = null;
          await sleep(500 * (tryN + 1));
          continue;
        }
        // 일시적 오류면 잠깐 쉬고 같은 모델 재시도
        if (attempt.status === 503 || attempt.status === 429 || attempt.status === 500) {
          await sleep(600 * (tryN + 1));
          continue;
        }
        break; // 성공이거나, 재시도해도 소용없는 오류 → 루프 종료
      }

      if (!attempt) { continue; } // 네트워크 실패 → 다음 모델

      if (attempt.status === 429) {
        rateLimited = true;
        lastError = "사용량 한도(429)";
        continue;
      }

      if (!attempt.ok) {
        const msg =
          attempt.body && attempt.body.error && attempt.body.error.message
            ? attempt.body.error.message
            : "HTTP " + attempt.status;
        lastError = msg;
        continue;
      }

      const data = attempt.body;
      const text =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;

      if (text) {
        return res.status(200).json({ result: text });
      }

      lastError = "빈 응답";
      continue;
    }

    if (rateLimited) {
      return res.status(429).json({
        error: "오늘 무료 사용량을 모두 사용했습니다. 잠시 후 다시 시도해 주세요."
      });
    }
    return res.status(502).json({
      error: "생성에 실패했습니다. 다시 시도해 주세요. (" + lastError + ")"
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({
      error: "서버 오류가 발생했습니다. (" + (err && err.message ? err.message : "") + ")"
    });
  }
}
