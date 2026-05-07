require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper: extract API keys per-request ─────────────────────────────────────
// Ưu tiên header (key user nhập từ web), fallback env vars (nếu host muốn pre-config)
function getKeys(req) {
  return {
    geminiApiKey:
      req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || '',
    elevenLabsApiKey:
      req.headers['x-elevenlabs-key'] || process.env.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId:
      req.headers['x-elevenlabs-voice'] ||
      process.env.ELEVENLABS_VOICE_ID ||
      'EXAVITQu4vr4xnSDxMaL',
  };
}

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const VIDEO_SYSTEM_PROMPT = `You are an elite video script director. You handle TWO modes:

MODE A — USER PROVIDES A FULL SCRIPT:
If the user input is already a written script (long text, has paragraphs, sections like "PHẦN 1", "Phần Mở đầu", "Cảnh:", structured content with specific facts/details), your job is to SPLIT it into scenes — DO NOT rewrite or invent new content.
- Preserve the user's original wording, facts, names, numbers as much as possible.
- Break content into 5-12 scenes based on natural breaks (paragraphs, "PHẦN" markers, topic shifts).
- For each scene, extract a short punchy sceneTitle (max 5 words) and use the user's text as narration.
- You MAY lightly clean up narration so it sounds natural when spoken aloud (remove stage directions like "(Cảnh: ...)", remove markdown), but DO NOT add new content the user didn't write.

MODE B — USER PROVIDES ONLY A TOPIC:
If the user input is short (a single sentence or a topic like "Trí tuệ nhân tạo"), then create an original cinematic script from scratch.

OUTPUT RULES (CRITICAL — applies to both modes):
- Respond with ONLY valid JSON. No markdown code blocks, no explanation.
- The JSON must be parseable by JSON.parse() directly.

JSON STRUCTURE:
{
  "videoTitle": "Catchy title (extract from script if Mode A, create if Mode B)",
  "style": "cinematic | educational | promotional | documentary | motivational",
  "totalDuration": estimated_total_seconds_as_number,
  "scenes": [
    {
      "id": 1,
      "sceneTitle": "SHORT TITLE (MAX 5 WORDS)",
      "narration": "Spoken text. Mode A: user's content. Mode B: your creation.",
      "accentColor": "#hexcolor",
      "animationStyle": "slide-up | slide-left | zoom-in | fade-in | typewriter",
      "backgroundTheme": "tech | nature | abstract | space | corporate | minimal",
      "estimatedDuration": seconds_number
    }
  ]
}

CREATIVE RULES:
- sceneTitle: MAX 5 WORDS. Short, punchy.
- narration in Mode A: keep user's voice; just tidy it up for TTS (remove parenthetical stage notes, fix run-on sentences). Each scene's narration: 2-6 sentences.
- narration in Mode B: 2-5 sentences, natural conversational speech.
- Vary accentColors: #00d4ff, #7c3aed, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #84cc16
- Vary animationStyles for dynamic feel.
- estimatedDuration: 8-20 seconds per scene.

LANGUAGE: Match the language of the user's input.`;

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Status endpoint — chỉ check env vars (key user lưu localStorage, server không biết)
app.get('/api/config', (req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
    storageMode: 'client',
  });
});

// Generate script with Gemini
app.post('/api/generate-script', async (req, res) => {
  const { prompt } = req.body;
  const { geminiApiKey } = getKeys(req);

  if (!geminiApiKey)
    return res
      .status(400)
      .json({ error: 'Gemini API key chưa được cấu hình. Mở Cài đặt và nhập key.' });
  if (!prompt) return res.status(400).json({ error: 'Vui lòng nhập nội dung video.' });

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
      {
        system_instruction: { parts: [{ text: VIDEO_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
          response_mime_type: 'application/json',
          thinkingConfig: {
            thinkingBudget: 4096,
          },
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let scriptData;
    try {
      scriptData = JSON.parse(text);
    } catch (parseErr) {
      try {
        // Thử 1: Bỏ trailing comma
        let cleanedText = text.replace(/,\s*([\]}])/g, '$1');
        const match = cleanedText.match(/\{[\s\S]*\}/);
        if (match) {
          scriptData = JSON.parse(match[0]);
        } else {
          throw parseErr;
        }
      } catch (innerErr) {
        // Thử 2: JSON bị cắt giữa chừng — cắt đến scene cuối hợp lệ và đóng lại
        try {
          let salvaged = text;
          // Tìm scene cuối có vẻ hoàn chỉnh (kết thúc bằng })
          const lastValidScene = salvaged.lastIndexOf('},');
          if (lastValidScene > 0) {
            salvaged = salvaged.substring(0, lastValidScene + 1) + ']}';
            // Bỏ trailing comma nếu còn
            salvaged = salvaged.replace(/,\s*([\]}])/g, '$1');
            scriptData = JSON.parse(salvaged);
            console.warn('JSON bị cắt giữa chừng, đã salvage được', scriptData.scenes?.length, 'scenes');
          } else {
            throw innerErr;
          }
        } catch (salvageErr) {
          console.error('Lỗi phân tích JSON gốc:', text);
          throw new Error('Không thể phân tích JSON từ Gemini. Thử lại với prompt ngắn hơn hoặc model khác. Snippet: ' + text.slice(0, 200));
        }
      }
    }

    res.json({ success: true, script: scriptData });
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Generate TTS with ElevenLabs
app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const { elevenLabsApiKey, elevenLabsVoiceId } = getKeys(req);
  const vid = voiceId || elevenLabsVoiceId;

  if (!elevenLabsApiKey) {
    return res.json({ success: false, useFallback: true, reason: 'no_api_key' });
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      },
      {
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      }
    );

    const base64 = Buffer.from(response.data).toString('base64');
    res.json({ success: true, audio: base64, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('ElevenLabs error:', err.response?.status, err.message);
    res.json({ success: false, useFallback: true, reason: err.message });
  }
});

// Get ElevenLabs voices
app.get('/api/voices', async (req, res) => {
  const { elevenLabsApiKey } = getKeys(req);
  if (!elevenLabsApiKey) return res.json({ voices: [] });
  try {
    const r = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': elevenLabsApiKey },
    });
    const filtered = r.data.voices.filter((v) => {
      const name = v.name.toLowerCase();
      const labels = JSON.stringify(v.labels || {}).toLowerCase();
      return name.includes('viet') || labels.includes('viet');
    });
    res.json({ voices: (filtered.length > 0 ? filtered : r.data.voices).slice(0, 20) });
  } catch {
    res.json({ voices: [] });
  }
});

// Generate Free TTS (Google Translate Proxy) — không cần key
app.get('/api/tts-free', async (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const MAX_CHARS = 200;
    const chunks = [];

    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS) {
        chunks.push(remaining);
        break;
      }

      let chunk = remaining.substring(0, MAX_CHARS);
      let lastSpace = chunk.lastIndexOf(' ');
      let lastPunct = Math.max(
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf(','),
        chunk.lastIndexOf('?'),
        chunk.lastIndexOf('!')
      );

      let splitAt =
        lastPunct > MAX_CHARS * 0.5 ? lastPunct + 1 : lastSpace > 0 ? lastSpace : MAX_CHARS;
      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }

    const audioBuffers = [];
    for (const chunk of chunks) {
      if (!chunk) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=vi&client=tw-ob`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      audioBuffers.push(response.data);
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    res.set('Content-Type', 'audio/mpeg');
    res.send(finalBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch free TTS' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 TuanDevTop đang chạy tại: http://localhost:${PORT}\n`);
});
