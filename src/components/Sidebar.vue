<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import draggable from 'vuedraggable';
import dayjs from 'dayjs';

const props = defineProps({
  categories: { type: Array, required: true },
  currentCategoryId: { type: String, required: true },
  todos: { type: Array, default: () => [] },
  themeMode: { type: String, default: 'system' },
  allTags: { type: Array, default: () => [] },
  activeTag: { type: String, default: '' },
  searchQuery: { type: String, default: '' }
});

const emit = defineEmits(['select', 'update:categories', 'add-category', 'context-menu', 'theme-change', 'open-settings', 'set-active-tag', 'update:searchQuery']);

const dragging = ref(false);
const categoryListRef = ref(null);
// 项目名搜索只影响展示，不参与待办/标签搜索，也不写入业务数据库。
const categoryQuery = ref('');
const normalizedCategoryQuery = computed(() => categoryQuery.value.trim().toLocaleLowerCase());
const matchesCategory = (category) => String(category.name || '').toLocaleLowerCase().includes(normalizedCategoryQuery.value);
const visibleCategories = computed(() => props.categories.filter(matchesCategory));

// 拖拽始终绑定完整清单。搜索时禁用排序，防止把筛选结果写回为完整数据。
const categoriesList = computed({
  get: () => props.categories,
  set: (val) => emit('update:categories', val)
});

const WIDTH_KEY = 'just-todo:lists-pane-width';
const DEFAULT_LIST_WIDTH = 280;
const MIN_LIST_WIDTH = 180;
const MAX_LIST_WIDTH = 440;
const viewportWidth = ref(window.innerWidth);
const preferredListWidth = ref(DEFAULT_LIST_WIDTH);
const resizing = ref(false);
let resizeStart = null;

const navigationPaneWidth = computed(() => viewportWidth.value <= 600 ? 80 : viewportWidth.value <= 760 ? 152 : viewportWidth.value <= 960 ? 176 : 200);
const maxListWidth = computed(() => Math.max(MIN_LIST_WIDTH, Math.min(MAX_LIST_WIDTH, viewportWidth.value - navigationPaneWidth.value - 320)));
const listPaneWidth = computed(() => Math.max(MIN_LIST_WIDTH, Math.min(preferredListWidth.value, maxListWidth.value)));
const clampWidth = (width) => Math.max(MIN_LIST_WIDTH, Math.min(width, maxListWidth.value));
const syncViewport = () => { viewportWidth.value = window.innerWidth; };

const rememberWidth = () => {
  try { localStorage.setItem(WIDTH_KEY, String(preferredListWidth.value)); } catch (e) { /* 本地偏好不可写时仍可正常调整宽度。 */ }
};
const moveResize = (event) => {
  if (!resizeStart || event.pointerId !== resizeStart.pointerId) return;
  preferredListWidth.value = clampWidth(resizeStart.width + event.clientX - resizeStart.x);
};
const endResize = (event) => {
  if (event && resizeStart && event.pointerId !== resizeStart.pointerId) return;
  if (!resizeStart) return;
  resizeStart = null;
  resizing.value = false;
  window.removeEventListener('pointermove', moveResize);
  window.removeEventListener('pointerup', endResize);
  window.removeEventListener('pointercancel', endResize);
  rememberWidth();
};
const startResize = (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  resizeStart = { pointerId: event.pointerId, x: event.clientX, width: listPaneWidth.value };
  resizing.value = true;
  window.addEventListener('pointermove', moveResize);
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
};
const resetWidth = () => {
  preferredListWidth.value = DEFAULT_LIST_WIDTH;
  rememberWidth();
};
const resizeWithKeyboard = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const step = event.shiftKey ? 40 : 16;
  preferredListWidth.value = event.key === 'Home' ? MIN_LIST_WIDTH
    : event.key === 'End' ? maxListWidth.value
    : clampWidth(listPaneWidth.value + (event.key === 'ArrowRight' ? step : -step));
  rememberWidth();
};

const onSelect = (id) => emit('select', id);
const onContextMenu = (event, category) => {
  event.preventDefault();
  emit('context-menu', { event, type: 'category', item: category });
};
const onAddCategory = () => emit('add-category');
const handleDragEnd = () => { dragging.value = false; };
const setActiveTag = (tag) => emit('set-active-tag', tag);
const updateSearch = (event) => emit('update:searchQuery', event.target.value);
const getTagCount = (tag) => props.todos.filter(todo => Array.isArray(todo.tags) && todo.tags.includes(tag) && !todo.isCompleted).length;

