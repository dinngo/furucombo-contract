# Configure to exit script as soon as a command fails.
set -o errexit

# Configure the existing build directory.
rm -rf build

# Compile everything else.
npm run compile
