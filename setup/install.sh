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

wget -q --show-progress --progress=bar -P $TF_DIR https://github.com/foxtrotperry/tiny-fax-service/releases/latest/download/$TAR_FILE

if [ ! -f "$TAR_FILE" ]; then
  error_echo "tiny-fax distribution download failed"
  exit 1
fi

##### Unzip the tiny-fax distribution

info_echo "Extracting tiny-fax distribution tar..."

# unzip -o -qq $TAR_FILE.zip

# if [ ! -f "$TAR_FILE" ]; then
#   error_echo "tiny-fax distribution zip file failed to unzip"
#   exit 1
# fi

tar -xzvf $TAR_FILE

if [ ! -d "$TF_DIR/dist" ]; then
  error_echo "tiny-fax distribution tar.gz failed to extract"
  exit 1
fi

# chmod +x $TF_DIR/dist/bin/tiny_fax_service # TODO: confirm this isn't needed anymore

##### Use otp to get auth tokens

curl "https://api.tinyfax.chat/token?otp=$otp" -H "Accept: application/json" -o $TF_DIR/dist/bin/tokens.json

##### Clean up the artifacts

info_echo "Cleaning up artifacts..."
rm $TF_DIR/$TAR_FILE

##### Install the tiny-fax systemd services and timers

info_echo "Adding systemd services..."
source $TF_DIR/dist/setup/setup.sh

printf "\n"
done_echo "tiny-fax setup complete!"
