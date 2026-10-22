#!/bin/zsh
# Run a JS file in the first Chrome tab whose URL contains <url-substring>.
# usage: cjs.sh <url-substring> <js-file>
# Needs Chrome > View > Developer > "Allow JavaScript from Apple Events".
osascript - "$1" "$2" <<'AS' 2>/dev/null
on run argv
  set needle to item 1 of argv
  set js to read POSIX file (item 2 of argv) as «class utf8»
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if (URL of t) contains needle then
          return execute t javascript js
        end if
      end repeat
    end repeat
  end tell
  return "TAB NOT FOUND"
end run
AS
