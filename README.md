# AI Task Agent Extension

A VS Code extension that uses AI to generate and execute system automation plans.

## Features

🚀 **AI-Powered Automation**

- Generate system commands/files for complex tasks via natural language
- Interactive plan approval workflow
- Cross-platform command generation (Linux/macOS/Windows)

🛡️ **Safe Execution**

- Visual confirmation before executing commands
- Sudo password handling with secure input
- Execution logging and error reporting

📁 **File Operations**

- Automatic file creation with generated content
- Output validation and error handling

## Requirements

- **Node.js** >= 18.x
- **Python** >= 3.8
- **VS Code** >= 1.85.0
- OpenAI API access (or compatible LLM endpoint)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/ai-task-agent.git
cd ai-task-agent

```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Python Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate  # Windows

# Install Python dependencies
pip install python-dotenv openai

```

### 4. Configuration

Create .env file in project root:
recommended:openai/gpt-4.1(free)

```bash
AI_AGENT_TOKEN=your_api_token_here
AI_AGENT_ENDPOINT=api_end_point
AI_AGENT_MODEL=api_model
```

## Usage

- Open extension.js file. Press F5
- In New Vscode window, open Command Palette (Ctrl+Shift+P)
- Select "AI Agent: Show Panel"
- Enter your task (e.g., "Install krita")
- Review generated plan
- Approve or cancel execution
