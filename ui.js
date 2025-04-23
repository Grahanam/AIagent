const vscode = require("vscode");
const path = require("path");

class AgentUI {
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.lastCommands = [];
  }

  createWebviewPanel(messageHandler) {
    this.panel = vscode.window.createWebviewPanel(
      "agent",
      "agent",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, "media")),
        ],
      }
    );

    this.setWebviewContent();

    this.panel.webview.onDidReceiveMessage(
      messageHandler,
      null,
      this.context.subscriptions
    );
  }

  setWebviewContent() {
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.context.extensionPath, "media", "styles.css")
      )
    );

    this.panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
          <div class="container">
              <div class="input-section">
                  <textarea id="taskInput" placeholder="Enter your task..."></textarea>
                  <button id="generateBtn">Generate Plan</button>
              </div>
              
              <div class="plan-section">
                  <div class="commands">
                      <h3>Commands</h3>
                      <div id="commandsList" class="code-block"></div>
                  </div>
                  
                  <div class="files">
                      <h3>Files</h3>
                      <div id="filesList" class="code-block"></div>
                  </div>
              </div>
              
              <div class="controls">
                  <button id="approveBtn" disabled>Approve & Run</button>
                  <button id="cancelBtn">Cancel</button>
                  <div id="status"></div>
              </div>
          </div>
          
    <script>
  const vscode = acquireVsCodeApi();

  const generateBtn = document.getElementById('generateBtn');
  const approveBtn = document.getElementById('approveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDiv = document.getElementById('status');

  function setProcessing(isProcessing, message = "", type = "") {
    generateBtn.disabled = isProcessing;
    cancelBtn.disabled = isProcessing;

    // Keep track of original button text
    if (!approveBtn.dataset.originalText) {
      approveBtn.dataset.originalText = approveBtn.innerText;
    }

    // Handle Approve button separately
    if (type === "approve") {
      approveBtn.disabled = true;
      approveBtn.innerText = isProcessing ? "Running..." : approveBtn.dataset.originalText;
    } else {
      approveBtn.disabled = isProcessing || approveBtn.dataset.ready !== "true";
    }

    statusDiv.innerText = isProcessing && message
      ? "Processing... " + message
      : (message || "");
  }

  generateBtn.addEventListener('click', function () {
    const task = document.getElementById('taskInput').value;
    vscode.postMessage({ type: 'generate', task: task });
    setProcessing(true, "Generating plan...");
  });

  approveBtn.addEventListener('click', function () {
    vscode.postMessage({ type: 'approve' });
    setProcessing(true, "Executing plan...", "approve");
  });

  cancelBtn.addEventListener('click', function () {
    vscode.postMessage({ type: 'cancel' });
    setProcessing(true, "Cancelling...");
  });

  window.addEventListener('message', function (event) {
    const message = event.data;
    console.log('Webview received:', message);

    if (message.type === 'updatePlan') {
      document.getElementById('commandsList').innerText = message.commands;
      document.getElementById('filesList').innerText = message.files;
      approveBtn.disabled = false;
      approveBtn.dataset.ready = "true";
      approveBtn.innerText = approveBtn.dataset.originalText;
      setProcessing(false, "Plan ready.");
    } else if (message.type === 'executionResult') {
      const msg = message.success
        ? "Execution succeeded: " + message.output
        : "Execution failed: " + message.output;
      approveBtn.innerText = approveBtn.dataset.originalText;
      setProcessing(false, msg);
    } else if (message.type === 'error') {
      approveBtn.innerText = approveBtn.dataset.originalText;
      setProcessing(false, "Error: " + message.error);
    }
  });
</script>

      </body>
      </html>
    `;
  }

  updatePlanDisplay(commands, files) {
    this.panel.webview.postMessage({
      type: "updatePlan",
      commands: commands.join("\n"),
      files: files.map((f) => `${f.path}:\n${f.content}`).join("\n\n"),
    });
  }

  showExecutionResult(success, output) {
    this.panel.webview.postMessage({
      type: "executionResult",
      success,
      output,
    });
  }

  showError(error) {
    this.panel.webview.postMessage({
      type: "error",
      error: error.message,
    });
  }
} 

module.exports = AgentUI; 