const getSmartCount = (type) => {
  if (!props.todos) return 0;
  if (type === 'all') return props.todos.filter(todo => !todo.isCompleted).length;
  if (type === 'today') return props.todos.filter(todo => !todo.isCompleted && todo.dueDate && dayjs(todo.dueDate).isSame(dayjs(), 'day')).length;
  if (type === 'plan') return props.todos.filter(todo => !todo.isCompleted && todo.dueDate && dayjs(todo.dueDate).isAfter(dayjs(), 'day')).length;
  if (type === 'urgent') return props.todos.filter(todo => !todo.isCompleted && (todo.priority === 'high' || todo.priority === 'medium')).length;
  if (type === 'completed') return props.todos.filter(todo => todo.isCompleted).length;
  return 0;
};

const smartLists = [
  { id: 'today', name: '今日待办', icon: 'ri-calendar-check-line', color: '#1890ff' },
  { id: 'plan', name: '计划', icon: 'ri-calendar-todo-line', color: '#722ed1' },
  { id: 'all', name: '全部', icon: 'ri-inbox-line', color: '#52c41a' },
  { id: 'urgent', name: '优先级', icon: 'ri-flag-2-fill', color: '#f5222d' },
  { id: 'completed', name: '已完成', icon: 'ri-checkbox-circle-line', color: '#19803f' }
];
const themeModes = [
  { id: 'light', name: '白天', icon: 'ri-sun-line' },
  { id: 'dark', name: '黑夜', icon: 'ri-moon-line' },
  { id: 'system', name: '系统', icon: 'ri-computer-line' }
];
const themeIndex = computed(() => props.themeMode === 'light' ? 0 : props.themeMode === 'dark' ? 1 : 2);
const sliderLeft = computed(() => `${themeIndex.value * 33.333}%`);
const setTheme = (mode) => emit('theme-change', mode);
const openSettings = () => emit('open-settings');

const revealSelectedCategory = async () => {
  await nextTick();
  if (dragging.value) return;
  const selected = categoryListRef.value?.querySelector('.category-item.active');
  if (selected && selected.getClientRects().length) selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};
watch(() => props.currentCategoryId, revealSelectedCategory);
watch(normalizedCategoryQuery, async () => {
  await nextTick();
  if (categoryListRef.value) categoryListRef.value.scrollTop = 0;
});

// 保留上下键导航，但不干扰输入框、弹窗和可调分隔线。
const handleKeyNav = (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = document.activeElement;
  if (target?.matches('input, textarea, select, [contenteditable="true"]') || target?.closest('.modal-overlay, .drawer-overlay, [role="dialog"], [role="separator"]')) return;
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const allIds = [...smartLists.map(item => item.id), ...visibleCategories.value.map(category => category.id)];
  if (!allIds.length) return;
  event.preventDefault();
  const index = allIds.indexOf(props.currentCategoryId);
  const nextIndex = (index + (event.key === 'ArrowUp' ? -1 : 1) + allIds.length) % allIds.length;
  onSelect(allIds[nextIndex]);
};

onMounted(() => {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= MIN_LIST_WIDTH && saved <= MAX_LIST_WIDTH) preferredListWidth.value = saved;
  } catch (e) { /* 不依赖存储权限即可启动。 */ }
  syncViewport();
  window.addEventListener('resize', syncViewport);
  window.addEventListener('keydown', handleKeyNav);
});
onUnmounted(() => {
  window.removeEventListener('resize', syncViewport);
  window.removeEventListener('keydown', handleKeyNav);
  endResize();
});
</script>

