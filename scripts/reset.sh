#!/bin/bash
# Reset script to remove build files, node_modules, and reinstall

echo "Cleaning up..."

# Remove top-level node_modules and lock file
rm -rf node_modules
rm -f bun.lockb bun.lock

# Remove child node_modules and build directories
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
find . -name ".turbo" -type d -prune -exec rm -rf '{}' +
find . -name ".next" -type d -prune -exec rm -rf '{}' +
find . -name "dist" -type d -prune -exec rm -rf '{}' +
find . -name "build" -type d -prune -exec rm -rf '{}' +

echo "Finished cleaning up old files."
echo "Reinstalling dependencies via bun install..."
bun install

echo "Reset complete! You can now start the application with 'bun run dev:all'"
