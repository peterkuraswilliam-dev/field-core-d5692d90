import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/auth-ui";
import { initials } from "@/components/project-ui";
import {
  createNote,
  deleteNote,
  fetchProjectNotes,
  updateNote,
  type NoteWithAuthor,
} from "@/lib/notes";
import type { WorkspaceRole } from "@/lib/workspace";

interface Props {
  projectId: string;
  currentUserId: string;
  role: WorkspaceRole;
  canManage: boolean;
}

export function NotesTab({ projectId, currentUserId, role, canManage }: Props) {
  const [notes, setNotes] = useState<NoteWithAuthor[] | null>(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const canPost = role !== "viewer";

  const load = () =>
    fetchProjectNotes(projectId)
      .then(setNotes)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load notes"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const post = async () => {
    if (content.trim().length < 1) return;
    setPosting(true);
    try {
      await createNote(projectId, content, currentUserId);
      setContent("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canPost && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Add a note for the team…"
            className="w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={post}
              loading={posting}
              disabled={!content.trim()}
              className="w-auto px-5"
            >
              Post note
            </Button>
          </div>
        </div>
      )}

      {notes === null && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading notes…
        </div>
      )}
      {notes !== null && notes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
          No notes yet.
        </div>
      )}

      <ul className="space-y-3">
        {(notes ?? []).map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            currentUserId={currentUserId}
            canManage={canManage}
            onChanged={load}
          />
        ))}
      </ul>
    </div>
  );
}

function NoteCard({
  note,
  currentUserId,
  canManage,
  onChanged,
}: {
  note: NoteWithAuthor;
  currentUserId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [busy, setBusy] = useState(false);
  const isAuthor = note.created_by === currentUserId;
  const canEdit = isAuthor || canManage;

  const save = async () => {
    if (content.trim().length < 1) return;
    setBusy(true);
    try {
      await updateNote(note.id, content);
      setEditing(false);
      onChanged();
      toast.success("Note updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote(note.id);
      onChanged();
      toast.success("Note deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {note.author_avatar ? (
          <img
            src={note.author_avatar}
            alt={note.author_name ?? "Member"}
            className="h-9 w-9 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-xs font-semibold text-gold-foreground">
            {initials(note.author_name ?? "Member")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {note.author_name ?? "Member"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(note.created_at).toLocaleString()}
              {note.edited && " · edited"}
            </span>
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground disabled:opacity-60"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />} Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setContent(note.content);
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{note.content}</p>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              aria-label="Edit note"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={remove}
              className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-destructive"
              aria-label="Delete note"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
