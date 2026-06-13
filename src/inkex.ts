import {Parser} from 'htmlparser2';
import {InkexPlaceholderHandler, InkexPlainTemplateHandler, InkexTemplateHandler} from "./handlers";
import {
    LocatedOpenTagRecord,
    OpenTagRecord,
    PlaceholderOpenTagRecord,
    RawOpenTagRecord,
    PlainTemplateOpenTagRecord
} from "./tag-records";

export class InkexHandleRegister {
    placeholderHandlers: Map<string, InkexPlaceholderHandler>;
    templateHandlers: Map<string, InkexTemplateHandler>;

    public constructor() {
        this.placeholderHandlers = new Map();
        this.templateHandlers = new Map();
    }
    public placeholder(tag: string, handler: InkexPlaceholderHandler) {
        if (!Inkex.isValidTag(tag)) {
            throw new RangeError(`Invalid tag name: "${tag}"`)
        }

        this.placeholderHandlers.set(tag, handler);
        return this;
    }

    public getPlaceholder(tag: string) {
        return this.placeholderHandlers.get(tag);
    }

    public template(tag: string, inner: InkexTemplateHandler) {
        if (!Inkex.isValidTag(tag)) {
            throw new RangeError(`Invalid tag name: "${tag}"`)
        }

        this.templateHandlers.set(tag, inner);
        return this;
    }

    public getTemplate(tag: string) {
        return this.templateHandlers.get(tag);
    }
}

export abstract class InkexNestedTemplateHandler extends InkexTemplateHandler {
    private readonly inkex: Inkex;

    public constructor(nestedHandlers: InkexHandleRegister) {
        super();
        // @ts-ignore Inkex 的构造方法不能由外部调用，但此处需要使用
        this.inkex = new Inkex(nestedHandlers);
    }

    public getInkex() {
        return this.inkex;
    }
}

export class NestedTemplateOpenTagRecord extends LocatedOpenTagRecord {
    public readonly handler: InkexNestedTemplateHandler;

    public constructor(name: string, startIndex: number, endIndex: number,
                       handler: InkexNestedTemplateHandler) {
        super(name, startIndex, endIndex);
        this.handler = handler;
    }
}

type HandlerSegment = (arg: object) => string;
type Segment = string | HandlerSegment;

export class Inkex {
    public static PLACEHOLDER_TAG = 'inkex-placeholder' as const;
    public static PLACEHOLDER_TAG_2 = 'inkex-p' as const;
    public static TEMPLATE_TAG = 'inkex-template' as const;
    public static TEMPLATE_TAG_2 = 'inkex-t' as const;

    private static monitoredTags: string[] = [
        Inkex.PLACEHOLDER_TAG, Inkex.PLACEHOLDER_TAG_2,
        Inkex.TEMPLATE_TAG, Inkex.TEMPLATE_TAG_2,
    ] as const;

    public static TAG_ATTRIBUTE = 'tag' as const;

