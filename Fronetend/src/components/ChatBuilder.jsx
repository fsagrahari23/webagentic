import React, { useState } from "react";
import axios from "axios";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "framer-motion";

export default function ChatBuilder() {
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState([]);
  const [previews, setPreviews] = useState({});
  const [aiMessage, setAiMessage] = useState("");
  const [projectId, setProjectId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    if (!prompt.trim()) return;

    try {
      setLoading(true);
      setLogs([]);
      setPreviews({});
      setProjectId("");
      setPreviewUrl("");
      setAiMessage("");
      setStats(null);

      const { data } = await axios.post("http://localhost:3000/api/build", {
        userPrompt: prompt,
      });

      setLogs(data.executionResults || []);
      setPreviews(data.previews || {});
      setProjectId(data.projectId);
      setPreviewUrl(data.previewUrl);
      setAiMessage(data.message);
      setStats(data.stats);
    } catch (error) {
      console.error("Build error:", error.message);
      setLogs([{ command: "Error", result: { error: error.message } }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-4xl font-bold mb-6 text-center text-blue-700"
      >
        🚀 AI Website Builder
      </motion.h1>

      <motion.textarea
        rows={4}
        placeholder="Describe the website you want..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full p-4 border border-gray-300 rounded shadow-sm focus:outline-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      />

      <motion.button
        onClick={handleBuild}
        disabled={loading}
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {loading ? "Building..." : "Build Website"}
      </motion.button>

      {aiMessage && (
        <motion.div
          className="mt-6 p-4 bg-green-50 border-l-4 border-green-600 text-green-800 rounded"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <p>{aiMessage}</p>
        </motion.div>
      )}

      {stats && (
        <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
          <p>
            <strong>📦 Project:</strong> {projectId}
          </p>
          <p>
            <strong>📁 Preview URL:</strong>{" "}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener"
              className="text-blue-600 underline"
            >
              {previewUrl}
            </a>
          </p>
          <p>
            <strong>🧰 Commands Executed:</strong> {stats.toolCallsExecuted}
          </p>
          <p>
            <strong>⏱️ Execution Time:</strong> {stats.executionTime}
          </p>
          <p>
            <strong>📅 Timestamp:</strong>{" "}
            {new Date(stats.timestamp).toLocaleString()}
          </p>
          <p>
            <strong>🧾 index.html Exists:</strong>{" "}
            {stats.hasIndexFile ? "✅ Yes" : "❌ No"}
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-semibold mb-4">🔧 Execution Logs</h2>
          <ul className="space-y-4 bg-gray-50 p-4 rounded">
            {logs.map((log, i) => (
              <li key={i} className="border-l-4 border-blue-500 pl-4">
                <p className="font-mono text-blue-700">{log.command}</p>
                <SyntaxHighlighter language="bash" style={oneDark} wrapLines>
                  {log.result.output || log.result.error || "Done"}
                </SyntaxHighlighter>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {Object.keys(previews).length > 0 && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-4">📁 File Previews</h2>
          {Object.entries(previews).map(([filename, content]) => (
            <div key={filename} className="mb-6">
              <h3 className="font-medium text-gray-800 mb-1">{filename}</h3>
              <SyntaxHighlighter
                language={
                  filename.endsWith(".js")
                    ? "javascript"
                    : filename.endsWith(".css")
                    ? "css"
                    : "html"
                }
                style={oneDark}
                showLineNumbers
                wrapLongLines
              >
                {content}
              </SyntaxHighlighter>
            </div>
          ))}
        </motion.div>
      )}

      {previewUrl && (
        <motion.div
          className="mt-10"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-semibold mb-4">🌐 Live Preview</h2>
          <iframe
            src={previewUrl}
            className="w-full h-[600px] border rounded shadow-lg"
            title="Website Preview"
          />
        </motion.div>
      )}
    </div>
  );
}
