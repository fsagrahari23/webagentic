import bodyParser from "body-parser";
import Groq from "groq-sdk";
import { execSync } from "child_process";
import express from "express";
import os from "os";
import fs from "fs";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ports
const PORT = process.env.PORT || 3000;
const PREVIEW_PORT = 5000;
const app = express();
// Folder to serve websites from
const WEBSITES_DIR = path.join(__dirname, "websites");

if (!fs.existsSync(WEBSITES_DIR)) {
  fs.mkdirSync(WEBSITES_DIR, { recursive: true });
}

// Security middleware - Less restrictive for development
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  })
);
app.use(bodyParser.json({ limit: "10mb" }));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 50 : 1000, // More requests in dev
  skip: (req) => {
    // Skip rate limiting for health checks and in development
    if (req.path === "/health" || process.env.NODE_ENV !== "production") {
      return true;
    }
    return false;
  },
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// CORS configuration - Fixed for development
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // In development, allow localhost on any port
      if (process.env.NODE_ENV !== "production") {
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }
      }

      // In production, check allowed origins
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Default: allow all origins if no specific config (development fallback)
      return callback(null, true);
    },
    credentials: true,
    methods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    optionsSuccessStatus: 200, // For legacy browser support
  })
);
// --------------------
// 🚀 Server 1: AI Agent API
// --------------------

app.use(express.json());

app.get("/api/ping", (req, res) => {
  res.send("✅ API is live");
});
let groq;
try {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} catch (error) {
  console.error("❌ Failed to initialize Groq client:", error.message);
  process.exit(1);
}

const platform = os.platform();

// Utility functions
function sanitizePath(filePath) {
  // Prevent directory traversal attacks
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes("..") || path.isAbsolute(normalizedPath)) {
    throw new Error("Invalid file path: directory traversal not allowed");
  }
  return normalizedPath;
}

