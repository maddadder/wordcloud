from pathlib import Path
import sys
from whisper_live.client import TranscriptionClient
import argparse


if __name__ == '__main__':
    from whisper_live.client import TranscriptionClient
    client = TranscriptionClient(
    "localhost",
    9090,
    lang="en",
    translate=False,
    model="small",                                      # also support hf_model => `Systran/faster-whisper-small`
    use_vad=True,
    save_output_recording=False,                         # Only used for microphone input, False by Default
    output_recording_filename="./output_recording.wav", # Only used for microphone input
    mute_audio_playback=False,                          # Only used for file input, False by Default
    #enable_translation=False,
    #target_language="en",
    )
    client()
