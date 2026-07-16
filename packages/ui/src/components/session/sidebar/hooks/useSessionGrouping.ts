import React from 'react';
import type { Session } from '@opencode-ai/sdk/v2';
import type { WorktreeMetadata } from '@/types/worktree';
import type { SessionGroup, SessionNode } from '../types';
import {
  compareSessionsByPinnedAndTime,
  dedupeSessionsById,
  getArchivedScopeKey,
  normalizePath,
} from '../utils';
import { formatPathForDisplay } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { resolveGlobalSessionDirectory } from '@/stores/useGlobalSessionsStore';

type Args = {
  homeDirectory: string | null;
  worktreeMetadata: Map<string, WorktreeMetadata>;
  pinnedSessionIds: Set<string>;
  isVSCode: boolean;
};

const isArchivedSession = (session: Session): boolean => Boolean(session.time?.archived);

export const useSessionGrouping = (args: Args) => {
  const { t } = useI18n();
  const buildGroupSearchText = React.useCallback((group: SessionGroup): string => {
    return [group.label, group.branch ?? '', group.description ?? '', group.directory ?? ''].join(' ').toLowerCase();
  }, []);

  const buildSessionSearchText = React.useCallback((session: Session): string => {
    const sessionDirectory = normalizePath((session as Session & { directory?: string | null }).directory ?? null) ?? '';
    const sessionTitle = (session.title || t('sessions.sidebar.session.untitled')).trim();
    return `${sessionTitle} ${sessionDirectory}`.toLowerCase();
  }, [t]);

  const filterSessionNodesForSearch = React.useCallback(
    (nodes: SessionNode[], query: string): SessionNode[] => {
      if (!query) {
        return nodes;
      }

      return nodes.flatMap((node) => {
        const nodeMatches = buildSessionSearchText(node.session).includes(query);
        if (nodeMatches) {
          return [node];
        }

        const filteredChildren = filterSessionNodesForSearch(node.children, query);
        if (filteredChildren.length === 0) {
          return [];
        }

        return [{ ...node, children: filteredChildren }];
      });
    },
    [buildSessionSearchText],
  );

  const buildGroupedSessions = React.useCallback(
    (
      projectSessions: Session[],
      projectRoot: string | null,
      availableWorktrees: WorktreeMetadata[],
      projectRootBranch: string | null,
      projectIsRepo: boolean,
    ) => {
      const normalizedProjectRoot = normalizePath(projectRoot ?? null);
      const sortedProjectSessions = dedupeSessionsById(projectSessions)
        .sort((a, b) => compareSessionsByPinnedAndTime(a, b, args.pinnedSessionIds));

      const sessionMap = new Map(sortedProjectSessions.map((session) => [session.id, session]));
      const childrenMap = new Map<string, Session[]>();
      sortedProjectSessions.forEach((session) => {
        const parentID = (session as Session & { parentID?: string | null }).parentID;
        if (!parentID) return;
        const parentSession = sessionMap.get(parentID);
        if (!parentSession || isArchivedSession(parentSession) !== isArchivedSession(session)) {
          return;
        }
        const collection = childrenMap.get(parentID) ?? [];
        collection.push(session);
        childrenMap.set(parentID, collection);
      });
      childrenMap.forEach((list) => list.sort((a, b) => compareSessionsByPinnedAndTime(a, b, args.pinnedSessionIds)));

      const worktreeByPath = new Map<string, WorktreeMetadata>();
      availableWorktrees.forEach((meta) => {
        if (meta.path) {
          const normalized = normalizePath(meta.path) ?? meta.path;
          worktreeByPath.set(normalized, meta);
        }
      });

      const getSessionWorktree = (session: Session): WorktreeMetadata | null => {
        const sessionDirectory = normalizePath((session as Session & { directory?: string | null }).directory ?? null);
        const sessionWorktreeMeta = args.worktreeMetadata.get(session.id) ?? null;
        if (sessionWorktreeMeta) return sessionWorktreeMeta;
        if (sessionDirectory) {
          const worktree = worktreeByPath.get(sessionDirectory) ?? null;
          if (worktree && sessionDirectory !== normalizedProjectRoot) {
            return worktree;
          }
        }
        return null;
      };

      const buildProjectNode = (session: Session): SessionNode => {
        const children = childrenMap.get(session.id) ?? [];
        return { session, children: children.map((child) => buildProjectNode(child)), worktree: getSessionWorktree(session) };
      };

      const roots = sortedProjectSessions.filter((session) => {
        const parentID = (session as Session & { parentID?: string | null }).parentID;
        if (!parentID) return true;
        const parentSession = sessionMap.get(parentID);
        if (!parentSession) return true;
        return isArchivedSession(parentSession) !== isArchivedSession(session);
      });

      const groupedNodes = new Map<string, SessionNode[]>();
      const archivedKey = '__archived__';

      const rootGroupKey = normalizedProjectRoot ?? '__project_root__';

      // Sessions are grouped by project, not by worktree: every non-archived
      // session (whether it lives in the project root or one of its worktrees)
      // belongs to that project's single flat group. Worktree/branch info is
      // still attached per-node (see buildProjectNode below) and surfaces once
      // a session's chat is opened, but the sidebar list itself stays flat.
      const getGroupKey = (session: Session) => {
        if (session.time?.archived) return archivedKey;
        if (args.isVSCode) return rootGroupKey;
        const metadataPath = normalizePath(args.worktreeMetadata.get(session.id)?.path ?? null);
        const normalizedDir = metadataPath ?? resolveGlobalSessionDirectory(session);
        if (!normalizedDir) return archivedKey;
        if (normalizedDir === normalizedProjectRoot) return rootGroupKey;
        if (worktreeByPath.has(normalizedDir)) return rootGroupKey;
        return archivedKey;
      };

      roots.forEach((session) => {
        const node = buildProjectNode(session);
        const groupKey = getGroupKey(session);
        if (!groupedNodes.has(groupKey)) groupedNodes.set(groupKey, []);
        groupedNodes.get(groupKey)?.push(node);
      });

      const groups: SessionGroup[] = [{
        id: 'root',
        label: (projectIsRepo && projectRootBranch && projectRootBranch !== 'HEAD')
          ? t('sessions.sidebar.grouping.projectRootWithBranch', { branch: projectRootBranch })
          : t('sessions.sidebar.grouping.projectRoot'),
        branch: projectRootBranch ?? null,
        description: normalizedProjectRoot ? formatPathForDisplay(normalizedProjectRoot, args.homeDirectory) : null,
        isMain: true,
        isArchivedBucket: false,
        worktree: null,
        directory: normalizedProjectRoot,
        folderScopeKey: normalizedProjectRoot,
        sessions: groupedNodes.get(rootGroupKey) ?? [],
      }];

      const archivedSessions = groupedNodes.get(archivedKey) ?? [];
      if (archivedSessions.length > 0) {
        groups.push({
          id: 'archived',
          label: t('sessions.sidebar.grouping.archived'),
          branch: null,
          description: t('sessions.sidebar.grouping.archivedDescription'),
          isMain: false,
          isArchivedBucket: true,
          worktree: null,
          directory: null,
          folderScopeKey: !args.isVSCode && normalizedProjectRoot ? getArchivedScopeKey(normalizedProjectRoot) : null,
          sessions: archivedSessions,
        });
      }

      return groups;
    },
    [args.homeDirectory, args.worktreeMetadata, args.pinnedSessionIds, args.isVSCode, t],
  );

  return {
    buildGroupSearchText,
    buildSessionSearchText,
    filterSessionNodesForSearch,
    buildGroupedSessions,
  };
};
