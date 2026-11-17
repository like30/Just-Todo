<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  allTags: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '输入标签，回车或逗号确认'
  }
});

const emit = defineEmits(['update:modelValue']);

const inputValue = ref('');
const inputRef = ref(null);
const showSuggestions = ref(false);

const normalize = (tag) => (tag || '').toString().trim();

const tags = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val)
});

const addTag = (tag) => {
  const t = normalize(tag);
  if (!t) return;
  if (!tags.value.includes(t)) {
    tags.value = [...tags.value, t];
  }
  inputValue.value = '';
};

const removeTag = (tag) => {
  tags.value = tags.value.filter(t => t !== tag);
};

const handleInputKeydown = (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(inputValue.value);
  } else if (e.key === 'Backspace' && !inputValue.value && tags.value.length) {
    removeTag(tags.value[tags.value.length - 1]);
  }
};

const filteredSuggestions = computed(() => {
  if (!inputValue.value.trim()) return [];
  const lower = inputValue.value.toLowerCase();
  return props.allTags
    .filter(tag => tag.toLowerCase().includes(lower) && !tags.value.includes(tag))
    .slice(0, 8);
});

const handleInputFocus = () => {
  showSuggestions.value = true;
};

const handleInputBlur = () => {
  setTimeout(() => {
    showSuggestions.value = false;
    if (inputValue.value.trim()) {
      addTag(inputValue.value);
    }
  }, 150);
};

const focusInput = () => {
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const TAG_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa541c', '#a0d911', '#2f54eb'
];

const getTagColor = (tag) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};
</script>

<template>
  <div class="tag-input-wrapper" @click="focusInput">
    <div class="tag-chips">
      <span
        v-for="tag in tags"
        :key="tag"
        class="tag-chip"
        :style="{ backgroundColor: getTagColor(tag) + '20', color: getTagColor(tag), borderColor: getTagColor(tag) + '40' }"
      >
        {{ tag }}
        <button type="button" class="tag-remove" @click.stop="removeTag(tag)">
          <i class="ri-close-line"></i>
        </button>
      </span>
      <input
        ref="inputRef"
        v-model="inputValue"
        class="tag-input"
        :placeholder="tags.length ? '' : placeholder"
        @keydown="handleInputKeydown"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
      />
    </div>
    <div v-if="showSuggestions && filteredSuggestions.length" class="tag-suggestions">
      <div
        v-for="s in filteredSuggestions"
        :key="s"
        class="tag-suggestion-item"
        @mousedown.prevent="addTag(s)"
      >
        <span
          class="tag-dot"
          :style="{ backgroundColor: getTagColor(s) }"
        ></span>
        {{ s }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-input-wrapper {
  position: relative;
  width: 100%;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--color-border-tertiary, #d9d9d9);
  border-radius: 8px;
  min-height: 36px;
  cursor: text;
  background: var(--color-background-primary, #fff);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  white-space: nowrap;
}

.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.6;
  color: inherit;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  flex: 1;
  min-width: 80px;
  border: none;
  outline: none;
  font-size: 13px;
  padding: 2px 4px;
  background: transparent;
  color: var(--color-text-primary, #333);
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-background-primary, #fff);
  border: 1px solid var(--color-border-tertiary, #d9d9d9);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tag-suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-primary, #333);
}

.tag-suggestion-item:hover {
  background: var(--color-background-secondary, #f5f5f5);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
