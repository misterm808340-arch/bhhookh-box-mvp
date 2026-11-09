"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarClock, Flame, ImagePlus, Loader2, Package, Pencil, Plus, Search, Trash2, Utensils } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/orders";
import {
  deleteProduct,
  discountPercent,
  saveProduct,
  timestampToInputValue,
  toggleProduct,
  uploadProductImage,
  validateProduct,
  type Category,
  type Product,
  type ProductDraft,
} from "@/lib/catalog";

interface ProductsManagerProps {
  categories: Category[];
  products: Product[];
  /** Category id → product count (shown on the filter chips). */
  counts: Map<string, number>;
}

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  description: "",
  categoryId: "",
  categoryName: "",
  price: 0,
  mrp: null,
  offerEnabled: false,
  offerStart: "",
  offerEnd: "",
  stock: null,
  imageUrl: "",
  isVeg: true,
  popular: false,
  available: true,
  sortOrder: 99,
  rating: 4.5,
  prepTime: "15 min",
};

export function ProductsManager({ categories, products, counts }: ProductsManagerProps) {
  const { toast } = useToast();
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Image upload state (Firebase Storage §5)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  /** Auto-calculated % OFF shown live while editing (§5). */
  const draftDiscount = useMemo(() => {
    if (draft.mrp === null || draft.mrp <= draft.price) return null;
    return Math.round(((draft.mrp - draft.price) / draft.mrp) * 100);
  }, [draft.mrp, draft.price]);

  async function handlePickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadPercent(0);
    try {
      const url = await uploadProductImage(file, setUploadPercent);
      setDraft((d) => ({ ...d, imageUrl: url }));
      toast({ title: "Image uploaded", description: "Remember to save the product." });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = filterCategoryId === "all" || product.categoryId === filterCategoryId;
      const matchesQuery =
        query.length === 0 ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [products, filterCategoryId, search]);

  function openAdd(categoryId?: string) {
    const category = categories.find((c) => c.id === categoryId) ?? categories[0];
    setEditing(null);
    setDraft({
      ...EMPTY_DRAFT,
      categoryId: category?.id ?? "",
      categoryName: category?.name ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDraft({
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      price: product.price,
      mrp: product.mrp,
      offerEnabled: product.offerEnabled,
      offerStart: timestampToInputValue(product.offerStart),
      offerEnd: timestampToInputValue(product.offerEnd),
      stock: product.stock,
      imageUrl: product.imageUrl,
      isVeg: product.isVeg,
      popular: product.popular,
      available: product.available,
      sortOrder: product.sortOrder,
      rating: product.rating,
      prepTime: product.prepTime,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const category = categories.find((c) => c.id === draft.categoryId);
    const payload: ProductDraft = {
      ...draft,
      categoryName: category?.name ?? draft.categoryName,
    };
    const validationError = validateProduct(payload);
    if (validationError) {
      toast({ title: "Check the form", description: validationError, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveProduct(editing?.id ?? null, payload);
      toast({
        title: editing ? "Product updated" : "Product added",
        description: payload.name.trim(),
      });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Could not save product",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(product: Product, available: boolean) {
    try {
      await toggleProduct(product.id, available);
    } catch (error) {
      toast({
        title: "Could not update product",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast({ title: "Product deleted", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error) {
      toast({
        title: "Could not delete product",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  const totalProducts = products.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => openAdd()} size="sm" className="bg-brand text-white hover:bg-brand/90">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products…"
            className="h-9 w-48 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Category filter chips with live product counts */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={filterCategoryId === "all"}
          label="All"
          count={totalProducts}
          onClick={() => setFilterCategoryId("all")}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            active={filterCategoryId === category.id}
            label={category.name + (category.enabled ? "" : " ·")}
            count={counts.get(category.id) ?? 0}
            onClick={() => setFilterCategoryId(category.id)}
            muted={!category.enabled}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <Utensils className="h-8 w-8 text-lime-deep mx-auto mb-2" />
          <p className="font-semibold text-brand">
            {totalProducts === 0 ? "No products yet" : "No products match"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {totalProducts === 0
              ? "Add your first product to a category — it appears in the customer app instantly."
              : "Try a different category or clear the search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((product) => {
            const off = discountPercent(product.price, product.mrp);
            return (
              <div
                key={product.id}
                className={`rounded-xl border bg-white p-3.5 flex gap-3 ${
                  product.available ? "" : "opacity-70"
                }`}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-16 w-16 shrink-0 rounded-lg border object-cover bg-[#f5f8f5]"
                  />
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded-lg border border-lime-200 bg-[#f2fce0] flex items-center justify-center text-2xl">
                    {categories.find((c) => c.id === product.categoryId)?.emoji || "🍽️"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-3 w-3 shrink-0 rounded-sm border ${
                        product.isVeg ? "border-green-600" : "border-red-600"
                      } flex items-center justify-center`}
                      title={product.isVeg ? "Veg" : "Non-veg"}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          product.isVeg ? "bg-green-600" : "bg-red-600"
                        }`}
                      />
                    </span>
                    <p className="font-bold text-brand truncate text-sm">{product.name}</p>
                    {product.popular ? <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {product.categoryName || "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-sm font-extrabold text-brand">{formatINR(product.price)}</span>
                    {product.mrp !== null ? (
                      <span className="text-[11px] text-muted-foreground line-through">
                        {formatINR(product.mrp)}
                      </span>
                    ) : null}
                    {off !== null ? (
                      <span className="rounded-full bg-lime-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-deep">
                        {off}% OFF
                      </span>
                    ) : null}
                    {product.offerEnabled ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        <CalendarClock className="h-2.5 w-2.5" /> Offer
                      </span>
                    ) : null}
                    {product.stock !== null ? (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          product.stock === 0
                            ? "bg-red-100 text-red-700"
                            : product.stock <= 5
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Package className="h-2.5 w-2.5" />
                        {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Switch
                        checked={product.available}
                        onCheckedChange={(checked) => void handleToggle(product, checked)}
                        aria-label={`Availability for ${product.name}`}
                      />
                      {product.available ? "Available" : "Unavailable"}
                    </label>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(product)}
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              Saved products stream straight into the customer app.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prod-name">Name</Label>
              <Input
                id="prod-name"
                value={draft.name}
                maxLength={120}
                placeholder="e.g. Veg Burger"
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prod-desc">Description</Label>
              <Textarea
                id="prod-desc"
                value={draft.description}
                maxLength={500}
                rows={2}
                placeholder="Crispy golden patty, fresh lettuce…"
                onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <select
                value={draft.categoryId}
                onChange={(event) => setDraft((d) => ({ ...d, categoryId: event.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Choose a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.enabled ? "" : " (disabled)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="prod-price">Selling price (₹)</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min={1}
                  max={100000}
                  value={draft.price || ""}
                  placeholder="99"
                  onChange={(event) => setDraft((d) => ({ ...d, price: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-mrp">Original price / MRP (₹)</Label>
                <Input
                  id="prod-mrp"
                  type="number"
                  min={0}
                  max={200000}
                  value={draft.mrp ?? ""}
                  placeholder="optional — shows % OFF"
                  onChange={(event) => {
                    const raw = event.target.value;
                    setDraft((d) => ({ ...d, mrp: raw === "" ? null : Number(raw) || 0 }));
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="prod-stock">Stock (optional)</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.stock ?? ""}
                  placeholder="empty = unlimited"
                  onChange={(event) => {
                    const raw = event.target.value;
                    setDraft((d) => ({ ...d, stock: raw === "" ? null : Math.max(0, Math.round(Number(raw) || 0)) }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Auto discount</Label>
                <div className="flex h-9 items-center gap-2">
                  {draftDiscount !== null ? (
                    <span className="rounded-full bg-lime-brand px-2.5 py-1 text-xs font-bold text-brand-deep">
                      {draftDiscount}% OFF · {formatINR(draft.price)} from {formatINR(draft.mrp ?? 0)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Set MRP above the selling price to show a discount
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Offer schedule (§5) */}
            <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <label className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  Scheduled offer (sale window)
                </span>
                <Switch
                  checked={draft.offerEnabled}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, offerEnabled: checked }))}
                  aria-label="Enable scheduled offer"
                />
              </label>
              {draft.offerEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="offer-start" className="text-xs">Offer starts</Label>
                    <Input
                      id="offer-start"
                      type="datetime-local"
                      value={draft.offerStart}
                      onChange={(event) => setDraft((d) => ({ ...d, offerStart: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="offer-end" className="text-xs">Offer ends</Label>
                    <Input
                      id="offer-end"
                      type="datetime-local"
                      value={draft.offerEnd}
                      onChange={(event) => setDraft((d) => ({ ...d, offerEnd: event.target.value }))}
                    />
                  </div>
                  <p className="col-span-2 text-[11px] leading-4 text-amber-700">
                    Inside this window the item sells at the selling price with the discount badge.
                    Outside it, the item reverts to the original price. Leave a field empty for an
                    open-ended boundary.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Product image</Label>
              <div className="flex items-center gap-3">
                {draft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.imageUrl}
                    alt="Product preview"
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                ) : (
                  <span className="h-16 w-16 rounded-lg border border-dashed bg-[#f6f9f6] flex items-center justify-center text-xl">
                    🖼️
                  </span>
                )}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => void handlePickImage(event.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploading ? `Uploading… ${uploadPercent}%` : "Upload image"}
                  </Button>
                  {uploading && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-brand transition-all" style={{ width: `${uploadPercent}%` }} />
                    </div>
                  )}
                </div>
              </div>
              <Input
                id="prod-image"
                value={draft.imageUrl}
                placeholder="…or paste an https:// image URL"
                onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="prod-rating">Rating (0–5)</Label>
                <Input
                  id="prod-rating"
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  value={draft.rating}
                  onChange={(event) => setDraft((d) => ({ ...d, rating: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-prep">Prep time</Label>
                <Input
                  id="prod-prep"
                  value={draft.prepTime}
                  maxLength={24}
                  placeholder="15 min"
                  onChange={(event) => setDraft((d) => ({ ...d, prepTime: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-[#f6f9f6] p-3">
              <label className="flex items-center justify-between text-sm font-medium">
                Veg / Non-veg
                <span className="flex items-center gap-2">
                  <Switch
                    checked={draft.isVeg}
                    onCheckedChange={(checked) => setDraft((d) => ({ ...d, isVeg: checked }))}
                  />
                  <span className={draft.isVeg ? "text-green-700" : "text-red-700"}>
                    {draft.isVeg ? "Veg" : "Non-veg"}
                  </span>
                </span>
              </label>
              <label className="flex items-center justify-between text-sm font-medium">
                Show in “Popular near you”
                <Switch
                  checked={draft.popular}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, popular: checked }))}
                />
              </label>
              <label className="flex items-center justify-between text-sm font-medium">
                Available for ordering
                <Switch
                  checked={draft.available}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, available: checked }))}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-brand text-white hover:bg-brand/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The product disappears from the customer app immediately. Past orders keep their own
              copy of the item details, so order records are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
  muted,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-brand bg-brand text-white"
          : `border-input bg-white text-brand hover:border-brand/50 ${muted ? "opacity-60" : ""}`
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-bold ${
          active ? "bg-white/20" : "bg-[#f2fce0] text-lime-deep"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
