// require("dotenv").config();
const vscode = require("vscode");
const AgentUI = require("./ui");
const { PythonShell } = require("python-shell");
const path = require("path");
const { exec } = require("child_process");

const dotenv = require("dotenv");

const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Extension "agent" is now active!');

  const agentUI = new AgentUI(context);

  // Register the command
  let disposable = vscode.commands.registerCommand("agent.showPanel", () => {
    agentUI.createWebviewPanel(async (message) => {
      console.log("Received message from Webview:", message);
      switch (message.type) {
        case "generate":
          await handleGeneratePlan(message.task, agentUI);
          break;
        case "approve":
          console.log("Executing plan...");
          await executePlan(agentUI);
          break;
        case "cancel":
          agentUI.panel?.dispose();
          break;
      }
    });
  });

  context.subscriptions.push(disposable);
}

async function handleGeneratePlan(task, agentUI) {
  console.log("handle execute running");
  const options = {
    mode: "text",
    pythonPath: path.join(
      agentUI.context.extensionPath,
      ".venv",
      "bin",
      "python"
    ),
    scriptPath: path.join(agentUI.context.extensionPath, "src", "agent"),
    args: ["--task", task],
  };

  try {
    console.log(
      "Running Python script with options:",
      JSON.stringify(options, null, 2)
    );
    console.log(
      "Full command:",
      `${options.pythonPath} ${path.join(
        options.scriptPath,
        "pythonAgent.py"
      )} ${options.args.join(" ")}`
    );
    console.log("Current working directory:", process.cwd());
    const results = await new Promise((resolve, reject) => {
      const output = [];
      const pyProcess = new PythonShell("pythonAgent.py", options);

      pyProcess.on("message", (message) => {
        console.log("PY OUTPUT:", message);
        output.push(message);
      });

      pyProcess.on("stderr", (stderr) => {
        console.error("PY ERROR:", stderr);
      });

      pyProcess.end((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(output);
        }
      });
    });

    console.log("Raw results:", results); // Add this

    // Add this error logging before the results check
    console.log("Python stdout:", results);
    if (!results.length) {
      throw new Error("No output from Python script");
    }

    // Join multi-line JSON output
    const jsonString = results.join("").trim();
    console.log("Raw JSON:", jsonString);
    
    if (results.length > 1) {
      console.error("Multiple JSON outputs detected:", results);
      throw new Error("Python script generated multiple outputs");
    }
    
    let json;
    try {
      json = JSON.parse(jsonString);
      console.log("Parsed JSON result:", json);
    } catch (err) {
      console.error("Failed to parse JSON. Raw results:", jsonString);
      throw new Error(`Invalid JSON from Python: ${err.message}`);
    }
    
    const { commands, files, error } = json;

    if (error) {
      console.error("Error in plan generation:", error);
      throw new Error(error);
    }
    if (!Array.isArray(commands)) {
      console.error("Invalid commands format:", commands);
      throw new Error("Commands missing or invalid format");
    }
    if (!Array.isArray(files)) {
      console.error("Invalid files format:", files);
      throw new Error("Files missing or invalid format");
    }

    agentUI.lastCommands = commands;
    agentUI.updatePlanDisplay(commands, files);
    vscode.window.showInformationMessage("Plan generated successfully!");
  } catch (error) {
    console.error("handleGeneratePlan error:", error);
    console.error("Error stack:", error.stack);
    agentUI.showError(error);
    vscode.window.showErrorMessage(`Failed to generate plan: ${error.message}`);
  }
  console.log("handle execute ended");
}

async function executePlan(agentUI) {
  if (!agentUI.lastCommands?.length) {
    vscode.window.showErrorMessage("No commands to run.");
    return;
  }

  try {
    // Show progress notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Executing Plan",
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          vscode.window.showInformationMessage("Plan execution cancelled");
        });

        // Execute commands one by one
        for (const cmd of agentUI.lastCommands) {
          progress.report({ message: `Executing: ${cmd}` });

          // Check if command requires sudo
          if (cmd.startsWith("sudo")) {
            const password = await vscode.window.showInputBox({
              prompt: "Enter your sudo password",
              password: true,
              placeHolder: "Password",
              ignoreFocusOut: true,
            });

            if (!password) {
              throw new Error("Sudo password required but not provided");
            }

            // Modify command to use -S flag for sudo
            const sudoCmd = cmd.replace("sudo", `echo '${password}' | sudo -S`);

            await new Promise((resolve, reject) => {
              exec(sudoCmd, (error, stdout, stderr) => {
                if (error) {
                  console.error("Exec error:", error);
                  agentUI.showExecutionResult(false, stderr || error.message);
                  reject(error);
                } else {
                  console.log("Exec output:", stdout);
                  agentUI.showExecutionResult(true, stdout || "No output");
                  resolve();
                }
              });
            });
          } else {
            // Regular command execution
            await new Promise((resolve, reject) => {
              exec(cmd, (error, stdout, stderr) => {
                if (error) {
                  console.error("Exec error:", error);
                  agentUI.showExecutionResult(false, stderr || error.message);
                  reject(error);
                } else {
                  console.log("Exec output:", stdout);
                  agentUI.showExecutionResult(true, stdout || "No output");
                  resolve();
                }
              });
            });
          }
        }
      }
    );

    vscode.window.showInformationMessage("Plan execution completed");
  } catch (error) {
    console.error("Plan execution failed:", error);
    vscode.window.showErrorMessage(`Plan execution failed: ${error.message}`);
    agentUI.showExecutionResult(false, error.message);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
