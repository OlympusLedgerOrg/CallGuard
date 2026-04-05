import os

from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)

# Maximum allowed audio upload size (default 50 MB; override with MAX_CONTENT_LENGTH env var).
_DEFAULT_MAX_BYTES = 50 * 1024 * 1024
try:
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_LENGTH", str(_DEFAULT_MAX_BYTES)))
except (TypeError, ValueError):
    app.config["MAX_CONTENT_LENGTH"] = _DEFAULT_MAX_BYTES


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(e):
    """Return a structured JSON 413 response instead of an unhandled HTML error."""
    limit_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
    return (
        jsonify(
            {
                "status": "error",
                "message": f"Audio file exceeds the maximum allowed size of {limit_mb} MB.",
            }
        ),
        413,
    )


@app.route("/api/tts", methods=["POST"])
def tts():
    """Text-to-Speech placeholder endpoint.

    Accepts JSON with a 'text' field and returns a placeholder response.
    This will be wired to vibevoice TTS once the integration is complete.
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    # TODO: pass `text` through vibevoice TTS and return the audio stream
    return jsonify({"status": "ok", "message": "TTS placeholder", "text": text})


@app.route("/api/asr", methods=["POST"])
def asr():
    """Automatic Speech Recognition placeholder endpoint.

    Accepts an audio file upload (field name 'audio') and returns a
    placeholder transcript.  This will be wired to vibevoice ASR once the
    integration is complete.
    """
    # TODO: read audio from request.files['audio'] and pass through vibevoice ASR
    return jsonify({"status": "ok", "message": "ASR placeholder", "transcript": ""})


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug)
