export const LAST_WORKTREE_SOURCE_BRANCH_KEY = 'oc:lastWorktreeSourceBranch';

export interface WorktreeSourceBranchPreferenceArgs {
  branches: readonly string[];
  savedSourceBranch: string | null;
  rootBranch: string | null;
  defaultBranch?: string | null;
}

export interface WorktreeSourceBranchPreferenceResult {
  sourceBranch: string;
  shouldClearSavedSourceBranch: boolean;
}

export interface WorktreeSourceBranchPersistArgs {
  mode: 'new-branch' | 'existing-branch';
  sourceBranch: string;
  linkedPr: boolean;
  selectedBranch: string;
}

export const resolveWorktreeSourceBranchToPersist = ({
  mode,
  sourceBranch,
  linkedPr,
  selectedBranch,
}: WorktreeSourceBranchPersistArgs): string | null => {
  if (mode === 'existing-branch') {
    return selectedBranch || null;
  }

  if (linkedPr) {
    return null;
  }

  return sourceBranch || null;
};

export const resolveWorktreeSourceBranchPreference = ({
  branches,
  savedSourceBranch,
  rootBranch,
  defaultBranch,
}: WorktreeSourceBranchPreferenceArgs): WorktreeSourceBranchPreferenceResult => {
  const savedSourceBranchIsValid = Boolean(savedSourceBranch && branches.includes(savedSourceBranch));

  if (savedSourceBranchIsValid && savedSourceBranch) {
    return {
      sourceBranch: savedSourceBranch,
      shouldClearSavedSourceBranch: false,
    };
  }

  // Prefer the repo's actual configured default branch (e.g. "staging") over
  // whichever branch happens to be checked out in the primary worktree.
  const sourceBranch = defaultBranch && branches.includes(defaultBranch)
    ? defaultBranch
    : rootBranch && branches.includes(rootBranch)
      ? rootBranch
      : branches.includes('main')
        ? 'main'
        : branches.includes('master')
          ? 'master'
          : branches[0] ?? '';

  return {
    sourceBranch,
    shouldClearSavedSourceBranch: Boolean(savedSourceBranch),
  };
};
