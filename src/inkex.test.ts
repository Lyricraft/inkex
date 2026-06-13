import { describe, it, expect } from 'vitest';
import {
    inkex, Inkex, InkexPlainTemplateHandler, InkexNestedTemplateHandler,
    InkexHandleRegister,
} from './index.js';

// --- helpers ---

class TestPlainTemplate extends InkexPlainTemplateHandler {
    protected handle(_arg: object): string {
        return `<b>template</b>`;
    }
}

class TestNestedTemplate extends InkexNestedTemplateHandler {
    protected handle(arg: object): string {
        return this.getInkex().render(arg);
    }
}

// =============================================

describe('plain text', () => {
    it('outputs text unchanged when no custom tags', () => {
        const r = inkex('<p>hello world</p>').build().render({});
        expect(r).toBe('<p>hello world</p>');
    });

    it('preserves whitespace and line breaks', () => {
        const r = inkex('  line1\n  line2  ').build().render({});
        expect(r).toBe('  line1\n  line2  ');
    });

    it('handles empty string', () => {
        const r = inkex('').build().render({});
        expect(r).toBe('');
    });
});

describe('placeholder', () => {
    it('replaces a single placeholder', () => {
        const r = inkex('<p><inkex-placeholder tag="name"></inkex-placeholder></p>')
            .placeholder('name', () => '<b>Alice</b>')
            .build()
            .render({});
        expect(r).toBe('<p><b>Alice</b></p>');
    });

    it('replaces multiple different placeholders', () => {
        const r = inkex('<inkex-placeholder tag="a"></inkex-placeholder>+<inkex-placeholder tag="b"></inkex-placeholder>')
            .placeholder('a', () => '1')
            .placeholder('b', () => '2')
            .build()
            .render({});
        expect(r).toBe('1+2');
    });

    it('passes render context to handler', () => {
        const r = inkex('<inkex-placeholder tag="x"></inkex-placeholder>')
            .placeholder('x', (arg: any) => arg.value)
            .build()
            .render({ value: 'hello' });
        expect(r).toBe('hello');
    });

    it('replaces consecutive placeholders', () => {
        const r = inkex('<inkex-placeholder tag="a"></inkex-placeholder><inkex-placeholder tag="b"></inkex-placeholder>')
            .placeholder('a', () => 'A')
            .placeholder('b', () => 'B')
            .build()
            .render({});
        expect(r).toBe('AB');
    });

    it('ignores inner content of placeholder', () => {
        const r = inkex('<inkex-placeholder tag="x">IGNORE</inkex-placeholder>')
            .placeholder('x', () => 'ok')
            .build()
            .render({});
        expect(r).toBe('ok');
    });
});

describe('mixed content', () => {
    it('preserves text before the first custom tag', () => {
        const r = inkex('Hello <inkex-placeholder tag="x"></inkex-placeholder>')
            .placeholder('x', () => '!')
            .build()
            .render({});
        expect(r).toBe('Hello !');
    });

    it('preserves text after the last custom tag', () => {
        const r = inkex('<inkex-placeholder tag="x"></inkex-placeholder> world')
            .placeholder('x', () => 'Hello')
            .build()
            .render({});
        expect(r).toBe('Hello world');
    });

    it('preserves text between custom tags', () => {
        const r = inkex('<inkex-p tag="a"></inkex-p> between <inkex-p tag="b"></inkex-p>')
            .placeholder('a', () => '[A]')
            .placeholder('b', () => '[B]')
            .build()
            .render({});
        expect(r).toBe('[A] between [B]');
    });

    it('handles real HTML mixed with custom tags', () => {
        const r = inkex('<div class="wrap"><inkex-placeholder tag="x"></inkex-placeholder></div>')
            .placeholder('x', () => '<span>inner</span>')
            .build()
            .render({});
        expect(r).toBe('<div class="wrap"><span>inner</span></div>');
    });
});

describe('InkexBuilder API', () => {
    it('supports chaining placeholder calls', () => {
        const r = inkex('<inkex-p tag="a"></inkex-p><inkex-p tag="b"></inkex-p>')
            .placeholder('a', () => '1')
            .placeholder('b', () => '2')
            .build()
            .render({});
        expect(r).toBe('12');
    });
});

