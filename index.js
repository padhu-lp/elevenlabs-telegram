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
        let rawData = '';
        req.on('data', chunk => {
            rawData += chunk;
        });

        req.on('end', () => {
            console.log('Raw webhook data received:', rawData);
            // Continue with normal Express parsing
            next();
        });
    } else {
        next();
    }
});

// Regular middleware
app.use(express.json());

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

// Set up ElevenLabs webhook endpoint - updated to be more flexible
app.post('/elevenlabs-webhook', async (req, res) => {
    try {
        console.log('Received webhook from ElevenLabs with body:', JSON.stringify(req.body));
        console.log('Headers:', JSON.stringify(req.headers));

        // Get text from different possible locations in the payload
        let text = null;
        let audioUrl = null;

        // Try to extract text and audioUrl from different possible structures
        if (req.body) {
            // Direct properties
            if (req.body.text) {
                text = req.body.text;
            }
            if (req.body.audioUrl || req.body.audio_url || req.body.url) {
                audioUrl = req.body.audioUrl || req.body.audio_url || req.body.url;
            }

            // Check for nested properties
            if (req.body.data) {
                if (req.body.data.text) {
                    text = req.body.data.text;
                }
                if (req.body.data.audioUrl || req.body.data.audio_url || req.body.data.url) {
                    audioUrl = req.body.data.audioUrl || req.body.data.audio_url || req.body.data.url;
                }
            }

            // Check for message or content properties
            if (req.body.message) {
                text = req.body.message;
            }
            if (req.body.content) {
                text = req.body.content;
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

        if (success) {
            res.status(200).send('Message forwarded to Telegram');
        } else {
            res.status(200).send('Received webhook but could not process data');
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Still return 200 to prevent ElevenLabs from retrying
        res.status(200).send('Error processing webhook');
    }
});

// Alternative endpoint (in case ElevenLabs is using a different URL format)
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