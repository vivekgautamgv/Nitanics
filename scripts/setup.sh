#!/bin/bash
# High-Level Full Setup Script for MemoryTonic v4

echo "========================================="
echo " Starting MT-v4 Full Installation & Setup"
echo "========================================="

# 1. Check and Install Bun
if ! command -v bun &> /dev/null; then
    echo "[SETUP] ⚙️ Bun is not installed. Installing Bun..."
    # If they are on Git Bash (Windows) with NPM available
    if command -v npm &> /dev/null; then
        echo "[SETUP] npm found. Installing bun globally..."
        npm install -g bun
    else
        echo "[SETUP] npm not found. Falling back to bash installer..."
        curl -fsSL https://bun.sh/install | bash
        
        # Source the bashrc dynamically depending on OS config
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
    fi
else
    echo "[SETUP] ✅ Bun is already installed: $(bun --version)"
fi

# Double verify Bun is now accessible
if ! command -v bun &> /dev/null; then
    echo "[ERROR] Bun installation failed or is not in PATH. Please install Bun manually."
    exit 1
fi

# 2. Check and Install uv (Python Package Manager)
if ! command -v uv &> /dev/null; then
    echo "[SETUP] ⚙️ uv is not installed. Installing uv..."
    if command -v pip &> /dev/null; then
        pip install uv
    else
        echo "[ERROR] Python/pip not found! Please install Python 3.10+ first."
        exit 1
    fi
else
    echo "[SETUP] ✅ uv is already installed: $(uv --version)"
fi

# 3. Clean Previous Environment
echo "[SETUP] 🧹 Cleaning previous environments to ensure a flawless install..."
rm -rf node_modules
rm -f bun.lockb bun.lock
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
find . -name ".turbo" -type d -prune -exec rm -rf '{}' +
find . -name ".next" -type d -prune -exec rm -rf '{}' +
find . -name "dist" -type d -prune -exec rm -rf '{}' +
rm -rf apps/ingestion-pipeline/.venv

# 4. Install Monorepo Node Dependencies (triggering postinstall automatically)
echo "[SETUP] 📦 Running Mono-Repo Dependency Resolution (Bun + UV)..."
bun install

# 5. Automatically Provision Graph DB and .env Files!
echo "[SETUP] 🕸️ Auto-provisioning Neo4j Docker and injecting .env files everywhere..."
bun run neo4j:ensure

echo "========================================="
echo " 🎉 Full Reinstallation & Setup Complete! "
echo " You can now safely run: 'bun run dev'    "
echo "========================================="
