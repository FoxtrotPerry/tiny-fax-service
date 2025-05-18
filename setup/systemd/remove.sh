#!/bin/bash
# filepath: /Users/foxtrotperry/Dev/tiny-fax-client/setup/systemd/remove.sh

set -e  # Exit immediately if a command fails

bold=$(tput bold)
normal=$(tput sgr0)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
red=$(tput setaf 1)
magenta=$(tput setaf 5)
cyan=$(tput setaf 6)

TF_DIR="/opt/tiny-fax"
SYSTEMD_DIR="/etc/systemd/system"

info_echo() {
  local message="$1"
  echo "📝 ${bold}[INFO]${normal}: $message"
}

warn_echo() {
  local message="$1"
  echo "⚠️ ${yellow}[WARN]${normal}: $message"
}

# Check if the setup directory exists
if [[ ! -d "$TF_DIR/dist/setup" ]]; then
  warn_echo "Setup directory not found at $TF_DIR/dist/setup"
  warn_echo "Will attempt to remove any tiny-fax related systemd units"

  # Look for any files in systemd directory that might be related to tiny-fax
  for unit in "$SYSTEMD_DIR"/*tf_*.service "$SYSTEMD_DIR"/*tf_*.timer; do
    if [[ -f "$unit" ]]; then
      unit_name=$(basename "$unit")

      info_echo "Stopping and disabling $unit_name..."
      sudo systemctl stop "$unit_name" 2>/dev/null || true
      sudo systemctl disable "$unit_name" 2>/dev/null || true

      info_echo "Removing $unit_name..."
      sudo rm -f "$unit"
    fi
  done
else
  # Look for service and timer files in the setup directory
  info_echo "Looking for service and timer files in $TF_DIR/dist/setup..."

  for file in "$TF_DIR"/dist/setup/*.service "$TF_DIR"/dist/setup/*.timer; do
    if [[ -f "$file" ]]; then
      filename=$(basename "$file")
      systemd_file="$SYSTEMD_DIR/$filename"

      # Check if the file exists in systemd directory
      if [[ -f "$systemd_file" ]]; then
        info_echo "Stopping and disabling $filename..."
        sudo systemctl stop "$filename" 2>/dev/null || true
        sudo systemctl disable "$filename" 2>/dev/null || true

        info_echo "Removing $filename..."
        sudo rm -f "$systemd_file"
      else
        warn_echo "File $filename not found in $SYSTEMD_DIR, skipping..."
      fi
    fi
  done
fi

info_echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

info_echo "All relevant systemd services and timers have been successfully removed!"
