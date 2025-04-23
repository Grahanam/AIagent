import os
import sys
import json
import platform
import subprocess
from openai import OpenAI
from argparse import ArgumentParser
from pathlib import Path
from dotenv import load_dotenv

# Get configuration from environment variables
# DEFAULT_TOKEN = os.environ.get("AI_AGENT_TOKEN")
# DEFAULT_ENDPOINT = os.environ.get("AI_AGENT_ENDPOINT")
# DEFAULT_MODEL = os.environ.get("AI_AGENT_MODEL")


def create_client(token, endpoint):
    if not token or not endpoint:
        raise ValueError("API token and endpoint are required. Please set AI_AGENT_TOKEN and AI_AGENT_ENDPOINT environment variables.")
    return OpenAI(base_url=endpoint, api_key=token)

def get_os_context():
    return {"Linux": "ubuntu-latest", "Darwin": "macos-latest", "Windows": "windows-latest"}.get(
        platform.system(), "ubuntu-latest"
    )

def generate_plan(task, client, model):
    if not model:
        raise ValueError("Model is required. Please set AI_AGENT_MODEL environment variable.")
        
    os_context = get_os_context()
    prompt = f"""You are a cross-platform system automation expert. Generate safe, OS-specific commands using this format:

OS: {os_context}
Commands:
1. command_1  # Comment explaining why
2. command_2

Files:
- /path/file.txt: |
    file content

Task: {task}

Guidelines:
- Prefer cross-platform tools where possible
- Never use rm -rf /
- Handle paths appropriately for OS
- Include error handling"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Generate safe, OS-specific system commands and file changes"},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content

def parse_response(response):
    commands, files = [], []
    current_section = None
    current_file = None

    for line in response.split('\n'):
        line = line.strip()
        if not line:
            continue

        if line.startswith("Commands:"):
            current_section = "commands"
        elif line.startswith("Files:"):
            current_section = "files"
        elif current_section == "commands" and line[0].isdigit():
            cmd = line.split('. ', 1)[1].split('  #')[0].strip()
            if cmd:
                commands.append(cmd)
        elif current_section == "files" and line.startswith('- '):
            if current_file:
                files.append(current_file)
            file_part = line[2:].split(':', 1)
            filename = file_part[0].strip()
            content = file_part[1].strip() if len(file_part) > 1 else ""
            current_file = (filename, content)
        elif current_section == "files" and current_file:
            current_file = (current_file[0], current_file[1] + '\n' + line)

    if current_file:
        files.append(current_file)

    return commands, files

def load_env_vars():
    """Load environment variables with better path handling"""
    try:
        # Try from script location
        base_path = Path(__file__).resolve().parent.parent.parent
        env_path = base_path / '.env'
        
        if not env_path.exists():
            # Try from current working directory
            env_path = Path.cwd() / '.env'
            
        if not env_path.exists():
            raise FileNotFoundError(f".env not found in {base_path} or {Path.cwd()}")

        load_dotenv(env_path)
        print(f"✅ Loaded .env from: {env_path}", file=sys.stderr)
        
    except Exception as e:
        print(f"❌ Error loading .env: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():

    # Add this at the start of main()
    print("\n--- DEBUG INFO ---", file=sys.stderr) 
    print(f"Python version: {sys.version}", file=sys.stderr) 
    print(f"Current working directory: {Path.cwd()}", file=sys.stderr)
    print(f"Script location: {Path(__file__).resolve()}", file=sys.stderr)
    load_env_vars()
    token = os.getenv("AI_AGENT_TOKEN")
    endpoint = os.getenv("AI_AGENT_ENDPOINT")
    model = os.getenv("AI_AGENT_MODEL")

    print(f"TOKEN: {'*****' if token else 'MISSING'}", file=sys.stderr)
    print(f"ENDPOINT: {endpoint}", file=sys.stderr)
    print(f"MODEL: {model}", file=sys.stderr)
    parser = ArgumentParser(description='AI Task Automation Agent')
    parser.add_argument('--task', required=True, help='Task description')
    args = parser.parse_args()
    
    

    print("Starting plan generation...", file=sys.stderr)
    print(f"Task: {args.task}", file=sys.stderr)
    print(f"Using configuration:", file=sys.stderr)
    print(f"Endpoint: {endpoint}", file=sys.stderr)
    print(f"Model: {model}", file=sys.stderr)

    try:
        client = create_client(token, endpoint)
        plan = generate_plan(args.task, client, model)
        print("Plan generated successfully", file=sys.stderr)

        if plan.startswith("Error:"):
            raise Exception(plan)

        print("Parsing response...", file=sys.stderr)
        commands, files = parse_response(plan)
        print("Response parsed successfully", file=sys.stderr)

        result = json.dumps({
            "commands": commands,
            "files": [{"path": f[0], "content": f[1]} for f in files],
            "error": None
        })
        print("Sending result...", file=sys.stderr)
        sys.stdout.write(result + "\n")  # Explicit single write
        sys.stdout.flush()

    except Exception as e:
        print(f"Error occurred: {str(e)}", file=sys.stderr)
        result = json.dumps({
            "commands": [],
            "files": [],
            "error": str(e)
        })
        print(result)
        print(result, flush=True)  # Force immediate output
        sys.exit(1)

if __name__ == "__main__":
    main()