import os

from flask import Flask, jsonify, request

app = Flask(__name__)


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
