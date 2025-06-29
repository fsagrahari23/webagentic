# 🚀 AI Terminal-Based Website Builder

This is a full-stack AI-powered terminal website builder. You describe what kind of website you want, and the AI generates and executes real shell commands to create HTML, CSS, and JS files, storing them in a structured directory. You can preview the site instantly.

---

## 📦 Features

- 🤖 Uses Groq's LLaMA-3 model to understand prompts
- 🛠 Executes real shell/terminal commands via tools
- 🗂 Creates actual folders and files on the local system
- 🔧 AI writes code into those files using terminal commands
- 🌐 Includes a preview server to view generated websites
- 🧑‍💻 Frontend built in React with live logs and file preview

---

## 🖼 Demo Preview

![AI Website Builder Preview](preview.gif)  
> Prompt: _“Create a landing page for an online fruit shop”_

---

## 🧰 Technologies

- Backend: **Node.js**, **Express.js**
- Frontend: **React**, **Tailwind CSS**, **axios**
- AI Model: **Groq LLaMA-3.3 70B Versatile**
- Terminal execution: **child_process**
- Syntax highlighting: **react-syntax-highlighter**

---

## 🗃 Directory Structure

/root
├── index.js # Main backend (Express + AI logic)
├── /websites # All AI-generated website folders stored here
├── /client # React frontend
└── /preview # Express server to serve website previews



---

## 🔧 Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/yourusername/ai-website-builder
cd ai-website-builder
npm install
2. Set Environment Variables
Create a .env file:

env
Copy code
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
PREVIEW_PORT=5000
3. Start the Servers
bash
Copy code
# Start backend + preview server
node index.js

# (In another terminal) Start frontend
cd client
npm install
npm run dev
💻 How It Works
Enter a prompt like:

"Build a personal portfolio website with HTML, CSS, and JS"

The AI breaks it into terminal commands:

mkdir portfolio

touch portfolio/index.html

echo "<!DOCTYPE html>..." > portfolio/index.html

etc.

Those commands are executed using Node.js and child_process.

Generated files are saved locally and previewed via a second Express server.

📂 Generated Project Example

/websites/website_1699999999999
  ├── index.html
  ├── style.css
  └── script.js
View in browser:


http://localhost:5000/website_1699999999999/
⚠️ Limitations
Requires Node.js environment with file system access (not serverless)

Rate-limited by Groq’s API usage (100K tokens/day in free tier)

Doesn't persist in cloud (for that, see MongoDB version)

🙋 FAQ
Q: Can I use this on Vercel or Render?

❌ Not in its current form, since it writes to local disk. You need a persistent DB or object store.

Q: What if the AI fails to generate correct commands?

You can view the execution logs on the frontend and retry or refine your prompt.

📄 License
MIT

✨ Credits
Groq API

Built with ❤️ by CodeWithMonu




