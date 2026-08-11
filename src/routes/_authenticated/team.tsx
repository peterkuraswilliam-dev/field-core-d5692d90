import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, MoreVertical, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, Button, Field } from "@/components/auth-ui";
import {
  allowedRolesFor,
  canManage,
  roleLabel,
  type Membership,
  type Workspace,
  type WorkspaceRole,
} from "@/lib/workspace";
import {
  cancelInvitation,
  changeMemberRole,
  fetchInvitations,
  fetchTeamMembers,
  humanAction,
  inviteLink,
  inviteMember,
  resendInvitation,
  setMemberStatus,
  type Invitation,
  type TeamMember,
  type MembershipStatus,
} from "@/lib/team";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/team")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team — Contractor OS" },
      { name: "description", content: "Manage your workspace members and invitations." },
    ],
  }),
  component: TeamPage,
});

const ROLE_FILTERS: (WorkspaceRole | "all")[] = [
  "all",
  "owner",
  "admin",
  "project_manager",
  "field_worker",
  "contractor",
  "viewer",
];

function TeamPage() {
  const ctx = Route.useRouteContext() as {
    user: { id: string };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const actorRole = membership.role as WorkspaceRole;
  const canInvite = actorRole === "owner" || actorRole === "admin";

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manage, setManage] = useState<TeamMember | null>(null);

  const load = async () => {
    const [m, i] = await Promise.all([
      fetchTeamMembers(workspace.id),
      canInvite ? fetchInvitations(workspace.id) : Promise.resolve([]),
    ]);
    setMembers(m);
    setInvitations(i);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load team"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [members, query, roleFilter]);

  const pendingInvites = (invitations ?? []).filter((i) => i.status === "pending");

  return (
    <div className="relative min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-md px-5 pt-6">
        <header className="flex items-center justify-between">
          <Link
            to="/control-centre"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          {canInvite && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-sm font-semibold text-gold-foreground"
            >
              <UserPlus size={16} /> Invite
            </button>
          )}
        </header>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Team</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        </div>

        <div className="mt-5 space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-border bg-input py-3 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  roleFilter === r
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "all" ? "All" : roleLabel(r)}
              </button>
            ))}
          </div>
        </div>

        {canInvite && pendingInvites.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Pending invitations ({pendingInvites.length})
            </h2>
            <ul className="space-y-2">
              {pendingInvites.map((inv) => (
                <InvitationRow key={inv.id} inv={inv} onChanged={load} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Members {members ? `(${members.length})` : ""}
          </h2>
          {members === null && <div className="text-sm text-muted-foreground">Loading team…</div>}
          {members && filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              No members match your filters.
            </div>
          )}
          <ul className="space-y-2">
            {filtered.map((m) => (
              <MemberRow
                key={m.id}
                m={m}
                canManage={
                  m.user_id !== user.id && m.role !== "owner" && canManage(actorRole, m.role)
                }
                onManage={() => setManage(m)}
              />
            ))}
          </ul>
        </section>
      </div>

      {inviteOpen && (
        <InviteModal
          workspaceId={workspace.id}
          actorRole={actorRole}
          onClose={() => setInviteOpen(false)}
          onInvited={load}
        />
      )}
      {manage && (
        <ManageMemberModal
          member={manage}
          actorRole={actorRole}
          onClose={() => setManage(null)}
          onChanged={() => {
            setManage(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function initials(source: string) {
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function StatusPill({ status }: { status: MembershipStatus | "pending" }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    suspended: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    removed: "bg-destructive/15 text-destructive border-destructive/30",
    pending: "bg-gold/15 text-gold border-gold/30",
  };
  const label = status === "pending" ? "Pending" : status[0].toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status]}`}
    >
      {label}
    </span>
  );
}

function MemberRow({
  m,
  canManage,
  onManage,
}: {
  m: TeamMember;
  canManage: boolean;
  onManage: () => void;
}) {
  const name = m.full_name?.trim() || m.email?.split("@")[0] || "Member";
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      {m.avatar_url ? (
        <img
          src={m.avatar_url}
          alt={name}
          className="h-11 w-11 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-sm font-semibold text-gold-foreground">
          {initials(name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold text-foreground">{name}</div>
          <StatusPill status={m.status} />
        </div>
        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {roleLabel(m.role)} · Joined {new Date(m.joined_at).toLocaleDateString()}
        </div>
      </div>
      {canManage && (
        <button
          onClick={onManage}
          className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Manage member"
        >
          <MoreVertical size={18} />
        </button>
      )}
    </li>
  );
}

function InvitationRow({ inv, onChanged }: { inv: Invitation; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const resend = async () => {
    setBusy("resend");
    try {
      const token = await resendInvitation(inv.id);
      await navigator.clipboard.writeText(inviteLink(token)).catch(() => undefined);
      toast.success("Invitation resent — link copied");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend");
    } finally {
      setBusy(null);
    }
  };
  const cancel = async () => {
    setBusy("cancel");
    try {
      await cancelInvitation(inv.id);
      toast.success("Invitation cancelled");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusy(null);
    }
  };
  return (
    <li className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-foreground">{inv.email}</div>
            <StatusPill status="pending" />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {roleLabel(inv.role)} · Expires {new Date(inv.expires_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={resend}
          disabled={busy !== null}
          className="flex-1 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-60"
        >
          {busy === "resend" ? "Resending…" : "Resend link"}
        </button>
        <button
          onClick={cancel}
          disabled={busy !== null}
          className="flex-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-60"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </li>
  );
}

function InviteModal({
  workspaceId,
  actorRole,
  onClose,
  onInvited,
}: {
  workspaceId: string;
  actorRole: WorkspaceRole;
  onClose: () => void;
  onInvited: () => void;
}) {
  const roles = allowedRolesFor(actorRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>(roles[0] ?? "viewer");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setErr("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const { token } = await inviteMember({ workspaceId, email: clean, role, message });
      const link = inviteLink(token);
      setIssuedLink(link);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Invitation created — link copied");
      onInvited();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Invite team member">
      {issuedLink ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this single-use invitation link with your teammate. It expires in 14 days.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-input p-2">
            <input
              readOnly
              value={issuedLink}
              className="flex-1 truncate bg-transparent px-2 text-xs text-foreground outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(issuedLink);
                toast.success("Copied");
              }}
              className="rounded-lg border border-border bg-surface-elevated p-2 text-muted-foreground hover:text-foreground"
              aria-label="Copy link"
            >
              <Copy size={16} />
            </button>
          </div>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Email address"
            name="invite_email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">
              Personal message <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={400}
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
          </div>
          {err && <div className="text-xs text-destructive">{err}</div>}
          <Button type="submit" loading={loading}>
            Send invitation
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ManageMemberModal({
  member,
  actorRole,
  onClose,
  onChanged,
}: {
  member: TeamMember;
  actorRole: WorkspaceRole;
  onClose: () => void;
  onChanged: () => void;
}) {
  const roles = allowedRolesFor(actorRole);
  const [role, setRole] = useState<WorkspaceRole>(member.role);
  const [busy, setBusy] = useState<string | null>(null);

  const changeRole = async () => {
    if (role === member.role) return onClose();
    setBusy("role");
    try {
      await changeMemberRole(member.id, role);
      toast.success("Role updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
      setBusy(null);
    }
  };

  const doStatus = async (status: MembershipStatus, label: string) => {
    setBusy(status);
    try {
      await setMemberStatus(member.id, status);
      toast.success(`${label}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${label.toLowerCase()}`);
      setBusy(null);
    }
  };

  const name = member.full_name?.trim() || member.email || "Member";

  return (
    <Modal onClose={onClose} title="Manage member">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-elevated p-3">
          <div className="text-sm font-semibold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{member.email}</div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/90">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <Button className="mt-3" onClick={changeRole} loading={busy === "role"}>
            Save role
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Status</div>
          <div className="grid grid-cols-1 gap-2">
            {member.status !== "active" && (
              <button
                onClick={() => doStatus("active", "Member reactivated")}
                disabled={busy !== null}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 disabled:opacity-60"
              >
                Reactivate
              </button>
            )}
            {member.status !== "suspended" && member.status !== "removed" && (
              <button
                onClick={() => doStatus("suspended", "Member suspended")}
                disabled={busy !== null}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-400 disabled:opacity-60"
              >
                Suspend
              </button>
            )}
            {member.status !== "removed" && (
              <button
                onClick={() => doStatus("removed", "Member removed")}
                disabled={busy !== null}
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive disabled:opacity-60"
              >
                Remove from workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Keep imports used
void supabase;
void humanAction;
