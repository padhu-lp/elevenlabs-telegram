// ElevenLabs to Telegram Integration (ES Module version)
import express from 'express';
import fetch from 'node-fetch';

// Configuration variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

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

// Create Express server
const app = express();
app.use(express.json());

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

// Set up ElevenLabs webhook endpoint
app.post('/elevenlabs-webhook', async (req, res) => {
    try {
        console.log('Received webhook from ElevenLabs:', JSON.stringify(req.body));

        const { text, audioUrl } = req.body;
        let success = false;

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
            res.status(500).send('Failed to forward message to Telegram');
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment check - Bot token exists: ${!!TELEGRAM_BOT_TOKEN}, Chat ID exists: ${!!TELEGRAM_CHAT_ID}`);
});
