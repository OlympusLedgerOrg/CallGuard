# CallGuard

CallGuard is a Python-based voice call management service built with [Flask](https://flask.palletsprojects.com/). It exposes a REST API for Text-to-Speech (TTS) and Automatic Speech Recognition (ASR), designed to be integrated with [VibeVoice](https://github.com/microsoft/vibevoice) for real-time AI-powered call handling.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [API Reference](#api-reference)
  - [POST /api/tts](#post-apitts)
  - [POST /api/asr](#post-apiasr)
- [Error Handling](#error-handling)
- [Roadmap](#roadmap)

---

## Project Structure

```
CallGuard/
├── app.py            # Flask application — routes, config, and error handlers
├── requirements.txt  # Python dependencies (Flask, vibevoice)
└── README.md
```

---

## Requirements

- Python 3.10 or later
- pip

---

## Installation

```bash
pip install -r requirements.txt
```

---

## Configuration

All configuration is supplied through environment variables.

| Variable            | Default      | Description                                                       |
|---------------------|--------------|-------------------------------------------------------------------|
| `FLASK_DEBUG`       | `0`          | Set to `1` to enable Flask debug mode (development only).        |
| `MAX_CONTENT_LENGTH`| `52428800`   | Maximum accepted request body size in bytes (default: 50 MB).    |

---

## Running the Service

```bash
python app.py
```

The server starts on `http://localhost:5000` (Flask's default port).

**Development mode** (auto-reload + detailed error pages):

```bash
FLASK_DEBUG=1 python app.py
```

**Custom upload limit** (e.g., 100 MB):

```bash
MAX_CONTENT_LENGTH=104857600 python app.py
```

---

## API Reference

### POST /api/tts

Convert text to speech.

**Request**

`Content-Type: application/json`

```json
{
  "text": "Hello, how can I help you?"
}
```

**Response `200 OK`**

```json
{
  "status": "ok",
  "message": "TTS placeholder",
  "text": "Hello, how can I help you?"
}
```

---

### POST /api/asr

Transcribe an audio recording to text.

**Request**

`Content-Type: multipart/form-data`

| Field   | Type | Description                        |
|---------|------|------------------------------------|
| `audio` | file | Audio file to transcribe.          |

**Response `200 OK`**

```json
{
  "status": "ok",
  "message": "ASR placeholder",
  "transcript": ""
}
```

---

## Error Handling

| Status | Cause                                              | Response body                                                                 |
|--------|----------------------------------------------------|-------------------------------------------------------------------------------|
| `413`  | Audio upload exceeds `MAX_CONTENT_LENGTH`          | `{"status": "error", "message": "Audio file exceeds the maximum allowed size of <N> MB."}` |

---

## Roadmap

- [ ] Wire `/api/tts` to VibeVoice text-to-speech synthesis
- [ ] Wire `/api/asr` to VibeVoice automatic speech recognition
- [ ] Stream audio in/out for low-latency real-time calls
- [ ] Authentication / API key middleware