function generateProjectId() {
  return `website_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function getProjectPath(projectId) {
  return path.join(WEBSITES_DIR, projectId);
}

function isValidCommand(command) {
  // Whitelist of allowed commands
  const allowedCommands = [
    "mkdir",
    "touch",
    "echo",
    "ls",
    "cat",
    "pwd",
    "cp",
    "mv",
    "rm",
    "find",
    "grep",
    "head",
    "tail",
    "wc",
    "sort",
    "uniq",
  ];

  const commandName = command.trim().split(" ")[0];

  // Block dangerous commands
  const blockedCommands = [
    "sudo",
    "su",
    "chmod",
    "chown",
    "passwd",
    "useradd",
    "userdel",
    "systemctl",
    "service",
    "kill",
    "killall",
    "reboot",
    "shutdown",
    "curl",
    "wget",
    "ssh",
    "scp",
    "rsync",
    "dd",
    "format",
    "fdisk",
    "mount",
    "umount",
    "crontab",
    "at",
    "nohup",
    "screen",
    "tmux",
  ];

  if (blockedCommands.includes(commandName)) {
    throw new Error(
      `Command '${commandName}' is not allowed for security reasons`
    );
  }

  return (
    allowedCommands.includes(commandName) || commandName.startsWith("echo")
  );
}

// Enhanced tool functions with project context
let currentProjectId = null;

function ExecuteCommand({ command }) {
  try {
    // Validate command
    if (!isValidCommand(command)) {
      throw new Error(`Command not allowed: ${command.split(" ")[0]}`);
    }

    // Set working directory to current project if exists
    const options = {
      encoding: "utf-8",
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024, // 1MB max buffer
      cwd: currentProjectId ? getProjectPath(currentProjectId) : process.cwd(),
    };

    console.log(`🔧 Executing: ${command}`);
    const output = execSync(command, options);

    return {
      success: true,
      output: output.toString().trim(),
      command: command,
    };
  } catch (error) {
    console.error(`❌ Command failed: ${command}`, error.message);
    return {
      success: false,
      error: error.message,
      command: command,
    };
  }
}

function WriteFile({ path: filePath, content }) {
  try {
    // Use project directory if available
    let fullPath;
    if (currentProjectId) {
      const projectPath = getProjectPath(currentProjectId);
      fullPath = path.join(projectPath, sanitizePath(filePath));
    } else {
      fullPath = sanitizePath(filePath);
    }

    // Validate content size (max 1MB)
    if (content.length > 1024 * 1024) {
      throw new Error("File content too large (max 1MB)");
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file with error handling
    fs.writeFileSync(fullPath, content, "utf-8");

    console.log(`✅ File written: ${fullPath} (${content.length} bytes)`);

    return {
      success: true,
      message: `Successfully written to ${filePath}`,
      path: filePath,
      fullPath: fullPath,
      size: content.length,
    };
  } catch (error) {
    console.error(`❌ Write failed: ${filePath}`, error.message);
    return {
      success: false,
      error: error.message,
      path: filePath,
    };
  }
}

function ReadFile({ path: filePath }) {
  try {
    let fullPath;
    if (currentProjectId) {
      const projectPath = getProjectPath(currentProjectId);
      fullPath = path.join(projectPath, sanitizePath(filePath));
    } else {
      fullPath = sanitizePath(filePath);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    return {
      success: true,
      content: content,
      path: filePath,
      size: content.length,
    };
  } catch (error) {
    console.error(`❌ Read failed: ${filePath}`, error.message);
    return {
      success: false,
      error: error.message,
      path: filePath,
    };
  }
}

function ListDirectory({ path: dirPath = "." }) {
  try {
    let fullPath;
    if (currentProjectId) {
      const projectPath = getProjectPath(currentProjectId);
      fullPath = path.join(projectPath, sanitizePath(dirPath));
    } else {
      fullPath = sanitizePath(dirPath);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    const result = files.map((file) => ({
      name: file.name,
      type: file.isDirectory() ? "directory" : "file",
      path: path.join(dirPath, file.name),
    }));

    return {
      success: true,
      files: result,
      path: dirPath,
      count: result.length,
    };
  } catch (error) {
    console.error(`❌ List failed: ${dirPath}`, error.message);
    return {
      success: false,
      error: error.message,
      path: dirPath,
    };
  }
}

// Enhanced tool definitions
const tools = [
  {
    type: "function",
    function: {
      name: "ExecuteCommand",
      description:
        "Execute safe terminal/shell commands for website building. Supports mkdir, touch, echo, ls, etc.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The terminal command to execute. Example: 'mkdir website', 'touch index.html'",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "WriteFile",
      description:
        "Write content to a file. Perfect for creating HTML, CSS, JS files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path to the file (e.g., 'website/index.html')",
          },
          content: {
            type: "string",
            description: "Complete file content to write",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ReadFile",
      description: "Read content from an existing file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file to read",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ListDirectory",
      description: "List files and directories in a given path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory path to list (defaults to current directory)",
          },
        },
        required: [],
      },
    },
  },
];

// Enhanced system prompt
const systemPrompt = `You are an expert AI website builder that creates complete, professional static websites.

IMPORTANT: All files should be created in the current project directory. Do NOT use absolute paths or create folders outside the project.

CAPABILITIES:
- ExecuteCommand: Run safe terminal commands (mkdir, touch, ls, etc.) - commands run in project directory
- WriteFile: Create complete HTML, CSS, JS files with full content - files saved in project directory
- ReadFile: Read existing files to understand structure
- ListDirectory: Explore project structure

BEST PRACTICES:
1. Always create a clean project structure:
   - Create subdirectories like 'css/', 'js/', 'assets/', 'images/'
   - Keep HTML files in the root (index.html)
   - Organize CSS and JS in their respective folders

2. Write complete, production-ready code:
   - Valid HTML5 with proper DOCTYPE
   - Modern CSS with responsive design
   - Clean, functional JavaScript
   - Proper linking between files

3. File Structure Example:
   index.html (in root)
   css/style.css
   js/script.js
   assets/images/ (if needed)

4. HTML Requirements:
   - Always include proper DOCTYPE, meta tags, title
   - Link CSS: <link rel="stylesheet" href="css/style.css">
   - Link JS: <script src="js/script.js"></script>
   - Make responsive with viewport meta tag
   - Include semantic HTML elements

5. CSS Requirements:
   - Modern CSS with flexbox/grid
   - Responsive design (mobile-first)
   - Smooth transitions and hover effects
   - Professional color schemes

WORKFLOW:
1. Create necessary directories (mkdir css, mkdir js, etc.)
2. Create index.html with complete structure
3. Create comprehensive CSS file
4. Add JavaScript for interactivity (if needed)
5. List final structure

Always provide complete, working code that runs perfectly in a browser.`;

// Enhanced API endpoint with preview functionality
app.post("/api/build", async (req, res) => {
  const startTime = Date.now();

  try {
    const { userPrompt } = req.body;

    // Log the request for debugging
    console.log(`📨 Received request from: ${req.get("origin") || "unknown"}`);
    console.log(`📝 User prompt: "${userPrompt?.substring(0, 100)}..."`);

    // Validation
    if (!userPrompt || typeof userPrompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Valid userPrompt is required",
      });
    }

    if (userPrompt.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Prompt too long (max 2000 characters)",
      });
    }

    // Generate new project ID
    currentProjectId = generateProjectId();
    const projectPath = getProjectPath(currentProjectId);

    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true });

    console.log(
      `🚀 Building website: "${userPrompt.substring(
        0,
        100
      )}..." in project: ${currentProjectId}`
    );

    // Initial AI response
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: "auto",
      temperature: 0.1,
    });

    const toolCalls = response.choices[0]?.message?.tool_calls;
    const executionResults = [];

    if (toolCalls?.length > 0) {
      console.log(`🔧 Executing ${toolCalls.length} tool calls...`);

      for (const toolCall of toolCalls) {
        const { name, arguments: argsJSON } = toolCall.function;

        try {
          const args = JSON.parse(argsJSON);
          let toolResult;

          switch (name) {
            case "ExecuteCommand":
              toolResult = ExecuteCommand(args);
              break;
            case "WriteFile":
              toolResult = WriteFile(args);
              break;
            case "ReadFile":
              toolResult = ReadFile(args);
              break;
            case "ListDirectory":
              toolResult = ListDirectory(args);
              break;
            default:
              toolResult = { success: false, error: `Unknown tool: ${name}` };
          }

          executionResults.push({
            tool: name,
            args: args,
            result: toolResult,
          });

          // Send result back to AI for follow-up
          const followUpResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
              { role: "assistant", content: null, tool_calls: toolCalls },
              {
                role: "tool",
                tool_call_id: toolCall.id,
                name,
                content: JSON.stringify(toolResult),
              },
            ],
            temperature: 0.1,
          });
        } catch (parseError) {
          console.error(`❌ Tool execution error:`, parseError.message);
          executionResults.push({
            tool: name,
            args: null,
            result: { success: false, error: parseError.message },
          });
        }
      }
    }

    const executionTime = Date.now() - startTime;

    // Check if index.html was created
    const indexPath = path.join(projectPath, "index.html");
    const hasIndexFile = fs.existsSync(indexPath);

    // Generate preview URL
    const previewUrl = hasIndexFile
      ? `http://localhost:${PREVIEW_PORT}/${currentProjectId}/`
      : null;

    console.log(`✅ Website build completed in ${executionTime}ms`);
    if (previewUrl) {
      console.log(`🌐 Preview available at: ${previewUrl}`);
    }

    // Set CORS headers explicitly (additional safety)
    res.header("Access-Control-Allow-Origin", req.get("origin") || "*");
    res.header("Access-Control-Allow-Credentials", "true");

    res.json({
      success: true,
      message: response.choices[0].message.content,
      projectId: currentProjectId,
      previewUrl: previewUrl,
      executionResults,
      stats: {
        toolCallsExecuted: toolCalls?.length || 0,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
        hasIndexFile: hasIndexFile,
      },
    });

    // Reset current project
    currentProjectId = null;
  } catch (error) {
    const executionTime = Date.now() - startTime;

    console.error("❌ Build error:", error.message);

    // Set CORS headers for error responses too
    res.header("Access-Control-Allow-Origin", req.get("origin") || "*");
    res.header("Access-Control-Allow-Credentials", "true");

    res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });

    // Reset current project on error
    currentProjectId = null;
  }
});