    public static isValidTag(tag: string): boolean {
        return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tag);
    }

    private readonly handlers: InkexHandleRegister;
    private segments: Array<Segment>;

    private constructor(handlers: InkexHandleRegister) {
        this.handlers = handlers;
        this.segments = [];
    }

    public static create(template: string, handlers: InkexHandleRegister) {
        const ins = new Inkex(handlers);
        ins.useRawTemplate(template);
        return ins;
    }

    private useRawTemplate(template: string) {
        const self = this;

        const stack: OpenTagRecord[] = [];
        let cursor = 0;

        const parser = new Parser({
            onopentag(name, attrs) {
                if (!Inkex.monitoredTags.includes(name)) {
                    return;
                }

                if (stack.length > 0) {
                    const last = stack[stack.length - 1];
                    if (last instanceof PlaceholderOpenTagRecord || last instanceof PlainTemplateOpenTagRecord
                        || last instanceof RawOpenTagRecord) {
                        stack.push(new RawOpenTagRecord(name));
                        return;
                    }
                }

                let parentInkex: Inkex = self;
                if (stack.length !== 0) {
                    const last = stack[stack.length - 1];
                    if (!(last instanceof NestedTemplateOpenTagRecord)) {
                        throw new Error(); // 不会到此分支
                        // 因为只有嵌套的处理类才能更进一层，如果未嵌套，内部就会当作 raw 而不做处理。
                        // 如果在栈高度大于 0 时触发此处理，则说明其必被套在嵌套内，而上一层一定是嵌套处理类本身。
                    }
                    parentInkex = last.handler.getInkex();
                }

                if (parser.startIndex > cursor) {
                    parentInkex.segments.push(template.substring(cursor, parser.startIndex));
                }

                if (name === Inkex.PLACEHOLDER_TAG || name === Inkex.PLACEHOLDER_TAG_2) {
                    const tagAttr = attrs[Inkex.TAG_ATTRIBUTE];
                    if (!tagAttr || tagAttr.length === 0) {
                        throw new SyntaxError(`Missing "${Inkex.TAG_ATTRIBUTE}" attribute on <${name}>, at ${parser.startIndex}`);
                    }

                    const handler = parentInkex.handlers.getPlaceholder(tagAttr);
                    if (!handler) {
                        throw new ReferenceError(`No template handler registered for tag "${tagAttr}", at ${parser.startIndex}`);
                    }

                    stack.push(new PlaceholderOpenTagRecord(name, parser.startIndex, parser.endIndex, handler));
                } else if (name === Inkex.TEMPLATE_TAG || name === Inkex.TEMPLATE_TAG_2) {
                    const tagAttr = attrs[Inkex.TAG_ATTRIBUTE];
                    if (!tagAttr || tagAttr.length === 0) {
                        throw new SyntaxError(`Missing "${Inkex.TAG_ATTRIBUTE}" attribute on <${name}>, at ${parser.startIndex}`);
                    }

                    const handler = parentInkex.handlers.getTemplate(tagAttr);
                    if (!handler) {
                        throw new ReferenceError(`No template handler registered for tag "${tagAttr}", at ${parser.startIndex}`);
                    }

                    if (handler instanceof InkexNestedTemplateHandler) {
                        stack.push(new NestedTemplateOpenTagRecord(name, parser.startIndex, parser.endIndex, handler));
                    } else if (handler instanceof InkexPlainTemplateHandler){
                        stack.push(new PlainTemplateOpenTagRecord(name, parser.startIndex, parser.endIndex, handler));
                    }
                }

                cursor = parser.endIndex + 1;
            },

            onclosetag(name, isImplied) {
                if (!Inkex.monitoredTags.includes(name)) {
                    return;
                }

                if (isImplied) {
                    throw new SyntaxError(`Missing closing tag for <${name}>, at ${parser.startIndex}`);
                }
                if (stack.length === 0) {
                    throw new SyntaxError(`Unexpected closing tag <${name}>, at ${parser.startIndex}`);
                }
                const nowRecord = stack.pop()!;
                if (nowRecord.name !== name) {
                    throw new SyntaxError(`Mismatched tag: </${name}> closes <${nowRecord.name}>, at ${parser.startIndex}`);
                }

                if (nowRecord instanceof RawOpenTagRecord) {
                    return;
                }

                let parentInkex: Inkex = self;
                if (stack.length !== 0) {
                    const last = stack[stack.length - 1];
                    if (!(last instanceof NestedTemplateOpenTagRecord)) {
                        throw new Error(); // 不会到此分支，理由同前
                    }
                    parentInkex = last.handler.getInkex();
                }

                let handlerSegment: HandlerSegment;
                if (nowRecord instanceof PlaceholderOpenTagRecord) {
                    handlerSegment = nowRecord.handler;
                } else if (nowRecord instanceof PlainTemplateOpenTagRecord) {
                    if (parser.startIndex === nowRecord.startIndex) {
                        throw new SyntaxError(`Self-closing syntax is not allowed for <${name}>, at ${parser.startIndex}`);
                    }

                    // @ts-ignore InkexPlainTemplateHandler 的 template setter 不能由外部调用，但此处需要使用
                    nowRecord.handler.setTemplate(template.substring(cursor, parser.startIndex));

                    // @ts-ignore handler.handle 为 protected，唯有此处需要使用
                    handlerSegment = (arg: object) => nowRecord.handler.handle(arg);
                    // 包装一层，否则 this 指向错误
                } else if (nowRecord instanceof NestedTemplateOpenTagRecord) {
                    if (parser.startIndex === nowRecord.startIndex) {
                        throw new SyntaxError(`Self-closing syntax is not allowed for <${name}>, at ${parser.startIndex}`);
                    }

                    const nowInkex = nowRecord.handler.getInkex();
                    nowInkex.segments.push(template.substring(cursor, parser.startIndex));

                    // @ts-ignore handler.handle 为 protected，唯有此处需要使用
                    handlerSegment = (arg: object) => nowRecord.handler.handle(arg);
                    // 包装一层，否则 this 指向错误
                } else {
                    throw new Error(); // 不会到此分支，因为没有更多类型
                }

                parentInkex.segments.push(handlerSegment);

                cursor = parser.endIndex + 1;
            }
        });

        parser.write(template);
        parser.end();

        if (cursor < template.length) {
            this.segments.push(template.slice(cursor));
        }
    }

    public render(arg: object) {
        const html: string[] = [];

        for (const item of this.segments) {
            if (typeof item === 'string') {
                html.push(item);
            } else {
                html.push(item(arg));
            }
        }

        return html.join("");
    }
}