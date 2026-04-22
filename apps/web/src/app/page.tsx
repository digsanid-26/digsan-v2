export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-white">
          Digsan <span className="text-blue-400">V2</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-md mx-auto">
          Platform Keluarga Indonesia — Rebuilt with NestJS + Next.js + Flutter
        </p>
        <div className="flex gap-4 justify-center text-sm">
          <a
            href="/api/docs"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            API Docs
          </a>
          <a
            href="/login"
            className="px-6 py-3 border border-slate-500 text-slate-300 rounded-lg hover:bg-slate-800 transition"
          >
            Login
          </a>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto text-sm text-slate-400">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-2xl mb-1">🌳</div>
            <div>Silsilah</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-2xl mb-1">💼</div>
            <div>Kerja</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-2xl mb-1">💬</div>
            <div>Chat</div>
          </div>
        </div>
      </div>
    </div>
  );
}
