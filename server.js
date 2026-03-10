require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// Helpers
// -----------------------------
function getDefaultSiteName(site) {
  switch (site) {
    case 'citroen':
      return 'Citroën Ausol';
    case 'peugeot':
      return 'Peugeot Ausol';
    case 'leapmotor':
      return 'Leapmotor Ausol';
    case 'spoticar':
      return 'Spoticar Ausol';
    case 'crestanavada':
    case 'cresta-nevada':
      return 'Cresta Nevada';
    default:
      return 'Grupo Ausol';
  }
}

function getBrandContext(siteName) {
  return `
- Marca principal: Grupo Ausol
- Ubicación: Vélez-Málaga, Axarquía, Málaga, Costa del Sol
- Negocio real: concesionario y grupo de automoción con presencia local y atención cercana
- Marcas y líneas de actividad a tener en cuenta: Citroën, Peugeot, Leapmotor, Spoticar y Cresta Nevada
- Señales de confianza: experiencia local, atención profesional, servicio postventa, tasación, acompañamiento real en la compra y mantenimiento del vehículo
- Contexto comercial: ayudar a usuarios que buscan coche nuevo, vehículo de ocasión, coche eléctrico, tasar su coche, resolver dudas de mantenimiento o comparar opciones en Málaga y la Axarquía
- Importante: el contenido debe reforzar la entidad de ${siteName} dentro del ecosistema de Grupo Ausol, sin inventar servicios no visibles ni promesas no demostrables
`.trim();
}

