#!/bin/bash

bold=$(tput bold)
normal=$(tput sgr0)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
red=$(tput setaf 1)
magenta=$(tput setaf 5)
cyan=$(tput setaf 6)

otp=invalid

TF_DIR="/opt/tiny-fax"
TAR_FILE="tiny-fax-service.tar.gz"

RPI_SOURCE_LIST=/etc/apt/sources.list.d/raspi.list

# Function instantiation

ask_echo() {
  local message="$1"
  echo "❔ ${cyan}[PERMISSION]: $message${normal}"
}

info_echo() {
  local message="$1"
  echo "📝 ${bold}[INFO]${normal}: $message"
}

warn_echo() {
  local message="$1"
  echo "⚠️ ${bold}${yellow}[WARN]${normal}${yellow}: $message${normal}"
}

error_echo() {
  local message="$1"
  echo "❌ ${bold}${red}[ERROR]${normal}${red}: $message${normal}" >&2
}

success_echo() {
  local message="$1"
  echo "✅ ${bold}[SUCCESS]: $message${normal}"
}

done_echo() {
  local message="$1"
  echo "✨ ${bold}${green}[DONE]: $message${normal} ✨"
}

echo "🧾 ${bold}${magenta}tiny-fax installation${normal} 🧾"
printf "\n"

##### Check if a valid access code was provided

# Check if an argument is provided
if [ -z "$1" ]; then
  error_echo "Access code not provided"
  exit 1
fi

# Get the length of the argument
arg_length=${#1}

# Check if the argument length is exactly 16
if [ $arg_length -eq 16 ]; then
  otp="$1"
else
  error_echo "Access code is invalid"
  exit 1
fi

##### Check if the script is run as root

if [[ -n "$SUDO_USER" ]]; then
  ask_echo "This script must be run as root. Do you want to run it with sudo?"
  read -p "(y/n): " response </dev/tty
  if [[ $response =~ ^[Yy]$ ]]; then
    sudo "$0" "$@"
    exit
  else
    error_echo "Script must be run as root. Exiting..."
    exit 1
  fi
fi

##### Check is there is a previous installation and uninstall it

if [ -d "$TF_DIR" ]; then
  ask_echo "Previous installation found. Do you want to uninstall it?"
  read -p "(y/n): " response </dev/tty
  if [[ $response =~ ^[Yy]$ ]]; then
    curl -sSL uninstall.tinyfax.chat | bash
  else
    error_echo "Previous installation must be removed before installing. Exiting..."
    exit 1
  fi
fi

##### Check if we're running on a Raspberry Pi using Raspbian OS

if [ -f "$RPI_SOURCE_LIST" ] && grep -q "http://archive.raspberrypi.com/debian/" $RPI_SOURCE_LIST; then
  info_echo "Raspbian OS detected"
else
  warn_echo "Raspbian OS not detected! SKY PI might not work properly. If you run into problems, please create an issue on GitHub including what OS you're running!"
fi

##### Make the tiny-fax directory

info_echo "Making tiny-fax directory at $TF_DIR..."
sudo mkdir -p $TF_DIR

if [ ! -d "$TF_DIR" ]; then
  error_echo "Failed to create tiny-fax directory"
  exit 1
fi

cd $TF_DIR

##### Get the latest tiny-fax distribution

info_echo "Downloading latest tiny-fax distribution..."

# need sudo so that tar can be placed in /opt
sudo wget -q --show-progress --progress=bar -P $TF_DIR https://github.com/foxtrotperry/tiny-fax-service/releases/latest/download/$TAR_FILE

if [ ! -f "$TAR_FILE" ]; then
  error_echo "tiny-fax distribution download failed"
  exit 1
fi

##### Unzip the tiny-fax distribution

info_echo "Extracting tiny-fax distribution tar..."

sudo tar -xzf $TAR_FILE

if [ ! -d "$TF_DIR/dist" ]; then
  error_echo "tiny-fax distribution tar.gz failed to extract"
  exit 1
fi

##### Move wasm files to project directory

info_echo "Moving wasm files to project directory..."
sudo mv $TF_DIR/dist/setup/node_modules $TF_DIR/

##### Make directory for logs

info_echo "Making log directory at $TF_DIR/logs..."

sudo mkdir -p $TF_DIR/logs
if [ ! -d "$TF_DIR/logs" ]; then
  error_echo "Failed to create tiny-fax log directory"
  exit 1
fi

##### Use otp to get auth tokens

info_echo "Getting auth tokens..."

sudo curl "https://api.tinyfax.chat/token?otp=$otp" -H "Accept: application/json" -o $TF_DIR/dist/bin/tokens.json

##### Clean up the artifacts

info_echo "Cleaning up artifacts..."
sudo rm $TF_DIR/$TAR_FILE

##### Install the tiny-fax systemd services and timers

info_echo "Adding systemd services..."
source $TF_DIR/dist/setup/setup.sh

printf "\n"
done_echo "tiny-fax setup complete!"
