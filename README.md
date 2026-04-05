# CallGuard

CallGuard is a call-management service that will use **VibeVoice** for both Text-to-Speech (TTS) and Automatic Speech Recognition (ASR).

## Project Structure

```
CallGuard/
├── app.py            # Flask application entry point
├── requirements.txt  # Python dependencies
└── README.md
```

## Requirements

- Python 3.10+
- pip

## Installation

```bash
pip install -r requirements.txt
```

## Running the Service

```bash
python app.py
```

The server starts on `http://localhost:5000` (Flask's default port).

To enable debug mode, set `FLASK_DEBUG=1`:

```bash
FLASK_DEBUG=1 python app.py
```

## API Endpoints

### `POST /api/tts`

Convert text to speech.

**Request body (JSON):**
```json
{ "text": "Hello, how can I help you?" }
```

**Response:**
```json
{ "status": "ok", "message": "TTS placeholder", "text": "Hello, how can I help you?" }
```

### `POST /api/asr`

Transcribe audio to text.

**Request:** multipart form-data with an `audio` file field.

**Response:**
```json
{ "status": "ok", "message": "ASR placeholder", "transcript": "" }
```

## VibeVoice Integration

The TTS and ASR endpoints are currently placeholders. Full integration with the `vibevoice` library will be added in subsequent iterations to enable real-time voice synthesis and transcription for calls.