function extractTextFromAnthropic(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter(block => block && block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n\n')
    .trim();
}

// -----------------------------
// Helper Anthropic call
// -----------------------------
async function callAnthropic({ key, model, messages, max_tokens = 3500 }) {
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
    const { messages } = req.body || {};

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(400).json({
        error: 'Falta ANTHROPIC_API_KEY en .env',
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Falta messages válido' });
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

    const { ok, status, data } = await callAnthropic({
      key,
      model,
      messages,
      max_tokens: 2500,
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
    const {
      site = 'grupo-ausol',
      lang = 'es',
      mode = 'vecino',
      topic,
      notes = '',
      keyword = '',
      secondaryKeywords = '',
      intent = 'informativa',
      audience = 'conductores de Málaga, Vélez-Málaga y la Axarquía',
    } = req.body || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Falta topic' });
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Falta ANTHROPIC_API_KEY en .env',
      });
    }

    const siteName = getDefaultSiteName(site);

    const modeMap = {
      periodista:
        'Enfoque editorial de periodista del motor: lectura fluida, contexto claro, criterio y utilidad real, sin caer en nota de prensa.',
      vecino:
        'Enfoque práctico y local: uso real en Málaga, Vélez-Málaga, Axarquía, Costa del Sol, aparcamiento, calor, trayectos diarios, A-7 y vida cotidiana.',
      analista:
        'Enfoque comparativo y de decisión: criterio claro, pros y contras, tabla si aporta valor, recomendación útil y honestidad comercial.',
      taller:
        'Enfoque técnico-práctico de postventa y taller: mantenimiento, desgaste, revisiones, señales comunes, prevención y consejo accionable.',
    };

    const languageInstr =
      lang === 'en'
        ? 'Escribe todo en inglés británico.'
        : lang === 'both'
          ? 'Entrega primero la versión completa en español de España y después la versión completa en inglés británico.'
          : 'Escribe todo en español de España.';

    const prompt = `
Actúa como estratega senior de contenidos SEO + GEO + conversión para el blog de ${siteName}.

CONTEXTO DE MARCA
${getBrandContext(siteName)}

MODO DE ENFOQUE
${modeMap[mode] || modeMap.vecino}

IDIOMA
${languageInstr}

DATOS DEL ARTÍCULO
- Tema: ${topic}
- Keyword principal: ${keyword || topic}
- Keywords secundarias: ${
  secondaryKeywords ||
  'Grupo Ausol, Vélez-Málaga, Axarquía, Málaga, concesionario oficial, coche nuevo, coche de ocasión, tasación, taller, servicio postventa'
}
- Intención de búsqueda: ${intent}
- Público objetivo: ${audience}
- Notas extra: ${notes || 'Sin notas adicionales'}

OBJETIVO DEL ARTÍCULO
Debes crear una pieza que:
1. responda una intención de búsqueda real
2. aporte información útil y criterio propio
3. incluya contexto local cuando tenga sentido
4. suene humana, experta y cercana
5. esté optimizada para SEO y GEO sin sonar artificial
6. invite a contactar con ${siteName} o Grupo Ausol de forma natural

REGLAS IMPORTANTES
- Nada de asteriscos decorativos ni texto con aspecto de ficha pobre.
- No escribas como una nota de prensa.
- No hagas relleno ni repitas keywords de forma mecánica.
- No inventes datos técnicos, precios, autonomías, ayudas, impuestos, promociones, fechas ni equipamientos.
- Si falta un dato, dilo claramente y recomienda verificarlo con el equipo de Grupo Ausol.
- Usa lenguaje claro, semántico y natural.
- Introduce observaciones realistas del tipo "lo que solemos ver en clientes", "en uso diario", "en concesionario", "en taller", pero sin fingir testimonios concretos.
- Cuando tenga sentido, conecta el contenido con Málaga, Vélez-Málaga, Torre del Mar, Nerja, Axarquía, Costa del Sol, calor, cuestas, tráfico urbano, aparcamiento, trayectos cortos, A-7 o conducción mixta.
- El cierre debe mover a acción comercial real: pedir cita, solicitar asesoramiento, ver vehículo, hablar con el equipo, tasar coche o pedir revisión.
- Refuerza de forma natural la entidad de marca Grupo Ausol y, cuando corresponda, menciona también Citroën, Peugeot, Leapmotor, Spoticar o Cresta Nevada si aportan contexto útil.
- El contenido visible debe sonar a web seria de automoción, no a texto genérico inflado por IA.

ESTRUCTURA OBLIGATORIA
Entrega exactamente en este orden:

1. TÍTULO SEO
2. META TITLE
3. META DESCRIPTION
4. SLUG RECOMENDADO
5. ARTÍCULO COMPLETO

Dentro del ARTÍCULO COMPLETO incluye:
- Introducción breve que responda rápido a la duda principal
- H2 y H3 claros
- Un bloque titulado "En resumen"
- Un bloque titulado "Lo que solemos ver en clientes" o "Lo que solemos ver en concesionario" o "Lo que solemos ver en taller", según encaje
- Una sección "Para quién sí"
- Una sección "Para quién no"
- Una conclusión clara con recomendación honesta
- Una FAQ final con 5 preguntas reales
- 3 opciones de CTA final para Grupo Ausol
- 5 ideas de enlaces internos
- Schema recomendado para esta pieza
- 4 ideas de imágenes útiles y serias para acompañar el artículo

REQUISITOS DEL ARTÍCULO
- Longitud orientativa: entre 900 y 1300 palabras
- Tono: profesional, útil, cercano y creíble
- Si comparas opciones, puedes incluir una tabla HTML simple y limpia, solo si aporta valor
- Evita frases vacías como "tecnología de vanguardia" o "diseño innovador" salvo que las expliques
- Incluye al menos 2 frases citables, contundentes y claras
- Incluye mini conclusión accionable
- Las FAQs deben sonar naturales, no como SEO de 2017
- Las ideas de imágenes deben ser concretas y realistas
- El schema recomendado debe decir qué tipo conviene: Article, FAQPage, Product, LocalBusiness, AutomotiveBusiness, BreadcrumbList u otro si de verdad encaja

FORMATO DE SALIDA
- Usa HTML limpio y bien estructurado para el ARTÍCULO COMPLETO
- NO uses Markdown
- NO uses bloques de código
- NO uses comillas triples
- Devuelve el contenido listo para pintar dentro de una web seria
- Separa claramente cada bloque con su etiqueta/título visible

Recuerda: debe parecer contenido sólido de una marca real de automoción en Málaga, útil para SEO, GEO y conversión, y alineado con Grupo Ausol.
`.trim();

    const model =
      process.env.ANTHROPIC_BLOG_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'claude-sonnet-4-6';

    const { ok, status, data } = await callAnthropic({
      key,
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 6000,
    });

    if (!ok) {
      return res.status(status).json({
        success: false,
        error: data,
      });
    }

    const content = extractTextFromAnthropic(data);

    const cleanedContent = content
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!cleanedContent) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo extraer contenido del modelo',
      });
    }

    return res.json({
      success: true,
      site: siteName,
      model,
      html: cleanedContent,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});