import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Download, Upload, Trash2, Edit3, Plus, X, FileDown } from "lucide-react";

const STORAGE_KEY = "journal_entries_v2";

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateId() {
  return "entry_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

function safeConfirm(message) {
  // Some embedded contexts can behave oddly; be explicit
  return window.confirm(message);
}

function downloadJSON(filename, obj) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser a moment to start the download
  setTimeout(() => URL.revokeObjectURL(url), 750);
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const fileInputRef = useRef(null);

  // Load
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const activeEntry = useMemo(
    () => (activeId ? entries.find((e) => e.id === activeId) : null),
    [activeId, entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (!q) return true;
      return (e.content || "").toLowerCase().includes(q);
    });

    filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return filtered;
  }, [entries, searchQuery, sortOrder]);

  const handleNew = () => {
    setActiveId(null);
    setContent("");
  };

  const handleEdit = (entry) => {
    setActiveId(entry.id);
    setContent(entry.content || "");
  };

  const handleSave = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      alert("Entry is empty. Please write something before saving.");
      return;
    }

    const now = new Date().toISOString();

    if (!activeId) {
      const newEntry = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        content: content,
      };
      setEntries((prev) => [...prev, newEntry]);
      setActiveId(newEntry.id);
    } else {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === activeId ? { ...e, content: content, updatedAt: now } : e
        )
      );
    }
  };

  const handleDelete = (id) => {
    if (!safeConfirm("Delete this entry? This cannot be undone.")) return;

    setEntries((prev) => prev.filter((e) => e.id !== id));

    if (activeId === id) {
      handleNew();
    }
  };

  const handleClearAll = () => {
    if (!safeConfirm("Clear ALL entries? This cannot be undone.")) return;
    setEntries([]);
    handleNew();
  };

  // Export all
  const handleExportAll = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
    };
    const filename = `journal-export-${new Date().toISOString().split("T")[0]}.json`;
    downloadJSON(filename, payload);
  };

  // Export a single entry (active or from list)
  const exportEntry = (entry) => {
    if (!entry) return;
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entry,
    };
    const day = (entry.createdAt || new Date().toISOString()).split("T")[0];
    downloadJSON(`journal-entry-${day}.json`, payload);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        // Support both exports: {entries: []} or {entry: {...}}
        let incoming = [];
        if (Array.isArray(data?.entries)) incoming = data.entries;
        else if (data?.entry && typeof data.entry === "object") incoming = [data.entry];
        else {
          alert("Invalid journal export file.");
          return;
        }

        // Merge by id, prefer imported version
        setEntries((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const ent of incoming) {
            if (!ent?.id) ent.id = generateId();
            if (!ent.createdAt) ent.createdAt = new Date().toISOString();
            if (!ent.updatedAt) ent.updatedAt = ent.createdAt;
            if (typeof ent.content !== "string") ent.content = "";
            map.set(ent.id, ent);
          }
          return Array.from(map.values());
        });

        alert(`Import complete. Imported ${incoming.length} entr${incoming.length === 1 ? "y" : "ies"}.`);
      } catch {
        alert("Failed to import file. Please check the file format.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr,0.8fr] gap-4">
        {/* Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h1 className="text-xl font-semibold mb-1">Journal</h1>
          <p className="text-sm text-slate-400 mb-4">
            Write your entry, save progress, and edit later. Entries are stored in this browser.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-xl hover:bg-blue-500/30 transition-colors"
            >
              <Plus size={16} />
              New Entry
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-xl hover:bg-blue-500/30 transition-colors"
            >
              Save
            </button>

            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <X size={16} />
              Cancel
            </button>

            <div className="ml-auto flex gap-2">
              <button
                onClick={handleExportAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
                title="Export all entries"
              >
                <Download size={16} />
                Export
              </button>

              <button
                onClick={() => exportEntry(activeEntry)}
                disabled={!activeEntry}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:hover:bg-slate-800"
                title="Export the currently open entry"
              >
                <FileDown size={16} />
                Export Entry
              </button>

              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
              >
                <Upload size={16} />
                Import
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>

          <div className="h-px bg-slate-800 mb-4"></div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your journal entry..."
            className="w-full h-96 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />

          <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
            <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-full">
              Mode: {activeId ? "Edit" : "New"}
            </div>
            <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-full">
              Created: {formatDate(activeEntry?.createdAt)}
            </div>
            <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-full">
              Updated: {formatDate(activeEntry?.updatedAt)}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Tip: Save updates the current entry. New Entry starts a fresh one.
          </p>
        </div>

        {/* List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-xl font-semibold mb-4">Entries</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>

            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-xl hover:bg-red-500/30 transition-colors"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredEntries.length === 0 ? (
              <div className="text-slate-500 text-sm py-8 text-center">
                {searchQuery ? "No entries match your search." : "No entries yet. Write one and click Save."}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const lines = (entry.content || "").split("\n");
                const title = lines.find((l) => l.trim())?.slice(0, 60) || "Journal Entry";
                const preview = (entry.content || "").slice(0, 180);

                return (
                  <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-baseline gap-2 mb-2">
                      <div className="font-semibold text-sm truncate">{title}</div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </div>
                    </div>

                    <div className="text-sm text-slate-300 mb-3">
                      {preview || "(No preview)"}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>

                      <button
                        onClick={() => exportEntry(entry)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded-lg hover:bg-slate-900 transition-colors text-sm"
                        title="Export this entry"
                      >
                        <Download size={14} />
                        Export
                      </button>

                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Entries are stored locally in your browser. Use Export/Import for backups.
          </p>
        </div>
      </div>
    </div>
  );
}
