"""
MemoryTonic v4 — NLP Setup Script (Cross-Platform)

Creates .venv, installs dependencies, downloads models.
Run once. ~640MB total download.

Usage:
  python nlp/setup-nlp.py
"""

import subprocess
import sys
import os
from pathlib import Path


def main():
    script_dir = Path(__file__).parent.resolve()
    venv_dir = script_dir / ".venv"
    requirements = script_dir / "requirements.txt"

    print("=" * 50)
    print(" MemoryTonic v4 — NLP Setup")
    print("=" * 50)
    print()

    # Step 1: Check Python version
    version = sys.version_info
    print(f"[1/4] Python {version.major}.{version.minor}.{version.micro}")
    if version < (3, 9):
        print("[ERROR] Python 3.9+ required.")
        sys.exit(1)

    # Step 2: Create venv
    if venv_dir.exists():
        py = get_venv_python(venv_dir)
        if py and py.exists():
            print(f"[2/4] Virtual environment exists at {venv_dir}")
        else:
            print(f"[2/4] Recreating virtual environment (broken)...")
            import shutil
            shutil.rmtree(venv_dir)
            create_venv(venv_dir)
    else:
        print(f"[2/4] Creating virtual environment at {venv_dir}...")
        create_venv(venv_dir)

    venv_python = get_venv_python(venv_dir)
    if not venv_python or not venv_python.exists():
        print("[ERROR] Failed to create virtual environment.")
        sys.exit(1)

    # Step 3: Install packages
    print()
    print("[3/4] Installing Python packages...")
    run_cmd([str(venv_python), "-m", "pip", "install", "--upgrade", "pip", "--quiet"])
    run_cmd([str(venv_python), "-m", "pip", "install", "-r", str(requirements), "--quiet"])

    # Step 4: Download models
    print()
    print("[4/4] Downloading NLP models (~640MB total)...")
    print("  - spaCy en_core_web_lg (~560MB)...")
    run_cmd([str(venv_python), "-m", "spacy", "download", "en_core_web_lg", "--quiet"])

    print("  - BERT all-MiniLM-L6-v2 (~80MB)...")
    run_cmd([
        str(venv_python), "-c",
        "from sentence_transformers import SentenceTransformer; "
        "m = SentenceTransformer('all-MiniLM-L6-v2'); "
        "print(f'  Model loaded: {m.get_sentence_embedding_dimension()}d')"
    ])

    print()
    print("=" * 50)
    print(" Setup complete!")
    print("=" * 50)


def create_venv(venv_dir: Path):
    subprocess.run(
        [sys.executable, "-m", "venv", str(venv_dir)],
        check=True,
    )


def get_venv_python(venv_dir: Path):
    """Get Python binary inside venv (cross-platform)."""
    candidates = [
        venv_dir / "Scripts" / "python.exe",   # Windows
        venv_dir / "bin" / "python3",           # Unix
        venv_dir / "bin" / "python",            # Unix fallback
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def run_cmd(cmd: list):
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Command failed: {' '.join(cmd)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
