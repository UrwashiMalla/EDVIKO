import json
import re

transcript_path = "/Users/mac/.gemini/antigravity-cli/brain/67e079e6-396b-48a9-b01c-aff4bda2fd93/.system_generated/logs/transcript_full.jsonl"
with open(transcript_path, 'r') as f:
    for line in f:
        data = json.loads(line)
        if 'content' in data:
            content = data['content']
            if 'Showing lines 1 to 245' in content and 'Courses.jsx' in content:
                # Extract the code
                lines = content.split('\n')
                code_lines = []
                for l in lines:
                    match = re.match(r'^\d+: (.*)$', l)
                    if match:
                        code_lines.append(match.group(1))
                
                with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/courses/Courses.jsx', 'w') as out:
                    out.write('\n'.join(code_lines))
                print("Recovered Courses!")
                break