// API to list all generated websites
app.get("/api/websites", (req, res) => {
  try {
    const websites = [];

    if (fs.existsSync(WEBSITES_DIR)) {
      const projectDirs = fs
        .readdirSync(WEBSITES_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const projectId of projectDirs) {
        const projectPath = path.join(WEBSITES_DIR, projectId);
        const indexPath = path.join(projectPath, "index.html");

        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(projectPath);
          websites.push({
            projectId,
            previewUrl: `http://localhost:${PREVIEW_PORT}/${projectId}/`,
            created: stats.birthtime,
            modified: stats.mtime,
          });
        }
      }
    }

    res.json({
      success: true,
      websites: websites.sort(
        (a, b) => new Date(b.created) - new Date(a.created)
      ),
      count: websites.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: platform,
    nodeVersion: process.version,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    availableEndpoints: ["/api/build", "/health"],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});
process.on("SIGTERM", () => {
  console.log("👋 Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 Shutting down gracefully...");
  process.exit(0);
});

// Start main API server
app.listen(PORT, () => {
  console.log(`
🚀 Enhanced AI Website Builder API is running!
📍 Main API Port: ${PORT}
🌍 Platform: ${platform}
📊 Environment: ${process.env.NODE_ENV || "development"}
🔧 Node.js: ${process.version}

Available endpoints:
📝 POST /api/build - Build websites with AI
📋 GET /api/websites - List all generated websites
❤️  GET /health - Health check

Ready to build amazing websites! 🎨
  `);
});

// --------------------
// 🌐 Server 2: Website Preview
// --------------------
const previewApp = express();

// Serve static files from generated websites
previewApp.use("/", express.static(WEBSITES_DIR));

// Custom directory listing for preview server
previewApp.get("/", (req, res) => {
  try {
    const websites = [];

    if (fs.existsSync(WEBSITES_DIR)) {
      const projectDirs = fs
        .readdirSync(WEBSITES_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const projectId of projectDirs) {
        const projectPath = path.join(WEBSITES_DIR, projectId);
        const indexPath = path.join(projectPath, "index.html");

        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(projectPath);
          websites.push({
            projectId,
            previewUrl: `/${projectId}/`,
            created: stats.birthtime.toLocaleString(),
            modified: stats.mtime.toLocaleString(),
          });
        }
      }
    }

    res.send(`
      <h1>Generated Websites</h1>
      <ul>
        ${websites
          .map(
            (website) => `
          <li>
            <a href="${website.previewUrl}">${website.projectId}</a>
            (Created: ${website.created}, Modified: ${website.modified})
          </li>
        `
          )
          .join("")}
      </ul>
    `);
  } catch (error) {
    console.error("❌ Error listing websites:", error.message);
    res.status(500).send("Error listing websites");
  }
});
// Start preview server
previewApp.listen(PREVIEW_PORT, () => {
  console.log(
    `🌐 Preview server is running at http://localhost:${PREVIEW_PORT}`
  );

  try {
    const websites = [];

    if (fs.existsSync(WEBSITES_DIR)) {
      const projectDirs = fs
        .readdirSync(WEBSITES_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const projectId of projectDirs) {
        const projectPath = path.join(WEBSITES_DIR, projectId);
        const indexPath = path.join(projectPath, "index.html");

        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(projectPath);
          websites.push({
            projectId,
            previewUrl: `http://localhost:${PREVIEW_PORT}/${projectId}/`,
            created: stats.birthtime.toLocaleString(),
            modified: stats.mtime.toLocaleString(),
          });
        }
      }
    }

    console.log("📁 Preview URLs:");
    websites.forEach((site) => {
      console.log(`🔗 ${site.projectId}: ${site.previewUrl}`);
    });
  } catch (error) {
    console.error("❌ Error while logging preview URLs:", error.message);
  }
});
