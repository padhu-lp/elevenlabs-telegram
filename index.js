// ElevenLabs to Telegram Integration (ES Module version)
import express from 'express';
import fetch from 'node-fetch';

// Configuration variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Create Express server
const app = express();

// Raw body logging middleware - add this before JSON parsing
app.use((req, res, next) => {
    if (req.originalUrl.includes('webhook')) {
        console.log('Request headers:', req.headers);
        console.log('Request method:', req.method);
        console.log('Request URL:', req.originalUrl);

        let rawData = '';
        req.on('data', chunk => {
            rawData += chunk;
            console.log('Chunk received:', chunk.toString());
        });

        req.on('end', () => {
            console.log('Raw webhook data complete:', rawData);
            try {
                // Try parsing as JSON manually to debug
                const jsonData = JSON.parse(rawData);
                console.log('Successfully parsed as JSON:', jsonData);
            } catch (e) {
                console.log('Failed to parse as JSON:', e.message);
            }
            next();
        });
    } else {
        next();
    }
});

// Support multiple formats and larger payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Function to send message to Telegram with improved error handling
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    // Log important info for debugging
    console.log(`Attempting to send message to Telegram chat ID: ${TELEGRAM_CHAT_ID}`);
    console.log(`Message content: ${message}`);

    try {
        // Set a longer timeout (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Log the raw response
        console.log(`Telegram API response status: ${response.status}`);

        const data = await response.json();
        console.log('Message sent to Telegram, full response:', JSON.stringify(data));
        return data;
    } catch (error) {
        console.error('Error sending message to Telegram:', error.name, error.message);

        // Check for specific error types
        if (error.name === 'AbortError') {
            console.error('Request timed out after 10 seconds');
        }

        // Try to log some debugging information
        console.error('Bot token length:', TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.length : 'undefined');
        console.error('Chat ID type:', typeof TELEGRAM_CHAT_ID);

        throw error;
    }
}

// Function to send audio file to Telegram with improved error handling
async function sendAudioToTelegram(audioUrl) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`;

    console.log(`Attempting to send audio to Telegram chat ID: ${TELEGRAM_CHAT_ID}`);
    console.log(`Audio URL: ${audioUrl}`);

    try {
        // Set a longer timeout (20 seconds for audio which might be larger)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                audio: audioUrl
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`Telegram API response status for audio: ${response.status}`);

        const data = await response.json();
        console.log('Audio sent to Telegram, full response:', JSON.stringify(data));
        return data;
    } catch (error) {
        console.error('Error sending audio to Telegram:', error.name, error.message);
        throw error;
    }
}

// Health check endpoint
app.get('/', (req, res) => {
    // Also log environment variable status (masked for security)
    console.log(`Health check - Bot token exists: ${!!TELEGRAM_BOT_TOKEN}, Chat ID exists: ${!!TELEGRAM_CHAT_ID}`);
    res.status(200).send('ElevenLabs to Telegram integration is running!');
});

// Test endpoint to directly test Telegram connection
app.get('/test-telegram', async (req, res) => {
    try {
        const result = await sendToTelegram('This is a test message from the ElevenLabs-Telegram integration.');
        res.status(200).json({
            success: true,
            message: 'Test message sent to Telegram',
            telegramResponse: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to send test message',
            error: error.message
        });
    }
});

// Simplest possible webhook endpoint - just logs and returns 200
app.post('/elevenlabs-webhook', async (req, res) => {
    console.log('======= WEBHOOK RECEIVED =======');
    console.log('Headers:', JSON.stringify(req.headers));

    try {
        let bodyData = req.body;

        // Try to parse the body if it's a string or buffer
        if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
            try {
                bodyData = JSON.parse(req.body.toString());
                console.log('Successfully parsed string/buffer body as JSON');
            } catch (e) {
                console.log('Body is not JSON format:', req.body.toString());
                // Just use the raw string as text
                bodyData = { text: req.body.toString() };
            }
        }

        console.log('Processed body data:', JSON.stringify(bodyData));

        // Get text from different possible locations in the payload
        let text = null;
        let audioUrl = null;

        // Try to extract text and audioUrl from different possible structures
        if (bodyData) {
            // Direct properties
            if (bodyData.text) {
                text = bodyData.text;
            }
            if (bodyData.audioUrl || bodyData.audio_url || bodyData.url) {
                audioUrl = bodyData.audioUrl || bodyData.audio_url || bodyData.url;
            }

            // Check for nested properties
            if (bodyData.data) {
                if (bodyData.data.text) {
                    text = bodyData.data.text;
                }
                if (bodyData.data.audioUrl || bodyData.data.audio_url || bodyData.data.url) {
                    audioUrl = bodyData.data.audioUrl || bodyData.data.audio_url || bodyData.data.url;
                }
            }

            // Check for message or content properties
            if (bodyData.message) {
                text = bodyData.message;
            }
            if (bodyData.content) {
                text = bodyData.content;
            }
        }

        console.log('Extracted text:', text);
        console.log('Extracted audioUrl:', audioUrl);

        let success = false;

        // Send a default message if nothing could be extracted
        if (!text && !audioUrl) {
            text = "New content generated in ElevenLabs";
        }

        // Send the text message
        if (text) {
            try {
                await sendToTelegram(`ElevenLabs says: ${text}`);
                success = true;
            } catch (error) {
                console.error('Failed to send text message:', error);
            }
        }

        // Send the audio if available
        if (audioUrl) {
            try {
                await sendAudioToTelegram(audioUrl);
                success = true;
            } catch (error) {
                console.error('Failed to send audio message:', error);
            }
        }

        // Always return 200 to prevent retries
        res.status(200).send('Webhook received and processed');
    } catch (error) {
        console.error('CRITICAL ERROR in webhook processing:', error);
        console.error('Error stack:', error.stack);
        // Always return 200 even when encountering errors
        res.status(200).send('Webhook received with errors');
    }
});

// Alternative endpoint for hyphen vs underscore
app.post('/elevenlabs_webhook', async (req, res) => {
    console.log('Received webhook on elevenlabs_webhook endpoint');
    // Simply forward to the main handler
    req.url = '/elevenlabs-webhook';
    app._router.handle(req, res);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment check - Bot token exists: ${!!TELEGRAM_BOT_TOKEN}, Chat ID exists: ${!!TELEGRAM_CHAT_ID}`);
});