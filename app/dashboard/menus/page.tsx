'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Pencil, Plus, Trash2, Check, X,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Store { id: string; name: string; category: string | null; }
interface Category {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
}
interface MenuItem {
  id: string;
  category_id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

/* ------------------------------------------------------------------ */
/* SortableItem                                                         */
/* ------------------------------------------------------------------ */

function SortableMenuItem({
  item,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, val: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-border-main group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted hover:text-primary cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical size={14} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${item.is_active ? 'text-primary' : 'text-muted line-through'}`}>
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-muted truncate">{item.description}</p>
        )}
      </div>

      {item.price != null && (
        <span className="text-xs text-muted shrink-0">
          {item.price.toLocaleString()}원
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onToggle(item.id, !item.is_active)}
          className="p-1 rounded hover:bg-card text-muted hover:text-primary transition"
          title={item.is_active ? '비활성화' : '활성화'}
        >
          {item.is_active
            ? <ToggleRight size={14} className="text-green-500" />
            : <ToggleLeft size={14} />}
        </button>
        <button
          onClick={() => onEdit(item)}
          className="p-1 rounded hover:bg-card text-muted hover:text-primary transition"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded hover:bg-card text-muted hover:text-red-400 transition"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CategoryBlock                                                        */
/* ------------------------------------------------------------------ */

function CategoryBlock({
  category,
  onRename,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onToggleItem,
  onItemsReorder,
}: {
  category: Category;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (categoryId: string) => void;
  onEditItem: (item: MenuItem) => void;
  onDeleteItem: (id: string, categoryId: string) => void;
  onToggleItem: (id: string, categoryId: string, val: boolean) => void;
  onItemsReorder: (categoryId: string, items: MenuItem[]) => void;
}) {
  const [editing, setEditing]     = useState(false);
  const [nameVal, setNameVal]     = useState(category.name);
  const [collapsed, setCollapsed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRename = () => {
    if (nameVal.trim() && nameVal.trim() !== category.name) {
      onRename(category.id, nameVal.trim());
    }
    setEditing(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = category.items.findIndex(i => i.id === active.id);
    const newIdx = category.items.findIndex(i => i.id === over.id);
    onItemsReorder(category.id, arrayMove(category.items, oldIdx, newIdx));
  };

  return (
    <div className="border border-border-main rounded-xl overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-card">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-muted hover:text-primary transition shrink-0"
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNameVal(category.name); setEditing(false); } }}
              className="flex-1 px-2 py-1 text-sm font-semibold bg-surface border border-[#FF6F0F] rounded outline-none text-primary"
            />
            <button onClick={handleRename} className="p-1 rounded hover:bg-surface text-green-500 transition"><Check size={14} /></button>
            <button onClick={() => { setNameVal(category.name); setEditing(false); }} className="p-1 rounded hover:bg-surface text-muted transition"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 group/header">
            <span className="text-sm font-semibold text-primary">{category.name}</span>
            <span className="text-xs text-muted">({category.items.length})</span>
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded hover:bg-surface text-muted hover:text-primary transition opacity-0 group-hover/header:opacity-100"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAddItem(category.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-[#FF6F0F]/10 text-[#FF6F0F] hover:bg-[#FF6F0F]/20 transition"
          >
            <Plus size={12} /> 메뉴 추가
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-red-400 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="p-3 space-y-1.5">
          {category.items.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">메뉴가 없습니다. 추가해보세요.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={category.items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {category.items.map(item => (
                  <SortableMenuItem
                    key={item.id}
                    item={item}
                    onEdit={onEditItem}
                    onDelete={id => onDeleteItem(id, category.id)}
                    onToggle={(id, val) => onToggleItem(id, category.id, val)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ItemModal                                                            */
/* ------------------------------------------------------------------ */

interface ItemForm { name: string; description: string; price: string; }

function ItemModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial?: Partial<ItemForm>;
  onSave: (form: ItemForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemForm>({
    name: initial?.name || '',
    description: initial?.description || '',
    price: initial?.price || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border-main rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-main">
          <h3 className="font-semibold text-primary">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-primary transition"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">메뉴명 *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예) 삼겹살, 된장찌개"
              className="w-full px-3 py-2 text-sm bg-card border border-border-main rounded-lg outline-none focus:border-[#FF6F0F] text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">설명</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="간단한 설명 (선택)"
              className="w-full px-3 py-2 text-sm bg-card border border-border-main rounded-lg outline-none focus:border-[#FF6F0F] text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">가격 (원)</label>
            <input
              type="number"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="예) 15000"
              className="w-full px-3 py-2 text-sm bg-card border border-border-main rounded-lg outline-none focus:border-[#FF6F0F] text-primary"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-border-main">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-border-main text-muted hover:bg-card transition"
          >
            취소
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-[#FF6F0F] text-white hover:bg-[#e56500] transition disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                            */
/* ------------------------------------------------------------------ */

export default function MenusPage() {
  const sb = createClient();

  const [stores,     setStores]     = useState<Store[]>([]);
  const [storeId,    setStoreId]    = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(false);

  /* modal state */
  const [addCatModal,  setAddCatModal]  = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [itemModal,    setItemModal]    = useState<{
    mode: 'add' | 'edit';
    categoryId?: string;
    item?: MenuItem;
  } | null>(null);

  /* ---- load stores ---- */
  useEffect(() => {
    sb.from('stores')
      .select('id, name, category')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStores(data || []));
  }, []);

  /* ---- load categories + items ---- */
  const loadMenu = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    const { data: cats } = await sb
      .from('menu_categories')
      .select('*')
      .eq('store_id', sid)
      .order('sort_order');

    const { data: items } = await sb
      .from('menu_items')
      .select('*')
      .eq('store_id', sid)
      .order('sort_order');

    const grouped = (cats || []).map(c => ({
      ...c,
      items: (items || []).filter(i => i.category_id === c.id),
    }));
    setCategories(grouped);
    setLoading(false);
  }, []);

  useEffect(() => { if (storeId) loadMenu(storeId); }, [storeId]);

  /* ---- category actions ---- */
  const addCategory = async () => {
    if (!newCatName.trim() || !storeId) return;
    const sort_order = categories.length;
    const { data } = await sb
      .from('menu_categories')
      .insert({ store_id: storeId, name: newCatName.trim(), sort_order })
      .select()
      .single();
    if (data) setCategories(prev => [...prev, { ...data, items: [] }]);
    setNewCatName('');
    setAddCatModal(false);
  };

  const renameCategory = async (id: string, name: string) => {
    await sb.from('menu_categories').update({ name }).eq('id', id);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('카테고리와 하위 메뉴가 모두 삭제됩니다. 계속할까요?')) return;
    await sb.from('menu_categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  /* ---- item actions ---- */
  const saveItem = async (form: ItemForm) => {
    if (!itemModal) return;
    const priceVal = form.price ? parseInt(form.price) : null;

    if (itemModal.mode === 'add' && itemModal.categoryId) {
      const catItems = categories.find(c => c.id === itemModal.categoryId)?.items || [];
      const { data } = await sb
        .from('menu_items')
        .insert({
          category_id: itemModal.categoryId,
          store_id: storeId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: priceVal,
          sort_order: catItems.length,
          is_active: true,
        })
        .select()
        .single();
      if (data) {
        setCategories(prev => prev.map(c =>
          c.id === itemModal.categoryId ? { ...c, items: [...c.items, data] } : c,
        ));
      }
    } else if (itemModal.mode === 'edit' && itemModal.item) {
      await sb.from('menu_items').update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: priceVal,
      }).eq('id', itemModal.item.id);
      setCategories(prev => prev.map(c => ({
        ...c,
        items: c.items.map(i =>
          i.id === itemModal.item!.id
            ? { ...i, name: form.name.trim(), description: form.description.trim() || null, price: priceVal }
            : i,
        ),
      })));
    }
    setItemModal(null);
  };

  const deleteItem = async (id: string, categoryId: string) => {
    if (!confirm('메뉴를 삭제할까요?')) return;
    await sb.from('menu_items').delete().eq('id', id);
    setCategories(prev => prev.map(c =>
      c.id === categoryId ? { ...c, items: c.items.filter(i => i.id !== id) } : c,
    ));
  };

  const toggleItem = async (id: string, categoryId: string, is_active: boolean) => {
    await sb.from('menu_items').update({ is_active }).eq('id', id);
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, items: c.items.map(i => i.id === id ? { ...i, is_active } : i) }
        : c,
    ));
  };

  /* ---- reorder items (drag) ---- */
  const reorderItems = async (categoryId: string, newItems: MenuItem[]) => {
    // optimistic update
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, items: newItems } : c));
    // persist sort_order
    const updates = newItems.map((item, idx) =>
      sb.from('menu_items').update({ sort_order: idx }).eq('id', item.id),
    );
    await Promise.all(updates);
  };

  /* ---------------------------------------------------------------- */

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">메뉴 관리</h1>
        <p className="text-sm text-muted mt-1">가게별 메뉴 카테고리 및 항목을 관리합니다.</p>
      </div>

      {/* Store selector */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <select
            value={storeId}
            onChange={e => setStoreId(e.target.value)}
            className="w-full appearance-none px-4 py-2.5 pr-8 bg-card border border-border-main rounded-xl text-sm text-primary outline-none focus:border-[#FF6F0F] cursor-pointer"
          >
            <option value="">— 가게 선택 —</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>

        {storeId && (
          <button
            onClick={() => setAddCatModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF6F0F] text-white text-sm rounded-xl hover:bg-[#e56500] transition font-medium"
          >
            <Plus size={15} /> 카테고리 추가
          </button>
        )}
      </div>

      {/* Content */}
      {!storeId ? (
        <div className="text-center py-20 text-muted text-sm">가게를 선택하면 메뉴를 관리할 수 있습니다.</div>
      ) : loading ? (
        <div className="text-center py-20 text-muted text-sm">불러오는 중...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm mb-3">등록된 카테고리가 없습니다.</p>
          <button
            onClick={() => setAddCatModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF6F0F] text-white text-sm rounded-xl hover:bg-[#e56500] transition font-medium mx-auto"
          >
            <Plus size={15} /> 첫 번째 카테고리 추가
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onAddItem={id => setItemModal({ mode: 'add', categoryId: id })}
              onEditItem={item => setItemModal({ mode: 'edit', item })}
              onDeleteItem={deleteItem}
              onToggleItem={toggleItem}
              onItemsReorder={reorderItems}
            />
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {addCatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-main rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-main">
              <h3 className="font-semibold text-primary">카테고리 추가</h3>
              <button onClick={() => setAddCatModal(false)} className="text-muted hover:text-primary transition"><X size={18} /></button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="예) 메인메뉴, 사이드, 음료"
                className="w-full px-3 py-2 text-sm bg-card border border-border-main rounded-lg outline-none focus:border-[#FF6F0F] text-primary"
              />
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-border-main">
              <button onClick={() => setAddCatModal(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-border-main text-muted hover:bg-card transition">취소</button>
              <button
                onClick={addCategory}
                disabled={!newCatName.trim()}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[#FF6F0F] text-white hover:bg-[#e56500] transition disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {itemModal && (
        <ItemModal
          title={itemModal.mode === 'add' ? '메뉴 추가' : '메뉴 수정'}
          initial={itemModal.item
            ? {
                name: itemModal.item.name,
                description: itemModal.item.description || '',
                price: itemModal.item.price?.toString() || '',
              }
            : undefined}
          onSave={saveItem}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  );
}
