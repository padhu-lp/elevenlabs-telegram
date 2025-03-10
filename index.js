// ElevenLabs to Telegram Integration

// Step 1: Set up the Telegram Bot
// You'll need to create a Telegram bot using BotFather and get your API token
const TELEGRAM_BOT_TOKEN = '7668616716:AAGweHZ1MN8IdKh-uA1pgmgEslY_32IUfLM';
const TELEGRAM_CHAT_ID = '6668840327'; // The chat ID where messages will be sent

// Step 2: Set up the ElevenLabs API
const ELEVENLABS_API_KEY = 'YOUR_ELEVENLABS_API_KEY';

// Function to send message to Telegram
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            })
        });

        const data = await response.json();
        console.log('Message sent to Telegram:', data);
        return data;
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        throw error;
    }
}

// Function to send audio file to Telegram
async function sendAudioToTelegram(audioUrl) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                audio: audioUrl
            })
        });

        const data = await response.json();
        console.log('Audio sent to Telegram:', data);
        return data;
    } catch (error) {
        console.error('Error sending audio to Telegram:', error);
        throw error;
    }
}

// Function to listen for ElevenLabs webhooks
// This assumes you're running a server (like Express) to handle incoming webhooks
function setupElevenLabsWebhook(app) {
    app.post('/elevenlabs-webhook', async (req, res) => {
        try {
            const { text, audioUrl } = req.body;

            // Send the text message
            if (text) {
                await sendToTelegram(`ElevenLabs says: ${text}`);
            }

            // Send the audio if available
            if (audioUrl) {
                await sendAudioToTelegram(audioUrl);
            }

            res.status(200).send('Message forwarded to Telegram');
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).send('Error processing webhook');
        }
    });
}
