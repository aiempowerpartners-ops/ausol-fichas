require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// Helper Anthropic call
// -----------------------------
async function callAnthropic({ key, model, messages, max_tokens = 2000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      messages,
    }),
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// -----------------------------
// 1) Endpoint genérico (FICHAS)
// -----------------------------
app.post('/api/generar', async (req, res) => {
  try {
    const { messages, apiKey } = req.body || {};

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(400).json({
        error: 'Falta ANTHROPIC_API_KEY (en .env o enviada por el cliente)',
      });
    }

    if (!messages) {
      return res.status(400).json({ error: 'Falta messages' });
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

    const { ok, status, data } = await callAnthropic({
      key,
      model,
      messages,
      max_tokens: 2000,
    });

    if (!ok) return res.status(status).json(data);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// 2) Endpoint BLOG (SEO + GEO)
// -----------------------------
app.post('/api/blog/generate', async (req, res) => {
  try {
    const { site, lang, mode, topic, notes } = req.body || {};
    if (!topic) return res.status(400).json({ success: false, error: 'Falta topic' });

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(400).json({ success: false, error: 'Falta ANTHROPIC_API_KEY en .env' });

    const siteName =
      site === 'citroen' ? 'Citroën Ausol' :
      site === 'peugeot' ? 'Peugeot Ausol' :
      'Grupo Ausol';

    const modeMap = {
      periodista: 'Semana 1 (Periodista): novedades, sensaciones, ruta local en Málaga.',
      vecino: 'Semana 2 (Vecino): práctico local, aparcar, calor, A-7, uso real.',
      analista: 'Semana 3 (Analista): comparativa con TABLA, BLUF, datos claros y honestos.',
      taller: 'Semana 4 (Jefe de taller): mantenimiento, averías comunes, consejos con autoridad.',
    };

    const languageInstr =
      lang === 'en' ? 'Write in English (UK).' :
      lang === 'both' ? 'Provide two versions: first ES (Spain), then EN (UK).' :
      'Escribe en español de España.';

    const prompt = `
Eres AusolBot, redactor jefe del blog de ${siteName} en Málaga.
Objetivo: SEO + GEO/AIO.

REGLAS:
- BLUF: responde la duda principal en el primer párrafo (50–70 palabras).
- Markdown limpio: H1, H2, listas. Tabla si comparas.
- Contexto local Málaga/Costa del Sol (calor, A-7, ciudad, costa, aparcamiento).
- No inventes datos técnicos. Si faltan, indícalo y sugiere verificar en ficha oficial.
- Nada de asteriscos decorativos.
- CTA final a ${siteName} (prueba/contacto/taller) sin lenguaje corporativo vacío.

${modeMap[mode] || modeMap.vecino}

TEMA: ${topic}
NOTAS: ${notes || '(sin notas)'}

Entrega en Markdown e incluye:
- Meta description al inicio (1–2 líneas).
- Artículo 800–1200 palabras (comparativa/guía puede subir a 1500).
- Sección FAQ (4–6 preguntas).
- Ideas de imágenes (3–5 bullets).
${languageInstr}
`.trim();

    // Modelo del BLOG: primero ANTHROPIC_BLOG_MODEL, si no ANTHROPIC_MODEL, si no Haiku
    const model =
      process.env.ANTHROPIC_BLOG_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'claude-3-haiku-20240307';

    const { ok, status, data } = await callAnthropic({
      key,
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    });

    if (!ok) return res.status(status).json({ success: false, error: data });

    const markdown =
      (data && data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text
        : JSON.stringify(data);

    return res.json({ success: true, markdown });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------
// 3) Ver modelos disponibles (Anthropic)
// -----------------------------
app.get('/api/anthropic/models', async (req, res) => {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(400).json({ error: 'Falta ANTHROPIC_API_KEY en .env' });

    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// -----------------------------
// Listen
// -----------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor Ausol Fichas corriendo en http://localhost:${PORT}`);
});