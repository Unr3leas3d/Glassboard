# Glassboard

**The Invisible Communication Layer for Live Presentations**

Glassboard is a real-time, transparent communication layer designed specifically for live presentations. It allows managers and team leads to seamlessly guide junior staff during critical live presentations or software demos without interrupting the flow or being visible to the audience.

## 🚀 The Magic: The Invisible Layer
Built using native OS-level protections, the Glassboard overlay is completely invisible to screen-sharing software (like Zoom, Teams, or Google Meet). The audience sees a clean, professional presentation, while the presenter sees real-time guidance seamlessly overlaid on their screen.

## ✨ Key Features
* **Transparent Overlay**: A click-through, frameless window that sits on top of the presenter's screen.
* **Laser Pointer Mode**: Instantly activate a red laser pointer (`Cmd+Shift+G`) to silently guide the presenter's attention to exact buttons or charts.
* **Real-time Annotations**: Draw arrows, circle key information, or drop text notes on the screen using low-latency Excalidraw integration and Supabase real-time channels.
* **WhisperFlow Interface**: A minimal, unobtrusive pill-bar UI for the presenter that avoids distracting clunky toolbars.
* **Multi-Window Architecture**: The management dashboard is separated from the transparent overlay, ensuring no administrative UI ever accidentally bleeds onto the shared screen.

## 🛠 Tech Stack
* **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust)
* **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
* **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
* **Backend & Real-time**: [Supabase](https://supabase.com/) (Auth, Postgres, Realtime Channels)
* **Canvas Engine**: [Excalidraw](https://excalidraw.com/)

## 💻 Getting Started

### Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Rust](https://www.rust-lang.org/tools/install)
* Tauri Prerequisites for your OS (see [Tauri Docs](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation
1. Clone the repository and navigate into the project directory.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables (create a `.env` file based on Supabase requirements).

### Running in Development
Start the application in development mode:
```bash
npm run tauri dev
```

### Building for Production
To build the application for your current operating system:
```bash
npm run build
```

## 📝 License
This project is private and confidential.