<template>
  <!-- 同一组件的两个根节点直接成为 App 的前两栏，原有事件和业务状态保持不变。 -->
  <nav class="sidebar" :class="{ compact: navigationPaneWidth === 80 }" :style="{ '--navigation-pane-width': `${navigationPaneWidth}px` }" aria-label="功能导航">
    <div class="navigation-scroll">
      <div class="smart-lists-grid">
        <button
          v-for="item in smartLists"
          :key="item.id"
          type="button"
          class="smart-item"
          :class="{ active: currentCategoryId === item.id, 'full-width': item.id === 'completed' }"
          :aria-pressed="currentCategoryId === item.id"
          :title="item.name"
          @click="onSelect(item.id)"
        >
          <span class="smart-icon" :style="{ color: item.color }"><i :class="item.icon"></i></span>
          <span class="smart-name">{{ item.name }}</span>
          <span v-if="getSmartCount(item.id)" class="smart-count">{{ getSmartCount(item.id) }}</span>
        </button>
      </div>

      <div v-if="allTags.length > 0" class="tags-section">
        <div class="tags-header"><i class="ri-price-tag-3-line"></i><span>标签</span></div>
        <div class="tags-cloud">
          <button
            v-for="tag in allTags"
            :key="tag"
            type="button"
            class="tag-chip"
            :class="{ active: activeTag === tag }"
            :aria-pressed="activeTag === tag"
            :title="tag"
            @click="setActiveTag(activeTag === tag ? '' : tag)"
          >
            <span class="tag-name">{{ tag }}</span>
            <span v-if="getTagCount(tag)" class="tag-count">{{ getTagCount(tag) }}</span>
          </button>
        </div>
        <div v-if="activeTag" class="active-tag-bar">
          <span>筛选: {{ activeTag }}</span>
          <button type="button" class="clear-tag-btn" title="清除标签筛选" @click="setActiveTag('')"><i class="ri-close-line"></i></button>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="search-box">
        <i class="ri-search-line search-icon"></i>
        <input type="search" class="search-input" placeholder="搜索待办 / 标签..." aria-label="搜索待办或标签" :value="searchQuery" @input="updateSearch" />
        <button v-if="searchQuery" type="button" class="search-clear" title="清除待办搜索" @click="emit('update:searchQuery', '')"><i class="ri-close-circle-fill"></i></button>
      </div>
    </div>
    <div class="sidebar-footer settings-footer">
      <button type="button" class="settings-btn" title="设置" @click="openSettings"><i class="ri-settings-3-line"></i></button>
      <div class="theme-switch">
        <div class="switch-track">
          <div class="switch-slider" :style="{ left: sliderLeft }"></div>
          <button v-for="mode in themeModes" :key="mode.id" type="button" class="switch-item" :class="{ active: themeMode === mode.id }" :aria-pressed="themeMode === mode.id" :title="mode.name" @click="setTheme(mode.id)">
            <i :class="mode.icon"></i><span>{{ mode.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </nav>

  <section class="lists-pane" :class="{ 'is-resizing': resizing }" :style="{ '--lists-pane-width': `${listPaneWidth}px` }" aria-label="我的列表">
    <header class="lists-pane-header">
      <div class="my-lists-header">
        <h2>我的列表</h2>
        <button type="button" class="add-btn-small" title="新建清单" @click="onAddCategory"><i class="ri-add-line"></i><span>添加分类</span></button>
      </div>
      <div class="search-box category-search-box">
        <i class="ri-search-line search-icon"></i>
        <input v-model="categoryQuery" type="search" class="search-input" placeholder="搜索项目 / 列表..." aria-label="搜索我的列表" />
        <button v-if="categoryQuery" type="button" class="search-clear" title="清除项目搜索" @click="categoryQuery = ''"><i class="ri-close-circle-fill"></i></button>
      </div>
    </header>

    <div ref="categoryListRef" class="category-list">
      <draggable v-model="categoriesList" item-key="id" class="drag-area" :disabled="!!normalizedCategoryQuery" :animation="150" @start="dragging = true" @end="handleDragEnd">
        <template #item="{ element }">
          <div
            v-show="matchesCategory(element)"
            class="category-item"
            :class="{ active: element.id === currentCategoryId }"
            :data-category-id="element.id"
            :title="element.name"
            role="button"
            tabindex="0"
            :aria-pressed="element.id === currentCategoryId"
            @click="onSelect(element.id)"
            @keydown.enter.prevent="onSelect(element.id)"
            @keydown.space.prevent="onSelect(element.id)"
            @contextmenu="onContextMenu($event, element)"
          >
            <span class="category-icon" :style="{ color: element.color || '#666' }"><i :class="element.icon || 'ri-list-check'"></i></span>
            <span class="category-name">{{ element.name }}</span>
            <span v-if="element.isDefault" class="default-badge" title="默认分类"><i class="ri-pushpin-2-fill"></i></span>
            <span v-if="element.count" class="category-count">{{ element.count }}</span>
          </div>
        </template>
      </draggable>
      <div v-if="!visibleCategories.length" class="lists-empty" role="status">
        <i class="ri-search-line"></i>
        <span>{{ normalizedCategoryQuery ? '没有匹配的列表' : '还没有列表' }}</span>
        <button v-if="normalizedCategoryQuery" type="button" @click="categoryQuery = ''">清除搜索</button>
        <button v-else type="button" @click="onAddCategory">添加分类</button>
      </div>
    </div>

    <footer class="lists-pane-footer" aria-live="polite">
      <span>{{ normalizedCategoryQuery ? `${visibleCategories.length} / ${categories.length}` : categories.length }} 个列表</span>
      <span>{{ normalizedCategoryQuery ? '清空搜索后可排序' : '拖动排序' }}</span>
    </footer>
    <div class="pane-resizer" role="separator" aria-label="调整我的列表宽度" aria-orientation="vertical" :aria-valuemin="MIN_LIST_WIDTH" :aria-valuemax="maxListWidth" :aria-valuenow="listPaneWidth" tabindex="0" title="拖动调整列宽；双击恢复默认宽度；方向键微调" @pointerdown="startResize" @keydown="resizeWithKeyboard" @dblclick="resetWidth"></div>
  </section>
</template>

<style scoped lang="less">
.sidebar,
.lists-pane {
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  user-select: none;
  font-size: 14px;
  color: var(--text-color);
}
.sidebar {
  width: var(--navigation-pane-width, 200px);
  flex: 0 0 var(--navigation-pane-width, 200px);
  background: var(--bg-color);
}
.navigation-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}
.smart-lists-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
}
.smart-item {
  min-width: 0;
  min-height: 82px;
  padding: 12px 10px;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  text-align: left;
  transition: background-color 150ms ease;
  &:hover { background: var(--hover-bg); }
  &.active {
    background: var(--active-bg);
    color: var(--primary-color);
    .smart-name { color: var(--primary-color); }
  }
  .smart-icon { font-size: 20px; margin-bottom: 8px; }
  .smart-name { font-size: 13px; font-weight: 500; white-space: nowrap; }
  .smart-count { position: absolute; top: 10px; right: 8px; font-size: 16px; color: var(--secondary-text); font-weight: 600; }
  &.full-width {
    grid-column: span 2;
    flex-direction: row;
    align-items: center;
    min-height: 44px;
    .smart-icon { margin: 0 10px 0 0; }
    .smart-count { top: 50%; transform: translateY(-50%); }
  }
}
.tags-section {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  .tags-header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text); margin-bottom: 8px; }
  .tags-cloud { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    min-height: 30px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-secondary);
    color: var(--secondary-text);
    border: 1px solid var(--border-color);
    &:hover { background: var(--hover-bg); color: var(--text-color); }
    &.active { background: var(--active-bg); color: var(--primary-color); border-color: var(--primary-color); }
    .tag-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag-count { flex-shrink: 0; font-size: 11px; }
  }
  .active-tag-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-top: 8px;
    padding: 4px 8px;
    background: var(--active-bg);
    border-radius: 4px;
    font-size: 12px;
    color: var(--primary-color);
    > span { min-width: 0; overflow-wrap: anywhere; }
    .clear-tag-btn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 26px; height: 26px; padding: 0; }
  }
}
.sidebar-footer {
  flex-shrink: 0;
  padding: 10px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-box {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  box-sizing: border-box;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  &:focus-within { border-color: var(--primary-color); }
  .search-icon { font-size: 16px; color: var(--secondary-text); flex-shrink: 0; }
  .search-input {
    flex: 1;
    width: 0;
    min-width: 0;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-color);
    padding: 0;
    &::placeholder { color: var(--secondary-text); }
    &::-webkit-search-cancel-button { display: none; }
  }
  .search-clear { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; font-size: 16px; color: var(--secondary-text); flex-shrink: 0; &:hover { color: var(--text-color); } }
}
.settings-btn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 36px; padding: 0; border-radius: var(--radius-sm); color: var(--secondary-text); background: var(--bg-secondary); &:hover { background: var(--hover-bg); color: var(--text-color); } }
.theme-switch { flex: 1; min-width: 0; }
.switch-track { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
.switch-slider { position: absolute; top: 0; left: 0; width: 33.333%; height: 100%; background: var(--active-bg); transition: left 150ms ease; }
.switch-item { min-width: 0; min-height: 34px; position: relative; padding: 6px 2px; font-size: 12px; color: var(--secondary-text); display: flex; align-items: center; justify-content: center; gap: 3px; z-index: 1; &.active { color: var(--text-color); font-weight: 600; } }

.switch-item > i { font-size: 12px; flex-shrink: 0; }
.switch-item > span { white-space: nowrap; }

.lists-pane {
  width: var(--lists-pane-width, 280px);
  flex: 0 0 var(--lists-pane-width, 280px);
  position: relative;
  background: var(--bg-secondary);
}
.lists-pane-header { flex-shrink: 0; padding: 16px 14px 12px; border-bottom: 1px solid var(--border-color); }
.my-lists-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  h2 { margin: 0; font-size: 17px; font-weight: 650; white-space: nowrap; }
  .add-btn-small { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 4px; min-height: 30px; padding: 4px 6px; border-radius: var(--radius-sm); font-size: 12px; color: var(--primary-color); white-space: nowrap; &:hover { background: var(--hover-bg); } }
}
.category-search-box { background: var(--bg-color); }
.category-list {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 8px 8px 0;
  position: relative;
  // 只恢复中间栏的滚动条，不改变原来任务区的滚动实现。
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
  &::-webkit-scrollbar { display: block; width: 7px; height: 7px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 6px; }
  &::-webkit-scrollbar-thumb:hover { background: var(--secondary-text); }
}
.drag-area { min-height: 0; padding-bottom: 8px; }
.category-item {
  box-sizing: border-box;
  min-height: 44px;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--text-color);
  border: 1px solid transparent;
  transition: background-color 150ms ease;
  &:hover { background: var(--hover-bg); }
  &.active { background: var(--active-bg); font-weight: 500; color: var(--primary-color); }
  .category-icon { flex-shrink: 0; margin-right: 9px; width: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }
  .category-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 22px; }
  .default-badge { flex-shrink: 0; margin-left: 6px; color: var(--primary-color); font-size: 14px; transform: rotate(45deg); }
  .category-count { flex-shrink: 0; margin-left: 6px; font-size: 12px; color: var(--secondary-text); background: var(--hover-bg); padding: 2px 7px; border-radius: 10px; }
}
.lists-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 8px; color: var(--secondary-text); > i { font-size: 26px; } > button { color: var(--primary-color); padding: 8px; } }
.lists-pane-footer { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--secondary-text); > span:first-child { white-space: nowrap; } > span:last-child { text-align: right; } }
.pane-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 7px;
  z-index: 5;
  cursor: col-resize;
  touch-action: none;
  &::after { content: ''; position: absolute; left: 3px; top: 0; width: 2px; height: 100%; background: transparent; }
  &:hover::after, &:focus-visible::after { background: var(--primary-color); }
}
.is-resizing { cursor: col-resize; .pane-resizer::after { background: var(--primary-color); } }
.sidebar button:focus-visible,
.lists-pane button:focus-visible,
.category-item:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.pane-resizer:focus-visible { outline: none; }

