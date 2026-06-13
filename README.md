# inkex

[EN] A lightweight, fast dynamic HTML template parser and renderer.
[ZH] 轻量、快速的动态 HTML 模板解析与渲染器。

Define placeholders and templates with custom HTML tags — no template syntax like `{{ }}` needed.
通过自定义 HTML 标签定义占位符和模板，无需 `{{ }}` 之类的模板语法。

## Install / 安装

```sh
npm install inkex-html
```

## Quick Start / 快速开始

```ts
import { inkex } from 'inkex-html';

const result = inkex('<h1><inkex-placeholder tag="title"></inkex-placeholder></h1>')
  .placeholder('title', () => 'Hello World')
  .build()
  .render({});

console.log(result); // <h1>Hello World</h1>
```

## Usage / 使用

### Placeholder / 占位符

Placeholders are replaced by a function result at render time.
占位符在渲染时被函数返回结果替换。

```ts
const result = inkex('<p><inkex-placeholder tag="name"></inkex-placeholder></p>')
  .placeholder('name', (ctx) => ctx.name)
  .build()
  .render({ name: 'Alice' });
```

Use the short alias `<inkex-p>` / 使用短标签 `<inkex-p>`：

```ts
inkex('<inkex-p tag="x"></inkex-p>').placeholder('x', () => 'ok').build().render({});
```

### Plain Template / 普通模板

The inner content between `<inkex-template>` tags is passed to the handler. Call `this.getTemplate()` to access it.
模板标签内的内容会自动传入 handler，通过 `this.getTemplate()` 获取。

```ts
import { InkexPlainTemplateHandler } from 'inkex-html';

class BoldText extends InkexPlainTemplateHandler {
  protected handle(ctx: object): string {
    return `<b>${this.getTemplate()}</b>`;
  }
}

const result = inkex('<inkex-template tag="bold">Hello World</inkex-template>')
  .template('bold', new BoldText())
  .build()
  .render({});
// <b>Hello World</b>
```

### Nested Template / 嵌套模板

Nested templates have their own independent `Inkex` instance for recursive rendering.
嵌套模板拥有自己独立的 `Inkex` 实例，支持递归渲染内部内容。

Each call to `getInkex().render(ctx)` reuses the same inner template definition but can render different contexts — ideal for rendering a list of items.
同一个嵌套模板可以用不同的 context 反复渲染，适合列表等重复结构。

```ts
import { InkexNestedTemplateHandler, InkexHandleRegister } from 'inkex-html';

// Define the inner layout once
// 定义一次内部布局
const innerReg = new InkexHandleRegister();
innerReg.placeholder('name', (ctx: any) => ctx.name);
innerReg.placeholder('role', (ctx: any) => ctx.role);

class Card extends InkexNestedTemplateHandler {
  protected handle(ctx: object): string {
    return `<div class="card">${this.getInkex().render(ctx)}</div>`;
  }
}

const render = inkex(
  '<inkex-template tag="card"><h2><inkex-p tag="name"></inkex-p></h2><p><inkex-p tag="role"></inkex-p></p></inkex-template>'
)
  .template('card', new Card(innerReg))
  .build()
  .render;

// Reuse with different data / 复用不同数据
const users = [
  { name: 'Alice', role: 'Admin' },
  { name: 'Bob', role: 'Editor' },
];

const html = users.map(u => render(u)).join('');
// <div class="card"><h2>Alice</h2><p>Admin</p></div>
// <div class="card"><h2>Bob</h2><p>Editor</p></div>
```

## Supported Tags / 支持的标签

| Tag / 标签 | Short / 简写 | Purpose / 用途 |
|------------|------|---------|
| `<inkex-placeholder>` | `<inkex-p>` | Replaced by a function result / 被函数结果替换 |
| `<inkex-template>` | `<inkex-t>` | Rendered by a handler class / 由处理器类渲染 |

## License / 协议

MIT
