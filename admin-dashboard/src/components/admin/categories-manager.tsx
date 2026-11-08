"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, ShieldQuestion, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  CATEGORY_ICONS,
  deleteCategory,
  reassignProducts,
  saveCategory,
  seedStandardCategories,
  toggleCategory,
  validateCategory,
  type Category,
  type CategoryDraft,
} from "@/lib/catalog";

interface CategoriesManagerProps {
  categories: Category[];
  /** Category id → number of products assigned (drives delete protection). */
  counts: Map<string, number>;
}

const EMPTY_DRAFT: CategoryDraft = {
  name: "",
  icon: "restaurant-outline",
  emoji: "",
  imageUrl: "",
  sortOrder: 99,
  enabled: true,
};

export function CategoriesManager({ categories, counts }: CategoriesManagerProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const STANDARD_IDS = ["burgers", "pizza", "biryani", "chinese", "rolls", "drinks", "snacks", "desserts", "fruits"];
  const missingStandard = 9 - categories.filter((category) => STANDARD_IDS.includes(category.id)).length;

  function openAdd() {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, sortOrder: nextSortOrder(categories) });
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDraft({
      name: category.name,
      icon: category.icon,
      emoji: category.emoji,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      enabled: category.enabled,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const validationError = validateCategory(draft);
    if (validationError) {
      toast({ title: "Check the form", description: validationError, variant: "destructive" });
      return;
    }
    // Duplicate-name guard (Firestore rules cannot enforce uniqueness).
    const name = draft.name.trim().toLowerCase();
    const duplicate = categories.some(
      (category) => category.name.toLowerCase() === name && category.id !== editing?.id
    );
    if (duplicate) {
      toast({
        title: "Duplicate category",
        description: `A category named "${draft.name.trim()}" already exists.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await saveCategory(editing?.id ?? null, editing ? draft : { ...draft, idHint: slugify(draft.name) });
      toast({
        title: editing ? "Category updated" : "Category added",
        description: draft.name.trim(),
      });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Could not save category",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const created = await seedStandardCategories(categories);
      toast({
        title: created.length > 0 ? `${created.length} categories added` : "All up to date",
        description: created.length > 0 ? created.join(", ") : "The 9 standard categories already exist.",
      });
    } catch (error) {
      toast({
        title: "Could not add categories",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  }

  async function handleToggle(category: Category, enabled: boolean) {
    try {
      await toggleCategory(category.id, enabled);
    } catch (error) {
      toast({
        title: "Could not update category",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const productCount = deleteTarget ? (counts.get(deleteTarget.id) ?? 0) : 0;
  const otherCategories = deleteTarget
    ? categories.filter((category) => category.id !== deleteTarget.id)
    : [];
  const canDelete = deleteTarget !== null && (productCount === 0 || reassignTo !== "");

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (productCount > 0) {
        const target = otherCategories.find((category) => category.id === reassignTo);
        if (!target) throw new Error("Pick a category to move the products to first.");
        const moved = await reassignProducts(deleteTarget.id, target.id, target.name);
        await deleteCategory(deleteTarget.id);
        toast({
          title: "Category deleted",
          description: `${moved} product${moved === 1 ? "" : "s"} moved to ${target.name}.`,
        });
      } else {
        await deleteCategory(deleteTarget.id);
        toast({ title: "Category deleted", description: deleteTarget.name });
      }
      setDeleteTarget(null);
      setReassignTo("");
    } catch (error) {
      toast({
        title: "Could not delete category",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openAdd} size="sm" className="bg-brand text-white hover:bg-brand/90">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
        <Button onClick={handleSeed} size="sm" variant="outline" disabled={seeding || missingStandard === 0}
          title={missingStandard === 0 ? "All 9 standard categories exist" : undefined}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {missingStandard > 0 ? `Add the ${missingStandard} missing standard categories` : "9 standard categories ✓"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
          {categories.filter((c) => c.enabled).length} enabled
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <ShieldQuestion className="h-8 w-8 text-lime-deep mx-auto mb-2" />
          <p className="font-semibold text-brand">No categories yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add the 9 standard categories above, then create products under them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((category) => {
            const count = counts.get(category.id) ?? 0;
            return (
              <div
                key={category.id}
                className={`rounded-xl border bg-white p-4 flex flex-col gap-3 ${
                  category.enabled ? "" : "opacity-70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 shrink-0 rounded-xl bg-[#f2fce0] border border-lime-200 items-center justify-center flex text-xl">
                    {category.emoji || "🍽️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-brand truncate">{category.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {category.icon}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      count > 0
                        ? "bg-lime-brand text-brand-deep"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count} product{count === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Switch
                      checked={category.enabled}
                      onCheckedChange={(checked) => void handleToggle(category, checked)}
                      aria-label={`Enable ${category.name}`}
                    />
                    {category.enabled ? "Enabled" : "Disabled"}
                  </label>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setDeleteTarget(category);
                        setReassignTo("");
                      }}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              Categories group your menu. Customers only see enabled categories.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={draft.name}
                maxLength={40}
                placeholder="e.g. Burgers"
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Icon (shown in the customer app)</Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, icon }))}
                    className={`rounded-lg border px-1 py-1.5 text-[9.5px] leading-tight font-mono truncate transition-colors ${
                      draft.icon === icon
                        ? "border-brand bg-[#f2fce0] text-brand font-bold"
                        : "border-input text-muted-foreground hover:border-brand/50"
                    }`}
                    title={icon}
                  >
                    {icon.replace("-outline", "")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cat-emoji">Emoji (optional)</Label>
                <Input
                  id="cat-emoji"
                  value={draft.emoji}
                  maxLength={8}
                  placeholder="🍔"
                  onChange={(event) => setDraft((d) => ({ ...d, emoji: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  min={0}
                  max={9999}
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, sortOrder: Number(event.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-image">Image URL (optional, overrides icon)</Label>
              <Input
                id="cat-image"
                value={draft.imageUrl}
                placeholder="https://…"
                onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, enabled: checked }))}
              />
              Enabled (visible to customers)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-brand text-white hover:bg-brand/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog (with reassignment when products are assigned) */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {productCount === 0 ? (
                  <span>This category has no products. Deleting it cannot be undone.</span>
                ) : (
                  <>
                    <span className="block font-semibold text-red-600">
                      {productCount} product{productCount === 1 ? " is" : "s are"} still assigned to
                      this category.
                    </span>
                    <span className="block">
                      Move them to another category first — the products will be reassigned, then the
                      category is deleted.
                    </span>
                    {otherCategories.length === 0 ? (
                      <span className="block text-red-600 font-semibold">
                        Create another category first — there is nowhere to move these products.
                      </span>
                    ) : (
                      <select
                        value={reassignTo}
                        onChange={(event) => setReassignTo(event.target.value)}
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Move products to…</option>
                        {otherCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {productCount > 0 ? "Reassign & delete" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function nextSortOrder(categories: Category[]): number {
  return categories.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `cat-${Date.now().toString(36)}`
  );
}
