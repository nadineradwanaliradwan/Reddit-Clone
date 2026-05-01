const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Constants ────────────────────────────────────────────────────────────────

// Gemini Flash Lite is the fastest, cheapest, highest-free-quota model.
// The `-latest` alias resolves to whatever the current lite version is, so this
// stays valid as Google rotates model versions. Plenty good for short summaries.
const MODEL_NAME = 'gemini-2.5-flash-lite';

// Hard ceiling on summary length so the model can't waste quota on a 5-paragraph response
const MAX_OUTPUT_TOKENS = 200;

// Lower temperature = more focused / less creative output. Summaries shouldn't be flowery.
const TEMPERATURE = 0.3;

// Hard timeout on the API call. Without this, a hung connection would block the response forever.
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Singleton client ─────────────────────────────────────────────────────────
//
// Lazily constructed on first call so that requiring this module doesn't crash
// if GEMINI_API_KEY is missing — the controller will surface a clean 503 instead.

let _model = null;

const getModel = () => {
  if (_model) return _model;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const client = new GoogleGenerativeAI(apiKey);
  _model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    },
  });
  return _model;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────
//
// Different post types have different content shapes. We hand the model the
// most useful pieces and tell it explicitly what to focus on. Keeping prompts
// short keeps token usage (and bills) low.

const buildPrompt = (post) => {
  const intro =
    'You are summarizing a Reddit post. Write a concise 2-3 sentence summary in plain English. ' +
    'Do not add commentary, opinions, or hashtags. Do not address the reader.';

  switch (post.type) {
    case 'text':
      return [
        intro,
        '',
        `Title: ${post.title}`,
        '',
        'Body:',
        post.body || '(no body)',
      ].join('\n');

    case 'link':
      // We don't fetch the URL — that's slow, fragile, and would multiply our attack surface.
      // The model can still produce a useful summary from title + the URL itself (the domain
      // and path often hint at what's being linked).
      return [
        intro,
        '',
        `Title: ${post.title}`,
        `Linked URL: ${post.url}`,
        '',
        'Summarize what this post is sharing based on the title and URL. ' +
        'If the URL is uninformative, summarize the title alone.',
      ].join('\n');

    case 'image':
      // Image posts are usually all-title. Vision support is a possible upgrade but
      // adds complexity (fetching, MIME detection, base64 encoding) — out of scope here.
      return [
        intro,
        '',
        `Title: ${post.title}`,
        `Image URL: ${post.imageUrl}`,
        '',
        'This is an image post. Summarize what the post appears to be about based on the title. ' +
        'Do not describe the image itself; you cannot see it.',
      ].join('\n');

    default:
      throw new Error(`Cannot build prompt for unknown post type '${post.type}'`);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

// Summarizes a post and returns the summary text.
// Throws on:
//   - missing API key (err.code === 'AI_NOT_CONFIGURED')
//   - upstream API failure (err.code === 'AI_UPSTREAM_ERROR')
//   - timeout (err.code === 'AI_TIMEOUT')
const summarizePost = async (post) => {
  const model = getModel();
  const prompt = buildPrompt(post);

  // Race the model call against a manual timeout — the SDK doesn't expose one directly.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      err.code = 'AI_TIMEOUT';
      reject(err);
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      timeout,
    ]);

    const text = result.response.text().trim();
    if (!text) {
      const err = new Error('Gemini returned an empty response');
      err.code = 'AI_UPSTREAM_ERROR';
      throw err;
    }
    return text;
  } catch (err) {
    // Already-tagged errors pass through; un-tagged errors get the upstream tag
    if (err.code === 'AI_TIMEOUT' || err.code === 'AI_NOT_CONFIGURED') throw err;
    const wrapped = new Error(`Gemini API error: ${err.message}`);
    wrapped.code = 'AI_UPSTREAM_ERROR';
    wrapped.cause = err;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = { summarizePost };
