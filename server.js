const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generar', async (req, res) => {
  try {
    const { messages, apiKey } = req.body;
    const key = apiKey || process.env.ANTHROPIC_API_KEY || 'TU_API_KEY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';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor Ausol Fichas corriendo en http://localhost:${PORT}`);
});