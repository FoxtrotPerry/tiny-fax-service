#!/bin/bash

set -e  # Exit immediately if a command fails

bold=$(tput bold)
normal=$(tput sgr0)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
red=$(tput setaf 1)
magenta=$(tput setaf 5)
cyan=$(tput setaf 6)

TF_DIR="/opt/tiny-fax"
DEST_DIR="/etc/systemd/system"

installed_units=()

info_echo() {
  local message="$1"
  echo "📝 ${bold}[INFO]${normal}: $message"
}

info_echo "Moving systemd unit files to $DEST_DIR..."

# Find and move all .service and .timer files
for file in $TF_DIR/dist/setup/*.service $TF_DIR/dist/setup/*.timer; do
  if [[ -f "$file" ]]; then
    info_echo "Installing $file..."
    sudo mv "$file" "$DEST_DIR/"
    sudo chmod 644 "$DEST_DIR/$(basename "$file")"
    installed_units+=("$(basename "$file")")
  fi
done

info_echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

info_echo "Enabling services and timers..."
for unit in "${installed_units[@]}"; do
  info_echo "Enabling $unit..."
  sudo systemctl enable "$unit"
done

info_echo "All systemd services and timers installed and enabled successfully!"