@media (max-width: 960px) {
  .switch-item span { display: none; }
  .my-lists-header { gap: 4px; .add-btn-small { padding-left: 3px; padding-right: 3px; } }
  .lists-pane-header { padding-left: 10px; padding-right: 10px; }
}
.sidebar.compact {
  .smart-lists-grid { grid-template-columns: 1fr; padding: 8px; gap: 6px; }
  .smart-item { min-height: 54px; align-items: center; padding: 8px 4px; .smart-icon { margin: 0; } .smart-name { font-size: 10px; } .smart-count { font-size: 11px; top: 3px; right: 3px; } &.full-width { grid-column: auto; flex-direction: column; .smart-icon { margin: 0; } .smart-count { transform: none; top: 3px; } } }
  .tags-section { padding: 8px 5px; .tags-header span { display: none; } .tag-chip { padding: 3px; font-size: 10px; } .tag-count { display: none; } }
  .sidebar-footer { padding: 8px 5px; gap: 4px; }
  .search-box { padding: 6px 4px; gap: 2px; }
  .settings-footer { flex-wrap: wrap; justify-content: center; .theme-switch { flex-basis: 100%; } }
}
@media (prefers-reduced-motion: reduce) {
  .sidebar *, .lists-pane * { transition: none !important; }
}
</style>
