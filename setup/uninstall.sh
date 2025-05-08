#!/bin/bash

bold=$(tput bold)
normal=$(tput sgr0)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
red=$(tput setaf 1)
magenta=$(tput setaf 5)
cyan=$(tput setaf 6)

info_echo() {
  local message="$1"
  echo "✂ ${bold}[INFO]${normal}: $message"
}

done_echo() {
  local message="$1"
  echo "✨ ${bold}${green}[DONE]: $message${normal} ✨"
}

TF_DIR="$HOME/.tiny-fax"

echo "🧾 ${bold}${magenta}tiny-fax removal${normal} 🧾"

info_echo "Removing crontab entries..."
bash $TF_DIR/tiny-fax/rm_crontab.sh

info_echo "Removing project files..."
rm -rf $TF_DIR

done_echo "tiny-fax removal complete!"
