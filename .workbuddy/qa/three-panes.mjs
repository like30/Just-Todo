const frame = document.getElementById('preview');
const results = [];
const metrics = [];
const win = () => frame.contentWindow;
const doc = () => frame.contentDocument;
const api = () => win().__qa;
const assert = (value, message) => { if (!value) throw new Error(message); };
const query = (selector) => { const element = doc().querySelector(selector); assert(element, `找不到元素：${selector}`); return element; };
const visible = (selector) => [...doc().querySelectorAll(selector)].filter(element => element.getClientRects().length && win().getComputedStyle(element).display !== 'none');
const tick = async () => { await api().tick(); await api().tick(); };
const click = async (element) => { assert(element, '缺少可点击元素'); element.click(); await tick(); };
const setInput = async (element, value) => { element.value = value; element.dispatchEvent(new (win().Event)('input', { bubbles: true })); await tick(); };
const button = (selector, label) => [...doc().querySelectorAll(selector)].find(element => element.textContent.trim() === label);
const smart = async (label) => click(query(`.sidebar .smart-item[title="${label}"]`));
const findTodo = (content) => visible('.todo-item').find(element => element.querySelector('.text')?.textContent === content);
const context = async (element) => { element.dispatchEvent(new (win().MouseEvent)('contextmenu', { bubbles: true, cancelable: true, clientX: 580, clientY: 190 })); await tick(); };
const confirmInput = async (value) => { await setInput(query('#modal-input'), value); await click(button('.modal-actions button', '确定')); };
const addTag = async (scope, tag) => { const input = query(`${scope} .tag-input`); await setInput(input, tag); input.dispatchEvent(new (win().KeyboardEvent)('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await tick(); };
const test = async (name, run) => {
  try { const detail = await run(); results.push({ name, passed: true, detail: detail || '' }); }
  catch (error) { results.push({ name, passed: false, detail: error.message }); }
  const last = results.at(-1);
  const item = document.createElement('li');
  item.className = last.passed ? 'pass' : 'fail';
  item.textContent = `${last.passed ? '通过' : '失败'} · ${last.name}${last.detail ? `：${last.detail}` : ''}`;
  document.getElementById('results').append(item);
};
const resize = async (width, height = 640) => { frame.style.width = `${width}px`; frame.style.height = `${height}px`; await tick(); };
const geometry = () => {
  const root = query('.app-container');
  const panes = [...root.children].filter(element => element.matches('.sidebar, .lists-pane, .main-content'));
  assert(panes.length === 3, `实际列数为 ${panes.length}`);
  const [left, middle, right] = panes.map(element => element.getBoundingClientRect());
  assert(left.width > 0 && middle.width >= 179 && right.width > 0, '某一栏没有有效宽度');
  assert(Math.abs(left.right - middle.left) < 2 && Math.abs(middle.right - right.left) < 2, '三栏未并排对齐');
  assert(Math.abs(middle.top - right.top) < 2 && Math.abs(middle.bottom - right.bottom) < 2, '中间栏不是全高');
  assert(right.right <= win().innerWidth + 2, '任务区横向溢出');
  return { width: win().innerWidth, height: win().innerHeight, columns: [left.width, middle.width, right.width].map(Math.round), listHeight: query('.category-list').clientHeight };
};
const runTests = async () => {
  document.getElementById('run').disabled = true;
  document.getElementById('summary').textContent = '正在运行实际组件回归…';
  document.getElementById('results').replaceChildren();
  results.length = 0;
  metrics.length = 0;
  await api().reset();
  await api().remount();
  await resize(1080, 700);
  await test('三栏并排，第二栏全高', () => { const value = geometry(); metrics.push(value); return JSON.stringify(value); });
  await test('列表独立滚动，标题与其他两栏不随动', async () => {
    const list = query('.category-list');
    assert(list.scrollHeight > list.clientHeight, '40 个列表未形成独立滚动区');
    assert(list.clientHeight > win().innerHeight * 0.65, '项目列表仍被压成小块');
    const headerTop = query('.lists-pane-header').getBoundingClientRect().top;
    const rightTop = query('.main-content').getBoundingClientRect().top;
    list.scrollTop = 200;
    await tick();
    assert(list.scrollTop > 0, '列表无法滚动');
    assert(query('.lists-pane-header').getBoundingClientRect().top === headerTop && query('.main-content').getBoundingClientRect().top === rightTop, '滚动带动了其他区域');
    list.scrollTop = 0;
    const bounds = list.getBoundingClientRect();
    const rows = visible('.category-item').filter(element => { const rect = element.getBoundingClientRect(); return rect.top >= bounds.top && rect.bottom <= bounds.bottom; }).length;
    assert(rows >= 8, `完整可见行数只有 ${rows}`);
    return `${rows} 行完整可见，滚动区 ${list.clientHeight}px`;
  });
  await test('项目搜索只过滤列表，不改业务数据', async () => {
    const before = api().getWrites().length;
    await setInput(query('.category-search-box input'), '项目 39');
    assert(visible('.category-item').length === 1, '没有准确筛出项目 39');
    assert(api().get('categories').data.length === 40 && api().get('todos').data.length === 6, '搜索修改了原数据');
    assert(api().getWrites().length === before, '项目搜索写入了业务数据库');
    // disabled 是传给 Sortable 的 $attrs 选项，不是 draggable 的声明 prop。
    const sortable = query('.drag-area').__draggable_component__?._sortable;
    assert(sortable?.option('disabled') === true, '过滤状态未禁用拖拽排序');
  });
  await test('无匹配空态与清除项目搜索', async () => {
    await setInput(query('.category-search-box input'), '不存在的项目 QA');
    assert(visible('.category-item').length === 0 && query('.lists-empty').textContent.includes('没有匹配'), '缺少搜索空态');
    await click(button('.lists-empty button', '清除搜索'));
    assert(visible('.category-item').length === 40, '清除搜索未还原全部清单');
  });
  await test('长列表名称提供完整悬停标题', () => assert(query('[data-category-id="cat-39"]').title.includes('机加工技术评审'), '完整项目名没有保留'));
  await test('清单排序事件保存新数组且保留完整清单', async () => {
    let component = query('.drag-area').__vueParentComponent;
    while (component && !('modelValue' in component.props)) component = component.parent;
    assert(component, '找不到真实 draggable 组件');
    const all = api().get('categories').data;
    const reordered = [all[1], all[0], ...all.slice(2)];
    component.emit('update:modelValue', reordered);
    await tick();
    const saved = api().get('categories').data;
    assert(saved[0].id === all[1].id && saved.length === all.length, '拖拽返回的新数组没有接回并保存');
    assert([...saved.map(item => item.id)].sort().join() === [...all.map(item => item.id)].sort().join(), '排序遗漏了清单');
    assert(api().get('todos').data.length === 6, '清单排序改动了任务');
  });
  await test('原清单右键菜单仍可打开', async () => {
    await context(query('[data-category-id="default"]'));
    assert(query('.context-menu').textContent.includes('重命名') && query('.context-menu').textContent.includes('设为默认'), '清单菜单入口丢失');
    await click(doc().body);
  });
  await test('原智能导航与任务搜索保留', async () => {
    await smart('全部');
    assert(query('.main-header h2').textContent === '全部待办' && query('.sidebar .smart-item[title="全部"]').getAttribute('aria-pressed') === 'true', '全部视图没有切换');
    await setInput(query('.sidebar .search-input'), 'CMM 检测');
    const rows = visible('.todo-item');
    assert(rows.length === 1 && rows[0].textContent.includes('PPAP 文件评审'), '备注全文搜索未生效');
    assert(visible('.category-item').length === 40, '待办搜索错误地过滤了项目列表');
    await setInput(query('.sidebar .search-input'), '');
  });
  await test('原标签云筛选与取消保留', async () => {
    await click(query('.sidebar .tag-chip[title="报价"]'));
    assert(visible('.todo-item').length === 1 && visible('.todo-item')[0].textContent.includes('锻造报价'), '标签过滤错误');
    await click(query('.sidebar .tag-chip[title="报价"]'));
    assert(visible('.todo-item').length > 1, '再次点击未取消标签筛选');
  });
  await test('多选有可见入口并正确计数', async () => {
    await smart('全部');
    assert(doc().querySelectorAll('.multi-select-toggle').length === 1, '多选入口重复');
    await click(query('.multi-select-toggle'));
    const rows = visible('.todo-content').slice(0, 2);
    assert(rows.length === 2, '缺少可选任务');
    await click(rows[0]);
    await click(rows[1]);
    assert(query('.multi-select-bar').textContent.includes('已选 2 项'), '多选计数不是两项');
  });
  await test('批量添加标签实际写入选中任务', async () => {
    await click(button('.multi-select-actions button', '批量添加标签'));
    await confirmInput('回归测试标签');
    assert(api().get('todos').data.filter(todo => todo.tags?.includes('回归测试标签')).length === 2, '批量标签未准确写入两项');
  });
  await test('批量删除标签实际保留其他任务字段', async () => {
    await click(button('.multi-select-actions button', '批量删除标签'));
    await confirmInput('回归测试标签');
    assert(api().get('todos').data.every(todo => !todo.tags?.includes('回归测试标签')), '标签没有全部移除');
    assert(api().get('todos').data.find(todo => todo.id === 'qa-1').description === api().initial.todos.data[0].description, '批量处理改动了备注');
    await click(button('.multi-select-actions button', '退出多选'));
  });
  await test('管理标签传入完整任务，保存不丢正文和附件', async () => {
    await smart('全部');
    const original = api().get('todos').data.find(todo => todo.id === 'qa-1');
    await context(findTodo(original.content));
    await click(button('.context-menu .menu-item', '管理标签'));
    assert(query('.task-modal .task-input-clean').value === original.content, '标签编辑打开空正文');
    assert(query('.task-modal .tag-chips').textContent.includes('PPAP'), '既有标签未带入');
    await addTag('.task-modal', '单条测试标签');
    await click(button('.task-modal .modal-actions button', '保存'));
    const saved = api().get('todos').data.find(todo => todo.id === 'qa-1');
    assert(saved.tags.includes('单条测试标签') && saved.content === original.content && saved.description === original.description, '单条标签保存破坏正文或备注');
    assert(JSON.stringify(saved.attachments) === JSON.stringify(original.attachments) && JSON.stringify(saved.subtasks) === JSON.stringify(original.subtasks), '附件或子任务丢失');
  });
  await test('仅编辑抽屉标签后关闭同样保存', async () => {
    const target = api().get('todos').data.find(todo => todo.id === 'qa-2');
    await click(findTodo(target.content).querySelector('.todo-content'));
    await addTag('.drawer-box', '抽屉测试标签');
    await click(query('.drawer-header .close-btn'));
    assert(api().get('todos').data.find(todo => todo.id === 'qa-2').tags.includes('抽屉测试标签'), '仅修改标签后关闭未保存');
  });
  await test('新建分类与重命名仍走原保存逻辑', async () => {
    await click(query('.lists-pane .add-btn-small'));
    await confirmInput('QA 新项目');
    const saved = api().get('categories').data;
    const created = saved.find(category => category.name === 'QA 新项目');
    assert(created && saved.length === 41, '新分类未保存');
    await context(query(`[data-category-id="${created.id}"]`));
    await click(button('.context-menu .menu-item', '重命名'));
    await confirmInput('QA 新项目（已改名）');
    assert(api().get('categories').data.find(category => category.id === created.id).name === 'QA 新项目（已改名）', '重命名未保存');
  });
  await test('分隔线键盘调宽、双击复位及偏好保留', async () => {
    const separator = query('.pane-resizer');
    separator.dispatchEvent(new (win().MouseEvent)('dblclick', { bubbles: true }));
    await tick();
    const width = query('.lists-pane').getBoundingClientRect().width;
    separator.dispatchEvent(new (win().KeyboardEvent)('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await tick();
    assert(query('.lists-pane').getBoundingClientRect().width > width, '方向键没有增加列宽');
    const stored = Number(win().localStorage.getItem('just-todo:lists-pane-width'));
    await api().remount();
    await tick();
    assert(Math.abs(query('.lists-pane').getBoundingClientRect().width - stored) < 2, '重新挂载没有恢复列宽偏好');
    query('.pane-resizer').dispatchEvent(new (win().MouseEvent)('dblclick', { bubbles: true }));
    await tick();
  });
  await test('深色主题中间栏可读，原主题按钮有效', async () => {
    await click(query('.sidebar .switch-item[title="黑夜"]'));
    assert(doc().documentElement.classList.contains('theme-dark'), '暗色主题没有启用');
    const style = win().getComputedStyle(query('.lists-pane'));
    const text = style.color.match(/\d+/g).slice(0, 3).map(Number);
    const background = style.backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
    assert(text.reduce((a, b) => a + b, 0) > background.reduce((a, b) => a + b, 0), '暗色面板文字不亮');
    await click(query('.sidebar .switch-item[title="白天"]'));
  });
  await test('800 / 1080 / 1440 窗口均无三栏溢出', async () => {
    for (const width of [800, 1080, 1440]) {
      await resize(width);
      const measured = geometry();
      metrics.push(measured);
      assert(doc().documentElement.scrollWidth <= width + 2, `${width}px 下页面横向溢出`);
      const header = query('.main-header').getBoundingClientRect();
      for (const control of visible('.main-header button, .main-header .view-switch')) {
        const rect = control.getBoundingClientRect();
        assert(rect.left >= header.left - 2 && rect.right <= header.right + 2, `${width}px 下工具按钮被挤出任务栏`);
      }
    }
  });
  await test('旧任务补 tags，不丢历史任务或原清单', () => {
    assert(api().readTodos().every(todo => Array.isArray(todo.tags)), '历史任务未获得兼容标签数组');
    assert(api().get('todos').data.length === 6 && api().get('categories').data.length === 41, '历史记录数量异常');
  });
  await test('挂载及交互没有运行时异常', () => {
    assert(api().getErrors().length === 0, api().getErrors().join('；'));
    assert(api().getWarnings().length === 0, api().getWarnings().join('；'));
  });
  const failures = results.filter(result => !result.passed);
  document.getElementById('summary').textContent = `${results.length - failures.length} / ${results.length} 项通过${failures.length ? `，${failures.length} 项待修复` : '，全部通过'}`;
  document.getElementById('metrics').textContent = `实测尺寸：${metrics.map(item => `${item.width}×${item.height} → 列宽 ${item.columns.join('/')}px，列表区 ${item.listHeight}px`).join('；')}`;
  window.__qaReport = { results, metrics, passed: failures.length === 0, errors: api().getErrors(), warnings: api().getWarnings() };
  document.getElementById('report-json').value = JSON.stringify(window.__qaReport, null, 2);
  frame.style.width = '100%';
  frame.style.height = '640px';
  document.getElementById('run').disabled = false;
};
const ready = async () => {
  if (api()?.ready) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('实际组件未能完成初始化')), 20000);
    const check = () => {
      if (api()?.ready) { clearTimeout(timeout); resolve(); }
      else requestAnimationFrame(check);
    };
    check();
  });
};
document.getElementById('run').addEventListener('click', runTests);
try { await ready(); await runTests(); }
catch (error) { document.getElementById('summary').textContent = `回归阻塞：${error.message}`; document.getElementById('run').disabled = false; }
