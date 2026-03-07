#!/bin/bash
# Auto-format Java files after Edit/Write operations using Spotless
INPUT=$(cat)
FILE=$(echo "$INPUT" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input?.file_path ?? ''" 2>/dev/null)

if [[ "$FILE" == *.java ]]; then
  # Determine which module the file belongs to
  cd "$CLAUDE_PROJECT_DIR"
  MODULE=$(echo "$FILE" | sed "s|$CLAUDE_PROJECT_DIR/||" | cut -d'/' -f1)

  if [ -f "$MODULE/pom.xml" ]; then
    mvn -f "$MODULE/pom.xml" spotless:apply -q 2>/dev/null
    echo "{\"systemMessage\": \"Spotless formatting applied to $MODULE\"}"
  fi
fi
