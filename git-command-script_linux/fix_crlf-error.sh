#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Batch CRLF to LF Line Ending Fixer\007"

echo "======================================================"
echo "       CRLF to LF Line Ending Conversion Tool"
echo "======================================================"
echo ""

# Strictly restrict to the current working directory
TARGET_DIR="$(pwd)"
echo "Current Directory  : $TARGET_DIR"
echo "Scope              : Current directory and subdirectories only"
echo "Safety Rule        : Parent directories will NOT be modified"
echo "======================================================"
echo ""

# Verify required utilities
if ! command -v file >/dev/null 2>&1; then
    echo "[ERROR] Command 'file' not found. Please install it using: apt-get install file"
    exit 1
fi

if ! command -v sed >/dev/null 2>&1; then
    echo "[ERROR] Command 'sed' not found."
    exit 1
fi

TOTAL_SCANNED=0
TOTAL_FIXED=0

echo "[INFO] Scanning for files with CRLF line terminators..."
echo "------------------------------------------------------"

# Recursively traverse files in current directory and subdirectories
# Skip .git directory to protect repository integrity
while IFS= read -r -d '' file_path; do
    ((TOTAL_SCANNED++))

    # Detect whether file is a text file containing CRLF
    file_info=$(file "$file_path" 2>/dev/null)
    if [[ "$file_info" == *"CRLF"* ]]; then
        # Safely remove carriage returns (\r)
        if sed -i 's/\r$//' "$file_path" 2>/dev/null; then
            echo "[FIXED] ${file_path#./}"
            ((TOTAL_FIXED++))
        else
            echo "[FAILED] Permission denied: ${file_path#./}"
        fi
    fi
done < <(find . -type d -name ".git" -prune -o -type f -print0)

echo "------------------------------------------------------"
echo "Scan Summary:"
echo "  Total files scanned   : $TOTAL_SCANNED"
echo "  Total files converted : $TOTAL_FIXED"
echo "======================================================"
echo "[SUCCESS] Line ending correction completed."