describe('plain template', () => {
    it('replaces template tag with handler output', () => {
        const r = inkex('<p><inkex-template tag="t"></inkex-template></p>')
            .template('t', new TestPlainTemplate())
            .build()
            .render({});
        expect(r).toBe('<p><b>template</b></p>');
    });

    it('passes context to plain template handler', () => {
        class TemplateWithCtx extends InkexPlainTemplateHandler {
            protected handle(arg: any): string {
                return arg.value;
            }
        }
        const r = inkex('<inkex-template tag="t"></inkex-template>')
            .template('t', new TemplateWithCtx())
            .build()
            .render({ value: 'ctx-ok' });
        expect(r).toBe('ctx-ok');
    });
});

describe('nested template', () => {
    it('recursively renders inner content', () => {
        const innerReg = new InkexHandleRegister();
        innerReg.placeholder('name', () => 'Nested');

        const handler = new (class extends InkexNestedTemplateHandler {
            protected handle(arg: object): string {
                return `<i>${this.getInkex().render(arg)}</i>`;
            }
        })(innerReg);

        const r = inkex('<inkex-template tag="t"><inkex-placeholder tag="name"></inkex-placeholder></inkex-template>')
            .template('t', handler)
            .build()
            .render({});
        expect(r).toBe('<i>Nested</i>');
    });
});

describe('InkexHandleRegister direct usage', () => {
    it('works via Inkex.create()', () => {
        const reg = new InkexHandleRegister();
        reg.placeholder('x', () => 'direct');
        const r = Inkex.create('<inkex-placeholder tag="x"></inkex-placeholder>', reg).render({});
        expect(r).toBe('direct');
    });
});

describe('errors', () => {
    it('throws on missing tag attribute', () => {
        expect(() => inkex('<inkex-placeholder></inkex-placeholder>').build().render({}))
            .toThrow(SyntaxError);
    });

    it('throws on unregistered placeholder handler', () => {
        expect(() => inkex('<inkex-placeholder tag="x"></inkex-placeholder>').build().render({}))
            .toThrow(ReferenceError);
    });

    it('throws on unregistered template handler', () => {
        expect(() => inkex('<inkex-template tag="x"></inkex-template>').build().render({}))
            .toThrow(ReferenceError);
    });

    it('throws on invalid tag name', () => {
        const reg = new InkexHandleRegister();
        expect(() => reg.placeholder('123bad', () => 'x')).toThrow(RangeError);
        expect(() => reg.template('', new TestPlainTemplate())).toThrow(RangeError);
        expect(() => reg.placeholder('has space', () => 'x')).toThrow(RangeError);
    });

    it('throws on self-closing template tag', () => {
        expect(() => inkex('<inkex-template tag="x"/>').template('x', new TestPlainTemplate()).build().render({}))
            .toThrow(SyntaxError);
    });

    it('throws on self-closing nested template tag', () => {
        const reg = new InkexHandleRegister();
        const handler = new TestNestedTemplate(reg);
        expect(() => inkex('<inkex-template tag="x"/>').template('x', handler).build().render({}))
            .toThrow(SyntaxError);
    });

    it('throws on missing closing tag', () => {
        // isImplied 时 htmlparser2 会自动闭合并抛错
        expect(() => inkex('<inkex-placeholder tag="x">')
            .placeholder('x', () => 'v')
            .build()
            .render({}))
            .toThrow(SyntaxError);
    });

    it('throws on mismatched closing tag', () => {
        expect(() => inkex('<inkex-placeholder tag="a"></inkex-p>')
            .placeholder('a', () => 'x')
            .build()
            .render({}))
            .toThrow(SyntaxError);
    });

});

describe('edge cases', () => {
    it('works with short tag aliases', () => {
        const r = inkex('<inkex-p tag="x"></inkex-p><inkex-t tag="y"></inkex-t>')
            .placeholder('x', () => 'P')
            .template('y', new TestPlainTemplate())
            .build()
            .render({});
        expect(r).toBe('P<b>template</b>');
    });

    it('handles context as empty object', () => {
        const r = inkex('<inkex-placeholder tag="x"></inkex-placeholder>')
            .placeholder('x', () => 'ok')
            .build()
            .render({});
        expect(r).toBe('ok');
    });

    it('supports multiple handler registrations for same tag', () => {
        const r = inkex('<inkex-placeholder tag="x"></inkex-placeholder><inkex-placeholder tag="x"></inkex-placeholder>')
            .placeholder('x', () => 'same')
            .build()
            .render({});
        expect(r).toBe('samesame');
    });
});
