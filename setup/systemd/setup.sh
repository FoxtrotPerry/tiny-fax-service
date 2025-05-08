#!/bin/bash

set -e  # Exit immediately if a command fails

# Define source and destination directories
SOURCE_DIR="$(pwd)"  # Assumes script is run from the directory containing the unit files
DEST_DIR="/etc/systemd/system"

echo "Moving systemd unit files to $DEST_DIR..."

# Find and move all .service and .timer files
for file in "$SOURCE_DIR"/*.service "$SOURCE_DIR"/*.timer; do
  if [[ -f "$file" ]]; then
    echo "Installing $file..."
    sudo mv "$file" "$DEST_DIR/"
    sudo chmod 644 "$DEST_DIR/$(basename "$file")"
  fi
done

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Enabling services and timers..."
for file in "$DEST_DIR"/*.service "$DEST_DIR"/*.timer; do
  unit_name=$(basename "$file")
  sudo systemctl enable "$unit_name"
done

echo "All systemd services and timers installed and enabled successfully!"
