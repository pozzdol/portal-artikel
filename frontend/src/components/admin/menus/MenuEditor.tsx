'use client';

import * as React from 'react';
import { ListTreeIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { FormActions } from '@/components/admin/FormActions';
import { SortableTree } from '@/components/admin/SortableTree';
import { Button } from '@/components/ui/shadcn/button';
import { useReplaceMenuItems } from '@/lib/api/admin/menus';
import { apiErrorMessage } from '@/lib/forms/serverErrors';
import {
  UNSAVED_MESSAGE,
  useUnsavedChanges,
} from '@/lib/hooks/useUnsavedChanges';
import type { AdminMenu } from '@/lib/api/admin/types';

import { MenuItemDialog } from './MenuItemDialog';
import { MenuItemRow } from './MenuItemRow';
import {
  addChildNode,
  addRootNode,
  emptyNode,
  removeNodeById,
  toClientTree,
  treeSignature,
  treeToInput,
  updateNodeById,
  type MenuNodeData,
  type MenuTreeNode,
} from './tree';

type DialogState =
  | { mode: 'create-root' }
  | { mode: 'create-child'; parentId: string }
  | { mode: 'edit'; node: MenuNodeData };

export type MenuEditorProps = {
  menu: AdminMenu;
  /** 2 = header (one level of children); 1 = footer menus (no nesting). */
  maxDepth: 1 | 2;
  onDirtyChange: (dirty: boolean) => void;
};

/** One menu's editable tree + whole-tree "Simpan" (docs/07 §3.10). Mounted
 * fresh per menu tab (parent keys it by `menu.code`), so local state always
 * starts from that menu's current server tree. */
export function MenuEditor({ menu, maxDepth, onDirtyChange }: MenuEditorProps) {
  const [tree, setTree] = React.useState<MenuTreeNode[]>(() =>
    toClientTree(menu.items),
  );
  const [savedSignature, setSavedSignature] = React.useState(() =>
    treeSignature(tree),
  );
  const [dialogState, setDialogState] = React.useState<DialogState | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = React.useState<MenuNodeData | null>(
    null,
  );

  const replaceItems = useReplaceMenuItems();

  const dirty = treeSignature(tree) !== savedSignature;
  useUnsavedChanges(dirty);
  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function handleSubmitDialog(values: Omit<MenuNodeData, 'id'>) {
    if (!dialogState) return;
    if (dialogState.mode === 'edit') {
      setTree((t) => updateNodeById(t, dialogState.node.id, values));
    } else if (dialogState.mode === 'create-child') {
      setTree((t) =>
        addChildNode(t, dialogState.parentId, { ...emptyNode(), ...values }),
      );
    } else {
      setTree((t) => addRootNode(t, { ...emptyNode(), ...values }));
    }
    setDialogState(null);
  }

  async function handleSave() {
    try {
      const saved = await replaceItems.mutateAsync({
        code: menu.code,
        items: treeToInput(tree),
      });
      const nextTree = toClientTree(saved.items);
      setTree(nextTree);
      setSavedSignature(treeSignature(nextTree));
      toast.success('Menu disimpan.');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function handleReset() {
    if (!dirty || window.confirm(UNSAVED_MESSAGE)) {
      const original = toClientTree(menu.items);
      setTree(original);
      setSavedSignature(treeSignature(original));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {tree.length === 0 ? (
        <EmptyState
          icon={ListTreeIcon}
          title="Belum ada item menu"
          description="Tambahkan item pertama untuk menu ini."
          action={
            <Button
              size="sm"
              onClick={() => setDialogState({ mode: 'create-root' })}
            >
              <PlusIcon /> Tambah item
            </Button>
          }
        />
      ) : (
        <>
          <SortableTree<MenuNodeData>
            items={tree}
            maxDepth={maxDepth}
            onChange={setTree}
            renderItem={(item, ctx) => (
              <MenuItemRow
                node={item}
                handleProps={ctx.handleProps}
                isDragging={ctx.isDragging}
                isOver={ctx.isOver}
                canAddChild={maxDepth > 1 && ctx.depth === 0}
                onToggleActive={(next) =>
                  setTree((t) =>
                    updateNodeById(t, item.id, { is_active: next }),
                  )
                }
                onEdit={() => setDialogState({ mode: 'edit', node: item })}
                onDelete={() => setPendingDelete(item)}
                onAddChild={() =>
                  setDialogState({ mode: 'create-child', parentId: item.id })
                }
              />
            )}
          />
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogState({ mode: 'create-root' })}
            >
              <PlusIcon /> Tambah item
            </Button>
          </div>
        </>
      )}

      <FormActions
        sticky={false}
        className="border-t-0 px-0 py-2 backdrop-blur-none"
      >
        {dirty ? (
          <p className="text-muted-foreground mr-auto text-sm">
            Ada perubahan belum disimpan.
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!dirty}
        >
          Batalkan perubahan
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={replaceItems.isPending}
        >
          Simpan
        </Button>
      </FormActions>

      {dialogState ? (
        <MenuItemDialog
          open
          onOpenChange={(next) => {
            if (!next) setDialogState(null);
          }}
          title={
            dialogState.mode === 'edit'
              ? 'Sunting item menu'
              : 'Tambah item menu'
          }
          initial={dialogState.mode === 'edit' ? dialogState.node : null}
          onSubmit={handleSubmitDialog}
        />
      ) : null}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="Hapus item menu?"
        description={
          pendingDelete
            ? `"${pendingDelete.label || '(tanpa label)'}" akan dihapus dari pohon (termasuk sub-itemnya, bila ada). Perubahan baru tersimpan setelah "Simpan".`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          setTree((t) => removeNodeById(t, pendingDelete.id));
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
