import '/src/main.css';
import 'remixicon/fonts/remixicon.css';
import { createApp, nextTick } from 'vue';

const copy = (value) => JSON.parse(JSON.stringify(value));
const names = ['Cummins Titanium（演示）', 'Stellantis A10（演示）', '飞轮环 400 号（演示）', 'Dauch 报价（演示）', 'Mersen PPAP（演示）'];
const categories = Array.from({ length: 40 }, (_, index) => ({
  id: index === 0 ? 'default' : `cat-${String(index).padStart(2, '0')}`,
  name: names[index] || `项目 ${String(index).padStart(2, '0')} · 机加工技术评审（演示）`,
  sort: index,
  icon: index === 0 ? 'ri-file-list-line' : 'ri-folder-3-line',
  color: ['#1890ff', '#52c41a', '#e17055', '#722ed1'][index % 4],
  isDefault: index === 0
}));
const now = new Date().toISOString();
const todos = [
  { id: 'qa-1', categoryId: 'default', content: 'PPAP 文件评审（演示任务）', description: '保留这段原始备注；演示 CMM 检测报告。', tags: ['PPAP', '客户沟通'], subtasks: [{ id: 'sub-1', content: '核对图纸版本', isCompleted: false }], attachments: [{ id: 'att-1', name: 'demo.txt', size: 9, mimeType: 'text/plain', dataUrl: 'data:text/plain;base64,ZGVtbyBmaWxl' }], isCompleted: false, priority: 'medium', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null },
  { id: 'qa-2', categoryId: 'default', content: '锻造报价确认（演示任务）', description: '待确认单价和交期。', tags: ['报价'], subtasks: [], attachments: [], isCompleted: false, priority: 'low', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null },
  { id: 'qa-3', categoryId: 'default', content: '历史待办兼容测试（演示任务）', description: '这条原始记录没有 tags 字段。', subtasks: [], attachments: [], isCompleted: false, priority: 'low', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null },
  { id: 'qa-4', categoryId: 'cat-01', content: 'Stellantis 交样计划（演示任务）', description: '检查交样节点。', tags: ['客户沟通'], subtasks: [], attachments: [], isCompleted: false, priority: 'low', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null },
  { id: 'qa-5', categoryId: 'cat-02', content: '飞轮环技术问题（演示任务）', description: '', tags: ['技术评审'], subtasks: [], attachments: [], isCompleted: false, priority: 'low', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null },
  { id: 'qa-6', categoryId: 'default', content: '已完成任务（演示任务）', description: '', tags: ['已归档'], subtasks: [], attachments: [], isCompleted: true, priority: 'low', createdAt: now, reminderEnabled: false, notifyChannels: [], repeatRule: null }
];
for (const category of categories) category.count = todos.filter(todo => todo.categoryId === category.id && !todo.isCompleted).length;
const initial = {
  categories: { _id: 'categories', _rev: '1-qa', data: categories },
  todos: { _id: 'todos', _rev: '1-qa', data: todos },
  settings: { _id: 'settings', _rev: '1-qa', data: { defaultCategoryId: 'default', notification: {}, backup: {} } }
};
let documents = copy(initial);
const writes = [];
const errors = [];
const warnings = [];
let enterCallback = null;
// 只使用本页内存数据库，禁止接入真实 uTools 数据或账号。
window.utools = {
  db: {
    get: (id) => documents[id] ? copy(documents[id]) : null,
    put: (document) => {
      const saved = copy(document);
      saved._rev = `${(parseInt(documents[saved._id]?._rev, 10) || 0) + 1}-qa`;
      documents[saved._id] = saved;
      writes.push({ id: saved._id, data: copy(saved.data) });
      window.dispatchEvent(new CustomEvent('qa-db-put'));
      return { ok: true, id: saved._id, rev: saved._rev };
    }
  },
  onPluginEnter: (callback) => { enterCallback = callback; },
  isDarkColors: () => false,
  showNotification: (message) => warnings.push(String(message)),
  getCurrentBrowserWindow: () => null,
  showMainWindow: () => {},
  outPlugin: () => {},
  copyText: () => {}
};
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
const { default: App } = await import('/src/App.vue');
const { db } = await import('/src/utils/db.js');
let application;
const mountApp = () => {
  application = createApp(App);
  application.config.errorHandler = (error) => errors.push(error.message);
  application.config.warnHandler = (warning) => warnings.push(warning);
  application.mount('#app');
};
mountApp();
window.__qa = {
  initial: copy(initial),
  get: (id) => copy(documents[id]),
  getWrites: () => copy(writes),
  getErrors: () => [...errors],
  getWarnings: () => [...warnings],
  readTodos: () => db.getTodos(),
  tick: async () => { await nextTick(); await new Promise(requestAnimationFrame); },
  reset: async () => { documents = copy(initial); writes.length = 0; enterCallback?.({ code: 'qa' }); await nextTick(); },
  remount: async () => { application.unmount(); mountApp(); await nextTick(); await new Promise(requestAnimationFrame); }
};
const updateSnapshot = () => {
  document.getElementById('qa-state').value = `${documents.categories.data.length} 个列表 / ${documents.todos.data.length} 条待办 · 顺序：${documents.categories.data.slice(0, 3).map(item => item.id).join(', ')}`;
};
window.addEventListener('qa-db-put', updateSnapshot);
updateSnapshot();
document.getElementById('reset-demo').addEventListener('click', () => location.reload());
await window.__qa.tick();
window.__qa.ready = true;
window.dispatchEvent(new Event('qa-ready'));
